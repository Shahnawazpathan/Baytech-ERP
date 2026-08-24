import { db } from '@/lib/db'
import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'

/**
 * Retry wrapper for transient Turso/libSQL network errors.
 * Retries up to 3 times with short backoff before giving up.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const msg = String(error?.message || '')
      // Only retry transient infra failures, not validation errors
      const isTransient =
        msg.includes('HTTP status') ||
        msg.includes('SERVER_ERROR') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('socket hang up')
      if (!isTransient || i === attempts - 1) throw error
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  throw lastError
}

export async function initializeSystem() {
  const issues: string[] = []

  try {
    // Default company
    let company = await withRetry(() =>
      db.company.findUnique({ where: { id: 'default-company' } })
    )
    if (!company) {
      company = await db.company.create({
        data: {
          id: 'default-company',
          name: 'Baytech Mortgage',
          description: 'Mortgage ERP System',
          address: '123 Main St, City, State',
          phone: '555-1234',
          email: 'info@baytechmortgage.com',
        },
      })
    }

    // Departments (upsert - idempotent, single round trip per row)
    for (const dept of [
      { name: 'Admin', id: 'admin-dept' },
      { name: 'Manager', id: 'manager-dept' },
      { name: 'Employee', id: 'employee-dept' },
    ]) {
      await withRetry(() =>
        db.department.upsert({
          where: { companyId_name: { companyId: company!.id, name: dept.name } },
          update: {},
          create: { id: dept.id, name: dept.name, companyId: company!.id },
        }).catch(async () => {
          // Compound-unique lookup can race under concurrent boots - fall back to findFirst
          const existing = await db.department.findFirst({
            where: { companyId: company!.id, name: dept.name },
          })
          if (!existing) throw new Error(`Failed to ensure department ${dept.name}`)
          return existing
        })
      )
    }

    // Roles
    for (const role of [
      { name: 'Administrator', description: 'Full system access with all permissions' },
      { name: 'Manager', description: 'Manager with access to employees, leads, and reports' },
      { name: 'Employee', description: 'Basic employee with access to assigned leads and attendance' },
    ]) {
      await withRetry(() =>
        db.role.upsert({
          where: { companyId_name: { companyId: company!.id, name: role.name } },
          update: {},
          create: { name: role.name, description: role.description, companyId: company!.id },
        }).catch(async () => {
          const existing = await db.role.findFirst({
            where: { companyId: company!.id, name: role.name },
          })
          if (!existing) throw new Error(`Failed to ensure role ${role.name}`)
          return existing
        })
      )
    }

    const adminDepartment = await withRetry(() =>
      db.department
        .findUnique({
          where: { companyId_name: { companyId: company!.id, name: 'Admin' } },
        })
        .catch(() =>
          db.department.findFirst({ where: { companyId: company!.id, name: 'Admin' } })
        )
    )

    const adminRole = await withRetry(() =>
      db.role
        .findUnique({
          where: { companyId_name: { companyId: company!.id, name: 'Administrator' } },
        })
        .catch(() => db.role.findFirst({ where: { companyId: company!.id, name: 'Administrator' } }))
    )

    if (!adminDepartment || !adminRole) {
      issues.push('Missing admin department or role')
      console.error('❌ System init incomplete:', issues.join('; '))
      return false
    }

    // Admin user
    const adminUser = await withRetry(() =>
      db.employee.findUnique({ where: { email: 'admin@baytech.com' } })
    )

    if (!adminUser) {
      // Password source priority:
      // 1. ADMIN_INITIAL_PASSWORD env var (deployment-controlled)
      // 2. Cryptographically random password, printed exactly once
      const initialPassword =
        process.env.ADMIN_INITIAL_PASSWORD && process.env.ADMIN_INITIAL_PASSWORD.length >= 8
          ? process.env.ADMIN_INITIAL_PASSWORD
          : `Bt-${randomBytes(9).toString('base64url')}!9`

      const hashedPassword = await bcrypt.hash(initialPassword, 10)

      await db.employee.create({
        data: {
          employeeId: 'ADMIN001',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@baytech.com',
          password: hashedPassword,
          position: 'System Administrator',
          departmentId: adminDepartment.id,
          roleId: adminRole.id,
          hireDate: new Date(),
          status: 'ACTIVE',
          companyId: company.id,
        },
      })

      console.log('👤 Admin created: admin@baytech.com')
      if (!process.env.ADMIN_INITIAL_PASSWORD) {
        // One-time display of the generated credential - it cannot be recovered later
        console.log(`🔑 Password (shown once): ${initialPassword}`)
        console.log('⚠️  Set ADMIN_INITIAL_PASSWORD in .env to control this value.')
      }
    }

    // Permissions + role grants
    const permissionResources = ['employee', 'lead', 'attendance', 'department', 'role', 'report', 'notification']
    const permissionActions = ['CREATE', 'READ', 'UPDATE', 'DELETE']

    const allPermissions: { id: string; resource: string; action: string }[] = []
    for (const resource of permissionResources) {
      for (const action of permissionActions) {
        try {
          const permission = await withRetry(() =>
            db.permission.upsert({
              where: {
                companyId_resource_action: {
                  companyId: company!.id,
                  resource,
                  action,
                },
              },
              update: {},
              create: {
                name: `${action}_${resource.toUpperCase()}`,
                resource,
                action,
                description: `Allow to ${action.toLowerCase()} ${resource}`,
                companyId: company!.id,
              },
            })
          )
          allPermissions.push({ id: permission.id, resource, action })
        } catch {
          // Already exists via a different path - harmless
        }
      }
    }

    const rolesToSeed = [
      { name: 'Administrator', resources: permissionResources },
      { name: 'Manager', resources: ['lead', 'attendance', 'employee', 'report', 'department', 'notification'] },
      { name: 'Employee', resources: ['lead', 'attendance'] },
    ]

    for (const { name: roleName, resources } of rolesToSeed) {
      const dbRole = await db.role
        .findUnique({
          where: { companyId_name: { companyId: company!.id, name: roleName } },
        })
        .catch(() => db.role.findFirst({ where: { companyId: company!.id, name: roleName } }))
      if (!dbRole) continue

      const actionsFor = roleName === 'Employee' ? ['READ', 'UPDATE'] : permissionActions

      const wantedIds = allPermissions
        .filter((p) => resources.includes(p.resource) && actionsFor.includes(p.action))
        .map((p) => p.id)

      const existingLinks = await withRetry(() =>
        db.rolePermission.findMany({
          where: { roleId: dbRole.id, permissionId: { in: wantedIds } },
          select: { permissionId: true },
        })
      )
      const linkedIds = new Set(existingLinks.map((l) => l.permissionId))
      const missing = wantedIds.filter((id) => !linkedIds.has(id))

      if (missing.length > 0) {
        await withRetry(() =>
          db.rolePermission.createMany({
            data: missing.map((permissionId) => ({ roleId: dbRole.id, permissionId })),
          }).catch(async () => {
            // Concurrent boot may have inserted some already - insert remaining one by one
            for (const permissionId of missing) {
              await db.rolePermission
                .create({ data: { roleId: dbRole.id, permissionId } })
                .catch(() => undefined)
            }
          })
        )
      }
    }

    console.log('✅ System ready')
    return true
  } catch (error: any) {
    console.error('❌ System init failed:', error?.message || error)
    return false
  }
}

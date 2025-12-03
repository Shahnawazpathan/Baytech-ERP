import { createClient } from '@libsql/client'
import bcrypt from 'bcrypt'

// Turso Database Configuration (Hardcoded)
const TURSO_DATABASE_URL = 'libsql://database-baytech-village-vercel-icfg-onrrmbslrj4je1pg81gzocha.aws-ap-south-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjQ3Njc0MjQsImlkIjoiMTc3ODU2NTYtYjZjNS00M2YwLTgyNjktMWY5MDAyYzQ4YWFhIiwicmlkIjoiMGU1NGNmM2MtZjQwMS00ZjUyLThkYmMtN2MyYjhkZmM2OThlIn0.Uw065oL8CPxkOmVPFMY-Qdf0k8eeNY06Cf2zREQrhpiudbQEfO1dk5YYKeY5fBASqusy8dfybrf8_APe7g4qBQ'

async function seed() {
  console.log('🌱 Seeding Turso database directly...')

  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  })

  try {
    // Create company
    const companyId = 'default-company'
    await client.execute({
      sql: `INSERT OR REPLACE INTO companies (id, name, description, address, phone, email, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        companyId,
        'Baytech Mortgage',
        'Mortgage ERP System',
        '123 Main St, City, State',
        '555-1234',
        'info@baytechmortgage.com',
        1,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    })
    console.log('✅ Company created')

    // Create departments
    const adminDeptId = 'admin-dept-001'
    const managerDeptId = 'manager-dept-001'
    const employeeDeptId = 'employee-dept-001'

    await client.execute({
      sql: `INSERT OR REPLACE INTO departments (id, name, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [adminDeptId, 'Admin', companyId, 1, new Date().toISOString(), new Date().toISOString()]
    })

    await client.execute({
      sql: `INSERT OR REPLACE INTO departments (id, name, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [managerDeptId, 'Manager', companyId, 1, new Date().toISOString(), new Date().toISOString()]
    })

    await client.execute({
      sql: `INSERT OR REPLACE INTO departments (id, name, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [employeeDeptId, 'Employee', companyId, 1, new Date().toISOString(), new Date().toISOString()]
    })
    console.log('✅ Departments created')

    // Create roles
    const adminRoleId = 'admin-role-001'
    const managerRoleId = 'manager-role-001'
    const employeeRoleId = 'employee-role-001'

    await client.execute({
      sql: `INSERT OR REPLACE INTO roles (id, name, description, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [adminRoleId, 'Administrator', 'Full system access with all permissions', companyId, 1, new Date().toISOString(), new Date().toISOString()]
    })

    await client.execute({
      sql: `INSERT OR REPLACE INTO roles (id, name, description, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [managerRoleId, 'Manager', 'Manager with access to employees, leads, and reports', companyId, 1, new Date().toISOString(), new Date().toISOString()]
    })

    await client.execute({
      sql: `INSERT OR REPLACE INTO roles (id, name, description, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [employeeRoleId, 'Employee', 'Basic employee with access to assigned leads and attendance', companyId, 1, new Date().toISOString(), new Date().toISOString()]
    })
    console.log('✅ Roles created')

    // Create permissions
    const permissionsData = [
      { resource: 'employee', action: 'CREATE' },
      { resource: 'employee', action: 'READ' },
      { resource: 'employee', action: 'UPDATE' },
      { resource: 'employee', action: 'DELETE' },
      { resource: 'department', action: 'CREATE' },
      { resource: 'department', action: 'READ' },
      { resource: 'department', action: 'UPDATE' },
      { resource: 'department', action: 'DELETE' },
      { resource: 'lead', action: 'CREATE' },
      { resource: 'lead', action: 'READ' },
      { resource: 'lead', action: 'UPDATE' },
      { resource: 'lead', action: 'DELETE' },
      { resource: 'attendance', action: 'CREATE' },
      { resource: 'attendance', action: 'READ' },
      { resource: 'attendance', action: 'UPDATE' },
      { resource: 'attendance', action: 'DELETE' },
      { resource: 'role', action: 'CREATE' },
      { resource: 'role', action: 'READ' },
      { resource: 'role', action: 'UPDATE' },
      { resource: 'role', action: 'DELETE' },
      { resource: 'permission', action: 'CREATE' },
      { resource: 'permission', action: 'READ' },
      { resource: 'permission', action: 'UPDATE' },
      { resource: 'permission', action: 'DELETE' },
      { resource: 'report', action: 'READ' },
      { resource: 'report', action: 'CREATE' },
      { resource: 'notification', action: 'READ' },
      { resource: 'notification', action: 'UPDATE' },
    ]

    const permissionIds: any = {}
    for (const perm of permissionsData) {
      const permId = `perm-${perm.resource}-${perm.action}`
      permissionIds[`${perm.resource}-${perm.action}`] = permId

      await client.execute({
        sql: `INSERT OR REPLACE INTO permissions (id, name, resource, action, description, companyId, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          permId,
          `${perm.action}_${perm.resource.toUpperCase()}`,
          perm.resource,
          perm.action,
          `Allow to ${perm.action.toLowerCase()} ${perm.resource}`,
          companyId,
          1,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      })
    }
    console.log('✅ Permissions created')

    // Assign all permissions to admin role
    for (const key in permissionIds) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO role_permissions (id, roleId, permissionId, createdAt)
              VALUES (?, ?, ?, ?)`,
        args: [`rp-admin-${key}`, adminRoleId, permissionIds[key], new Date().toISOString()]
      })
    }
    console.log('✅ Admin permissions assigned')

    // Create users
    const adminPassword = await bcrypt.hash('Admin@123', 10)
    const managerPassword = await bcrypt.hash('Manager@123', 10)
    const employeePassword = await bcrypt.hash('Employee@123', 10)

    await client.execute({
      sql: `INSERT OR REPLACE INTO employees (id, employeeId, firstName, lastName, email, password, position, departmentId, roleId, hireDate, status, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'admin-user-001',
        'ADMIN001',
        'Admin',
        'User',
        'admin@baytech.com',
        adminPassword,
        'System Administrator',
        adminDeptId,
        adminRoleId,
        new Date().toISOString(),
        'ACTIVE',
        companyId,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    })

    await client.execute({
      sql: `INSERT OR REPLACE INTO employees (id, employeeId, firstName, lastName, email, password, position, departmentId, roleId, hireDate, status, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'manager-user-001',
        'MGR001',
        'Zohed',
        'Siddique',
        'zohed.siddique@baytech.com',
        managerPassword,
        'Manager',
        managerDeptId,
        managerRoleId,
        new Date().toISOString(),
        'ACTIVE',
        companyId,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    })

    await client.execute({
      sql: `INSERT OR REPLACE INTO employees (id, employeeId, firstName, lastName, email, password, position, departmentId, roleId, hireDate, status, companyId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'employee-user-001',
        'EMP001',
        'Regular',
        'Employee',
        'employee@baytech.com',
        employeePassword,
        'Staff Member',
        employeeDeptId,
        employeeRoleId,
        new Date().toISOString(),
        'ACTIVE',
        companyId,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    })

    console.log('✅ Users created')
    console.log('\n📊 Seed Summary:')
    console.log('Company: Baytech Mortgage')
    console.log('Users:')
    console.log('  - admin@baytech.com (Password: Admin@123)')
    console.log('  - zohed.siddique@baytech.com (Password: Manager@123)')
    console.log('  - employee@baytech.com (Password: Employee@123)')
    console.log('\n✅ Turso database seeded successfully!')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

seed()

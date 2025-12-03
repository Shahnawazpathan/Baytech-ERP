import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Turso Database Configuration (Hardcoded)
const TURSO_DATABASE_URL = 'libsql://baytech-shahnawazpathan.aws-ap-south-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjI0OTM1OTIsImlkIjoiZmJlMjM5MzktYzc4OC00OWQzLWEzYzEtNjU5YTIyZDNhZTBjIiwicmlkIjoiYzNjY2Y4MDctYmVjOS00ZWNmLWJhZDItNzQ1NjkwMjJkZWYwIn0.iONfkGJQnBcIDl0ncthJnRktWkUBNV9sr2km2eKHEgd0UzNtdSE709py9CgA4CDozdEYvQgct90zw4H9pFqSDw'

console.log('Turso URL:', TURSO_DATABASE_URL)
console.log('Turso Token length:', TURSO_AUTH_TOKEN.length)

console.log('Creating Prisma adapter...')

// Create Prisma adapter for libsql
const adapter = new PrismaLibSQL({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
})

console.log('LibSQL adapter created successfully')

// Set a dummy DATABASE_URL for Prisma schema validation (not actually used with adapter)
process.env.DATABASE_URL = 'file:./dummy.db'

// Initialize Prisma Client with Turso adapter
const prisma = new PrismaClient({
  adapter,
  log: ['query', 'error', 'warn'],
})

async function main() {
  console.log('🌱 Seeding Turso database...')

  // Create a default company
  const company = await prisma.company.upsert({
    where: { id: 'default-company' },
    update: {},
    create: {
      id: 'default-company',
      name: 'Baytech Mortgage',
      description: 'Mortgage ERP System',
      address: '123 Main St, City, State',
      phone: '555-1234',
      email: 'info@baytechmortgage.com',
    },
  })

  // Create departments
  const adminDepartment = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Admin',
      }
    },
    update: {},
    create: {
      name: 'Admin',
      companyId: company.id,
    },
  })

  const managerDepartment = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Manager',
      }
    },
    update: {},
    create: {
      name: 'Manager',
      companyId: company.id,
    },
  })

  const employeeDepartment = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Employee',
      }
    },
    update: {},
    create: {
      name: 'Employee',
      companyId: company.id,
    },
  })

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Administrator',
      }
    },
    update: {},
    create: {
      name: 'Administrator',
      description: 'Full system access with all permissions',
      companyId: company.id,
    },
  })

  const managerRole = await prisma.role.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Manager',
      }
    },
    update: {},
    create: {
      name: 'Manager',
      description: 'Manager with access to employees, leads, and reports',
      companyId: company.id,
    },
  })

  const employeeRole = await prisma.role.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Employee',
      }
    },
    update: {},
    create: {
      name: 'Employee',
      description: 'Basic employee with access to assigned leads and attendance',
      companyId: company.id,
    },
  })

  // Create permissions
  const permissionsData = [
    // Employee permissions
    { resource: 'employee', action: 'CREATE' },
    { resource: 'employee', action: 'READ' },
    { resource: 'employee', action: 'UPDATE' },
    { resource: 'employee', action: 'DELETE' },

    // Department permissions
    { resource: 'department', action: 'CREATE' },
    { resource: 'department', action: 'READ' },
    { resource: 'department', action: 'UPDATE' },
    { resource: 'department', action: 'DELETE' },

    // Lead permissions
    { resource: 'lead', action: 'CREATE' },
    { resource: 'lead', action: 'READ' },
    { resource: 'lead', action: 'UPDATE' },
    { resource: 'lead', action: 'DELETE' },

    // Attendance permissions
    { resource: 'attendance', action: 'CREATE' },
    { resource: 'attendance', action: 'READ' },
    { resource: 'attendance', action: 'UPDATE' },
    { resource: 'attendance', action: 'DELETE' },

    // Role permissions
    { resource: 'role', action: 'CREATE' },
    { resource: 'role', action: 'READ' },
    { resource: 'role', action: 'UPDATE' },
    { resource: 'role', action: 'DELETE' },

    // Permission permissions (for managing permissions)
    { resource: 'permission', action: 'CREATE' },
    { resource: 'permission', action: 'READ' },
    { resource: 'permission', action: 'UPDATE' },
    { resource: 'permission', action: 'DELETE' },

    // Report permissions
    { resource: 'report', action: 'READ' },
    { resource: 'report', action: 'CREATE' },

    // Notification permissions
    { resource: 'notification', action: 'READ' },
    { resource: 'notification', action: 'UPDATE' },
  ]

  // Create permissions in the database using unique constraints
  for (const perm of permissionsData) {
    await prisma.permission.upsert({
      where: {
        companyId_resource_action: {
          companyId: company.id,
          resource: perm.resource,
          action: perm.action
        }
      },
      update: {},
      create: {
        name: `${perm.action}_${perm.resource.toUpperCase()}`,
        resource: perm.resource,
        action: perm.action,
        description: `Allow to ${perm.action.toLowerCase()} ${perm.resource}`,
        companyId: company.id,
      },
    })
  }

  // Get all permissions for role assignments
  const allPermissions = await prisma.permission.findMany({
    where: { companyId: company.id }
  })

  // Assign permissions to Admin role (full access)
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id
      }
    })
  }

  // Assign permissions to Manager role (limited access)
  const managerPermissions = allPermissions.filter(perm =>
    ['employee', 'lead', 'attendance', 'report'].includes(perm.resource) &&
    ['READ', 'UPDATE'].includes(perm.action)  // Managers can read and update
  )

  for (const permission of managerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: managerRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: managerRole.id,
        permissionId: permission.id
      }
    })
  }

  // Assign permissions to Employee role (very limited access)
  const specificEmployeePermissions = allPermissions.filter(perm => {
    // Employees can read own employee record and update it
    if (perm.resource === 'employee' && (perm.action === 'READ' || perm.action === 'UPDATE')) return true
    // Employees can create/update own attendance
    if (perm.resource === 'attendance' && perm.action === 'CREATE') return true
    // Employees can read leads assigned to them
    if (perm.resource === 'lead' && perm.action === 'READ') return true
    // Employees can read reports
    if (perm.resource === 'report' && perm.action === 'READ') return true
    // Employees can read and update own notifications
    if (perm.resource === 'notification' && (perm.action === 'READ' || perm.action === 'UPDATE')) return true
    return false
  })

  for (const permission of specificEmployeePermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: employeeRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: employeeRole.id,
        permissionId: permission.id
      }
    })
  }

  // Delete all existing data with proper order (respecting foreign keys)
  console.log('🗑️  Deleting all existing data...')
  await prisma.notification.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.leadHistory.deleteMany({})
  await prisma.task.deleteMany({})
  await prisma.attendance.deleteMany({})
  await prisma.lead.deleteMany({})
  await prisma.employee.deleteMany({})

  // Hash passwords
  const defaultPassword = await bcrypt.hash('Baytech@123', 10)

  // Create admin user - Ehsan
  console.log('👤 Creating admin user: ehsan@baytech-uae.com')
  const adminUser = await prisma.employee.create({
    data: {
      employeeId: 'ADMIN001',
      firstName: 'Ehsan',
      lastName: 'Admin',
      email: 'ehsan@baytech-uae.com',
      password: defaultPassword,
      position: 'Administrator',
      departmentId: adminDepartment.id,
      roleId: adminRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  // Create manager user - Zoheb
  console.log('👤 Creating manager user: zoheb@baytech-uae.com')
  const managerUser = await prisma.employee.create({
    data: {
      employeeId: 'MGR001',
      firstName: 'Zoheb',
      lastName: 'Manager',
      email: 'zoheb@baytech-uae.com',
      password: defaultPassword,
      position: 'Manager',
      departmentId: managerDepartment.id,
      roleId: managerRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  // Create employee users
  console.log('👤 Creating employee: ragab@baytech-uae.com')
  const employeeRagab = await prisma.employee.create({
    data: {
      employeeId: 'EMP001',
      firstName: 'Ragab',
      lastName: 'Employee',
      email: 'ragab@baytech-uae.com',
      password: defaultPassword,
      position: 'Employee',
      departmentId: employeeDepartment.id,
      roleId: employeeRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  console.log('👤 Creating employee: adem@baytech-uae.com')
  const employeeAdem = await prisma.employee.create({
    data: {
      employeeId: 'EMP002',
      firstName: 'Adem',
      lastName: 'Employee',
      email: 'adem@baytech-uae.com',
      password: defaultPassword,
      position: 'Employee',
      departmentId: employeeDepartment.id,
      roleId: employeeRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  console.log('👤 Creating employee: gail@baytech-uae.com')
  const employeeGail = await prisma.employee.create({
    data: {
      employeeId: 'EMP003',
      firstName: 'Gail',
      lastName: 'Employee',
      email: 'gail@baytech-uae.com',
      password: defaultPassword,
      position: 'Employee',
      departmentId: employeeDepartment.id,
      roleId: employeeRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  console.log('✅ Turso database seeded successfully!')
  console.log('Company:', company.name)
  console.log('')
  console.log('👤 Users Created:')
  console.log('====================')
  console.log('Admin:', adminUser.email)
  console.log('Manager:', managerUser.email)
  console.log('Employee 1:', employeeRagab.email)
  console.log('Employee 2:', employeeAdem.email)
  console.log('Employee 3:', employeeGail.email)
  console.log('')
  console.log('🔐 Default Password: Baytech@123')
  console.log('====================')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Turso database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

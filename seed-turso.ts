import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

// Turso Database Configuration (Hardcoded)
const TURSO_DATABASE_URL = 'libsql://baytech-shahnawazpathan.aws-ap-south-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjI0OTM1OTIsImlkIjoiZmJlMjM5MzktYzc4OC00OWQzLWEzYzEtNjU5YTIyZDNhZTBjIiwicmlkIjoiYzNjY2Y4MDctYmVjOS00ZWNmLWJhZDItNzQ1NjkwMjJkZWYwIn0.iONfkGJQnBcIDl0ncthJnRktWkUBNV9sr2km2eKHEgd0UzNtdSE709py9CgA4CDozdEYvQgct90zw4H9pFqSDw'

console.log('Turso URL:', TURSO_DATABASE_URL)
console.log('Turso Token length:', TURSO_AUTH_TOKEN.length)

// Create libsql client for Turso
const libsql = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
})

console.log('LibSQL client created successfully')

// Create Prisma adapter for libsql
const adapter = new PrismaLibSQL(libsql)

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

  // Hash the admin password
  const hashedPassword = await bcrypt.hash('Admin@123', 10)

  // Create admin user with specified credentials
  const adminUser = await prisma.employee.upsert({
    where: { email: 'admin@baytech.com' },
    update: {},
    create: {
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

  // Create a manager user with Zohed Siddique's name
  const managerPassword = await bcrypt.hash('Manager@123', 10)
  const managerUser = await prisma.employee.upsert({
    where: { email: 'zohed.siddique@baytech.com' },
    update: {},
    create: {
      employeeId: 'MGR001',
      firstName: 'Zohed',
      lastName: 'Siddique',
      email: 'zohed.siddique@baytech.com',
      password: managerPassword,
      position: 'Manager',
      departmentId: managerDepartment.id,
      roleId: managerRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  // Create an employee user
  const employeePassword = await bcrypt.hash('Employee@123', 10)
  const employeeUser = await prisma.employee.upsert({
    where: { email: 'employee@baytech.com' },
    update: {},
    create: {
      employeeId: 'EMP001',
      firstName: 'Regular',
      lastName: 'Employee',
      email: 'employee@baytech.com',
      password: employeePassword,
      position: 'Staff Member',
      departmentId: employeeDepartment.id,
      roleId: employeeRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  console.log('✅ Turso database seeded successfully!')
  console.log('Company:', company.name)
  console.log('Admin User:', `${adminUser.firstName} ${adminUser.lastName}`)
  console.log('Manager User:', `${managerUser.firstName} ${managerUser.lastName}`)
  console.log('Employee User:', `${employeeUser.firstName} ${employeeUser.lastName}`)
  console.log('Emails: admin@baytech.com, zohed.siddique@baytech.com, employee@baytech.com')
  console.log('Passwords: Admin@123, Manager@123, Employee@123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Turso database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

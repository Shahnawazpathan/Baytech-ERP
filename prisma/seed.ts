import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

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

  // Create default department
  const department = await prisma.department.upsert({
    where: { id: 'default-dept' },
    update: {},
    create: {
      id: 'default-dept',
      name: 'Administration',
      companyId: company.id,
    },
  })

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { id: 'admin-role' },
    update: {},
    create: {
      id: 'admin-role',
      name: 'Administrator',
      description: 'Full system access with all permissions',
      companyId: company.id,
    },
  })

  const managerRole = await prisma.role.upsert({
    where: { id: 'manager-role' },
    update: {},
    create: {
      id: 'manager-role',
      name: 'Manager',
      description: 'Manager with access to employees, leads, and reports',
      companyId: company.id,
    },
  })

  const employeeRole = await prisma.role.upsert({
    where: { id: 'employee-role' },
    update: {},
    create: {
      id: 'employee-role',
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

  // Create permissions in the database
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
  const employeePermissions = allPermissions.filter(perm => 
    (perm.resource === 'employee' && perm.action === 'READ' && perm.action === 'UPDATE') ||
    (perm.resource === 'attendance' && perm.action === 'CREATE') ||  // Can clock in/out
    (perm.resource === 'lead' && perm.action === 'READ') ||  // Can view leads assigned to them
    (perm.resource === 'report' && perm.action === 'READ')    // Can view personal reports
  )
  
  // Actually, let's be more specific with employee permissions
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
      id: 'admin-user',
      employeeId: 'ADMIN001',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@baytech.com',
      password: hashedPassword,
      position: 'System Administrator',
      departmentId: department.id,
      roleId: adminRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  // Create a manager user
  const managerPassword = await bcrypt.hash('Manager@123', 10)
  const managerUser = await prisma.employee.upsert({
    where: { email: 'manager@baytech.com' },
    update: {},
    create: {
      id: 'manager-user',
      employeeId: 'MGR001',
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@baytech.com',
      password: managerPassword,
      position: 'Department Manager',
      departmentId: department.id,
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
      id: 'employee-user',
      employeeId: 'EMP001',
      firstName: 'Regular',
      lastName: 'Employee',
      email: 'employee@baytech.com',
      password: employeePassword,
      position: 'Staff Member',
      departmentId: department.id,
      roleId: employeeRole.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log('Company:', company.name)
  console.log('Admin User:', `${adminUser.firstName} ${adminUser.lastName}`)
  console.log('Manager User:', `${managerUser.firstName} ${managerUser.lastName}`)
  console.log('Employee User:', `${employeeUser.firstName} ${employeeUser.lastName}`)
  console.log('Emails: admin@baytech.com, manager@baytech.com, employee@baytech.com')
  console.log('Passwords: Admin@123, Manager@123, Employee@123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
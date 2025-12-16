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
    console.log('🧹 Clearing existing data (attendance, leads, tasks, notifications, employees)...')
    await client.execute(`DELETE FROM attendance`);
    await client.execute(`DELETE FROM lead_history`);
    await client.execute(`DELETE FROM leads`);
    await client.execute(`DELETE FROM tasks`);
    await client.execute(`DELETE FROM notifications`);
    await client.execute(`DELETE FROM audit_logs`);
    await client.execute(`DELETE FROM employees`);

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
    const employeePassword = await bcrypt.hash('Employee@123', 10)

    const adminUsers = [
      { id: 'admin-ehsan', employeeId: 'ADM001', firstName: 'Ehsan', lastName: 'Admin', email: 'ehsan@baytech-uae.com' },
      { id: 'admin-main', employeeId: 'ADM002', firstName: 'System', lastName: 'Admin', email: 'admin@baytech-uae.com' },
    ]

    const employeeUsers = [
      { id: 'emp-zoheb', employeeId: 'EMP101', firstName: 'Zoheb', lastName: 'User', email: 'zoheb@baytech-uae.com' },
      { id: 'emp-ragab', employeeId: 'EMP102', firstName: 'Ragab', lastName: 'User', email: 'ragab@baytech-uae.com' },
      { id: 'emp-adem', employeeId: 'EMP103', firstName: 'Adem', lastName: 'User', email: 'adem@baytech-uae.com' },
      { id: 'emp-gail', employeeId: 'EMP104', firstName: 'Gail', lastName: 'User', email: 'gail@baytech-uae.com' },
    ]

    for (const admin of adminUsers) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO employees (id, employeeId, firstName, lastName, email, password, position, departmentId, roleId, hireDate, status, companyId, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          admin.id,
          admin.employeeId,
          admin.firstName,
          admin.lastName,
          admin.email,
          adminPassword,
          'Administrator',
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
    }

    for (const emp of employeeUsers) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO employees (id, employeeId, firstName, lastName, email, password, position, departmentId, roleId, hireDate, status, companyId, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          emp.id,
          emp.employeeId,
          emp.firstName,
          emp.lastName,
          emp.email,
          employeePassword,
          'Employee',
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
    }

    console.log('✅ Users created')
    console.log('\n📊 Seed Summary:')
    console.log('Company: Baytech Mortgage')
    console.log('Admins:')
    console.log('  - ehsan@baytech-uae.com (Password: Admin@123)')
    console.log('  - admin@baytech-uae.com (Password: Admin@123)')
    console.log('Employees:')
    console.log('  - zoheb@baytech-uae.com (Password: Employee@123)')
    console.log('  - ragab@baytech-uae.com (Password: Employee@123)')
    console.log('  - adem@baytech-uae.com (Password: Employee@123)')
    console.log('  - gail@baytech-uae.com (Password: Employee@123)')
    console.log('\n✅ Turso database seeded successfully!')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

seed()

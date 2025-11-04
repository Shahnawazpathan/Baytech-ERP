import { db } from '@/lib/db'
import bcrypt from 'bcrypt'

export async function initializeSystem() {
  console.log('🔍 Checking system initialization...')
  
  try {
    // Check if the default company exists
    let company = await db.company.findUnique({
      where: { id: 'default-company' }
    })
    
    if (!company) {
      console.log('🏢 Creating default company...')
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
      console.log('✅ Default company created')
    } else {
      console.log('✅ Default company already exists')
    }

    // Ensure departments exist
    const departments = [
      { name: 'Admin', id: 'admin-dept' },
      { name: 'Manager', id: 'manager-dept' },
      { name: 'Employee', id: 'employee-dept' },
    ]

    for (const dept of departments) {
      const existingDept = await db.department.findUnique({
        where: { 
          companyId_name: {
            companyId: company.id,
            name: dept.name,
          }
        }
      })
      
      if (!existingDept) {
        await db.department.create({
          data: {
            id: dept.id,
            name: dept.name,
            companyId: company.id,
          },
        })
        console.log(`✅ Department "${dept.name}" created`)
      } else {
        console.log(`✅ Department "${dept.name}" already exists`)
      }
    }

    // Ensure roles exist
    const roles = [
      { 
        name: 'Administrator', 
        description: 'Full system access with all permissions' 
      },
      { 
        name: 'Manager', 
        description: 'Manager with access to employees, leads, and reports' 
      },
      { 
        name: 'Employee', 
        description: 'Basic employee with access to assigned leads and attendance' 
      },
    ]

    for (const role of roles) {
      const existingRole = await db.role.findUnique({
        where: { 
          companyId_name: {
            companyId: company.id,
            name: role.name,
          }
        }
      })
      
      if (!existingRole) {
        await db.role.create({
          data: {
            name: role.name,
            description: role.description,
            companyId: company.id,
          },
        })
        console.log(`✅ Role "${role.name}" created`)
      } else {
        console.log(`✅ Role "${role.name}" already exists`)
      }
    }

    // Get or create admin department and role
    const adminDepartment = await db.department.findUnique({
      where: { 
        companyId_name: {
          companyId: company.id,
          name: 'Admin',
        }
      }
    })
    
    const adminRole = await db.role.findUnique({
      where: { 
        companyId_name: {
          companyId: company.id,
          name: 'Administrator',
        }
      }
    })

    // Check if admin user exists
    const adminUser = await db.employee.findUnique({
      where: { email: 'admin@baytech.com' }
    })

    if (!adminUser) {
      console.log('🔐 Creating admin user...')
      const hashedPassword = await bcrypt.hash('Admin@123', 10)
      
      await db.employee.create({
        data: {
          employeeId: 'ADMIN001',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@baytech.com',
          password: hashedPassword,
          position: 'System Administrator',
          departmentId: adminDepartment!.id,
          roleId: adminRole!.id,
          hireDate: new Date(),
          status: 'ACTIVE',
          companyId: company.id,
        },
      })
      
      console.log('✅ Admin user created')
      console.log('📧 Email: admin@baytech.com')
      console.log('🔑 Password: Admin@123')
    } else {
      console.log('✅ Admin user already exists')
    }
    
    // Ensure permissions exist (this could be expanded to include all required permissions)
    const permissionResources = ['employee', 'lead', 'attendance', 'department', 'role', 'report', 'notification']
    const permissionActions = ['CREATE', 'READ', 'UPDATE', 'DELETE']
    
    for (const resource of permissionResources) {
      for (const action of permissionActions) {
        // Skip DELETE for some resources that shouldn't be deletable in basic setup
        if (resource === 'employee' && action === 'DELETE') continue
        if (resource === 'company' && action === 'DELETE') continue
        
        try {
          await db.permission.upsert({
            where: {
              companyId_resource_action: {
                companyId: company.id,
                resource,
                action
              }
            },
            update: {},
            create: {
              name: `${action}_${resource.toUpperCase()}`,
              resource,
              action,
              description: `Allow to ${action.toLowerCase()} ${resource}`,
              companyId: company.id,
            }
          })
        } catch (error) {
          // Permission might already exist due to a different constraint, which is fine
          console.log(`⚠️  Could not create permission: ${resource} ${action}`)
        }
      }
    }
    
    console.log('✅ System initialization completed successfully!')
    return true
    
  } catch (error) {
    console.error('❌ Error during system initialization:', error)
    return false
  }
}
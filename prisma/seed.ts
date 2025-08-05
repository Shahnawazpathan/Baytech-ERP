import { PrismaClient } from '@prisma/client'

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
      description: 'Mgage ERP System',
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

  // Create default role
  const role = await prisma.role.upsert({
    where: { id: 'default-role' },
    update: {},
    create: {
      id: 'default-role',
      name: 'Administrator',
      companyId: company.id,
    },
  })

  // Create default employee (admin user)
  const employee = await prisma.employee.upsert({
    where: { id: 'default-employee' },
    update: {},
    create: {
      id: 'default-employee',
      employeeId: 'EMP001',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@baytechmortgage.com',
      position: 'System Administrator',
      departmentId: department.id,
      roleId: role.id,
      hireDate: new Date(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log('Company:', company.name)
  console.log('Employee:', `${employee.firstName} ${employee.lastName}`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
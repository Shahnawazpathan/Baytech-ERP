import { NextRequest, NextResponse } from 'next/server'

// Mock database - in a real app, this would be connected to a real database
let employees = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@company.com",
    phone: "555-0101",
    position: "Sales Manager",
    department: "Sales",
    status: "ACTIVE",
    hireDate: "2022-01-15",
    address: "123 Main St, City, State"
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob@company.com",
    phone: "555-0102",
    position: "Software Developer",
    department: "IT",
    status: "ACTIVE",
    hireDate: "2022-03-20",
    address: "456 Oak Ave, City, State"
  }
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const department = searchParams.get('department') || 'ALL'
  const status = searchParams.get('status') || 'ALL'

  try {
    let filteredEmployees = employees.filter(employee => {
      const matchesSearch = employee.name.toLowerCase().includes(search.toLowerCase()) ||
                           employee.email.toLowerCase().includes(search.toLowerCase()) ||
                           employee.position.toLowerCase().includes(search.toLowerCase())
      const matchesDepartment = department === 'ALL' || employee.department === department
      const matchesStatus = status === 'ALL' || employee.status === status
      return matchesSearch && matchesDepartment && matchesStatus
    })

    return NextResponse.json({
      success: true,
      data: filteredEmployees,
      total: filteredEmployees.length
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, position, department, address } = body

    if (!name || !email || !position || !department) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const newEmployee = {
      id: employees.length + 1,
      name,
      email,
      phone: phone || '',
      position,
      department,
      status: 'ACTIVE',
      hireDate: new Date().toISOString().split('T')[0],
      address: address || ''
    }

    employees.push(newEmployee)

    return NextResponse.json({
      success: true,
      data: newEmployee,
      message: 'Employee created successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}
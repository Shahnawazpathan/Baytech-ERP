import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const companyId = request.headers.get('x-company-id') || 'default-company'
    
    // Check permission to READ employees
    if (userId) {
      const canRead = await hasPermission(userId, 'employee', 'READ')
      if (!canRead) {
        return NextResponse.json(
          { error: 'Insufficient permissions to view employees' },
          { status: 403 }
        )
      }
    }
    
    let whereClause: any = { 
      companyId,
      isActive: true
    };
    
    // If it's not an admin, only show employees from same department or subordinates
    if (userId) {
      const requestingUser = await db.employee.findUnique({
        where: { id: userId },
        include: { role: true }
      });
      
      // If user is not an admin, only return their own record or subordinates
      if (requestingUser?.role?.name !== 'Administrator') {
        whereClause = {
          ...whereClause,
          OR: [
            { id: userId }, // Own record
            { managerId: userId } // Direct reports
          ]
        }
      }
    }

    // Optimize: Use select to fetch only necessary fields
    const employees = await db.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        position: true,
        salary: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true
          }
        },
        role: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the expected format
    const transformedEmployees = employees.map(emp => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      phone: emp.phone,
      position: emp.position,
      department: emp.department?.name || 'Unknown',
      departmentId: emp.departmentId,
      status: emp.status,
      hireDate: emp.hireDate,
      address: emp.address || '',
      firstName: emp.firstName,
      lastName: emp.lastName,
      isActive: emp.isActive,
      roleId: emp.roleId
    }))

    return NextResponse.json(transformedEmployees)
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json()
    
    // Check permission to CREATE employees
    if (!userId || !(await hasPermission(userId, 'employee', 'CREATE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create employees' },
        { status: 403 }
      )
    }
    
    // Create a new employee
    const employee = await db.employee.create({
      data: {
        employeeId: `EMP${Date.now()}`, // Generate employee ID
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        position: body.position,
        departmentId: body.departmentId,
        roleId: body.roleId,
        companyId: body.companyId,
        hireDate: new Date(body.hireDate),
        address: body.address,
        status: 'ACTIVE',
        isActive: true
      },
      include: {
        department: true,
        role: true
      }
    })

    // Transform the created employee to match expected format
    const transformedEmployee = {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department?.name || 'Unknown',
      departmentId: employee.departmentId,
      status: employee.status,
      hireDate: employee.hireDate,
      address: employee.address || '',
      firstName: employee.firstName,
      lastName: employee.lastName,
      isActive: employee.isActive,
      roleId: employee.roleId
    }

    return NextResponse.json(transformedEmployee)
  } catch (error) {
    console.error('Error creating employee:', error)
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}
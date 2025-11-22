import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/rbac'

// Update an employee
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = request.headers.get('x-user-id');
    const { id } = await params;
    const body = await request.json()
    
    // Check permission to UPDATE employees
    if (!userId || !(await hasPermission(userId, 'employee', 'UPDATE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update employee' },
        { status: 403 }
      )
    }
    
    // Check if employee exists
    const existingEmployee = await db.employee.findUnique({
      where: { id }
    })
    
    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }
    
    // Additional check: only allow updating if user is admin or updating their own record
    if (userId) {
      const requestingUser = await db.employee.findUnique({
        where: { id: userId },
        include: { role: true }
      });
      
      // If not admin, only allow updating own record
      if (requestingUser?.role?.name !== 'Administrator' && userId !== id) {
        return NextResponse.json(
          { error: 'Cannot update other employee records' },
          { status: 403 }
        )
      }
    }
    
    // Update the employee
    const updatedEmployee = await db.employee.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        position: body.position,
        departmentId: body.departmentId,
        roleId: body.roleId,
        address: body.address,
        status: body.status,
        hireDate: new Date(body.hireDate),
        updatedAt: new Date()
      },
      include: {
        department: true,
        role: true
      }
    })

    // Transform the updated employee to match expected format
    const transformedEmployee = {
      id: updatedEmployee.id,
      name: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
      email: updatedEmployee.email,
      phone: updatedEmployee.phone,
      position: updatedEmployee.position,
      department: updatedEmployee.department?.name || 'Unknown',
      departmentId: updatedEmployee.departmentId,
      roleId: updatedEmployee.roleId,
      status: updatedEmployee.status,
      hireDate: updatedEmployee.hireDate,
      address: updatedEmployee.address || '',
      firstName: updatedEmployee.firstName,
      lastName: updatedEmployee.lastName,
    }

    return NextResponse.json(transformedEmployee)
  } catch (error) {
    console.error('Error updating employee:', error)
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    )
  }
}

// Get a single employee
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = request.headers.get('x-user-id');
    const id = params.id;

    // Check permission to READ employees
    if (userId) {
      const canRead = await hasPermission(userId, 'employee', 'READ')
      if (!canRead) {
        return NextResponse.json(
          { error: 'Insufficient permissions to view employee' },
          { status: 403 }
        )
      }
    }
    
    let includeClause = {
      department: true,
      role: true
    };
    
    // Fetch employee
    let employee = null;
    
    if (userId) {
      const requestingUser = await db.employee.findUnique({
        where: { id: userId },
        include: { role: true }
      });
      
      // If user is admin, can see any employee
      if (requestingUser?.role?.name === 'Administrator') {
        employee = await db.employee.findUnique({
          where: { id },
          include: includeClause
        });
      } else {
        // Otherwise, can only see own record
        if (userId === id) {
          employee = await db.employee.findUnique({
            where: { id },
            include: includeClause
          });
        } else {
          return NextResponse.json(
            { error: 'Insufficient permissions to view this employee' },
            { status: 403 }
          );
        }
      }
    } else {
      // If no user ID provided, only show public information
      employee = await db.employee.findUnique({
        where: { id },
        include: includeClause
      });
    }

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Transform the employee to match expected format
    const transformedEmployee = {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department?.name || 'Unknown',
      departmentId: employee.departmentId,
      roleId: employee.roleId,
      status: employee.status,
      hireDate: employee.hireDate,
      address: employee.address || '',
      firstName: employee.firstName,
      lastName: employee.lastName,
    }

    return NextResponse.json(transformedEmployee)
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    )
  }
}
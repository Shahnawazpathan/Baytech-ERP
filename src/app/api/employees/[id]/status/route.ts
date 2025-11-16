import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/rbac'

// Update employee status (activate/deactivate)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = request.headers.get('x-user-id');
    const id = params.id;
    const { status } = await request.json()
    
    // Check permission to UPDATE employees
    if (!userId || !(await hasPermission(userId, 'employee', 'UPDATE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update employee status' },
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
    
    // Additional check: only allow updating if user is admin or a manager updating their subordinates
    if (userId) {
      const requestingUser = await db.employee.findUnique({
        where: { id: userId },
        include: { role: true }
      });
      
      // If not admin/manager, don't allow status changes
      if (requestingUser?.role?.name !== 'Administrator' && 
          requestingUser?.role?.name !== 'Manager') {
        return NextResponse.json(
          { error: 'Insufficient permissions to update employee status' },
          { status: 403 }
        )
      }
    }
    
    // Update the employee status
    const updatedEmployee = await db.employee.update({
      where: { id },
      data: {
        status: status,
        isActive: status === 'ACTIVE',
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
      isActive: updatedEmployee.isActive,
      hireDate: updatedEmployee.hireDate,
      address: updatedEmployee.address || '',
      firstName: updatedEmployee.firstName,
      lastName: updatedEmployee.lastName,
    }

    return NextResponse.json(transformedEmployee)
  } catch (error) {
    console.error('Error updating employee status:', error)
    return NextResponse.json(
      { error: 'Failed to update employee status' },
      { status: 500 }
    )
  }
}
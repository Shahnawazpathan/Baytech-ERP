import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/rbac'
import { invalidateCache } from '@/lib/cache'
import { getSessionUser } from '@/lib/auth'

const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'SUSPENDED']

// Update employee status (activate/deactivate)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = sessionUser.id
    const companyId = sessionUser.companyId
    const { id } = await params;
    const body = await request.json()
    const status = typeof body?.status === 'string' ? body.status.toUpperCase() : null

    // Check permission to UPDATE employees
    if (!(await hasPermission(userId, 'employee', 'UPDATE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update employee status' },
        { status: 403 }
      )
    }

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if employee exists (scoped to caller's company)
    const existingEmployee = await db.employee.findFirst({
      where: { id, companyId },
    })

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Additional check: only allow updating if user is admin or a manager updating their subordinates
    const requestingUser = await db.employee.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    const roleNameLower = requestingUser?.role?.name.toLowerCase() || ''
    const isAdminOrManager = roleNameLower.includes('admin') || roleNameLower.includes('manager')
    const isOwnSubordinate = existingEmployee.managerId === userId

    if (!isAdminOrManager && !isOwnSubordinate) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update employee status' },
        { status: 403 }
      )
    }

    // Update the employee status
    const updatedEmployee = await db.employee.update({
      where: { id },
      data: {
        status,
        isActive: status === 'TERMINATED' ? false : true,
        ...(status === 'TERMINATED' && { terminationDate: new Date() }),
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

    invalidateCache('employees', existingEmployee.companyId)

    return NextResponse.json(transformedEmployee)
  } catch (error) {
    console.error('Error updating employee status:', error)
    return NextResponse.json(
      { error: 'Failed to update employee status' },
      { status: 500 }
    )
  }
}

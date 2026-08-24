import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission, invalidateUserPermissions } from '@/lib/rbac'
import { invalidateCache } from '@/lib/cache'
import { getSessionUser } from '@/lib/auth'

// Update an employee
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = sessionUser.id
    const companyId = sessionUser.companyId
    const { id } = await params;
    const body = await request.json()

    // Check permission to UPDATE employees
    if (!(await hasPermission(userId, 'employee', 'UPDATE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update employee' },
        { status: 403 }
      )
    }

    // Check if employee exists (scoped to caller's company)
    const existingEmployee = await db.employee.findFirst({
      where: { id, companyId },
      include: { role: true },
    })

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Prevent privilege escalation: role/department must belong to the same company.
    // Only Administrators may change someone's role.
    if (body.roleId || body.departmentId) {
      const [role, department] = await Promise.all([
        body.roleId ? db.role.findFirst({ where: { id: body.roleId, companyId } }) : null,
        body.departmentId ? db.department.findFirst({ where: { id: body.departmentId, companyId } }) : null,
      ])
      if (body.roleId && !role) {
        return NextResponse.json({ error: 'Invalid role for this company' }, { status: 400 })
      }
      if (body.departmentId && !department) {
        return NextResponse.json({ error: 'Invalid department for this company' }, { status: 400 })
      }

      if (
        (body.roleId && body.roleId !== existingEmployee.roleId) ||
        (body.status && body.status !== existingEmployee.status)
      ) {
        const isAdministrator = !!existingEmployee.role?.name.toLowerCase().includes('admin')
        if (!isAdministrator) {
          return NextResponse.json(
            { error: 'Only administrators can change roles or status' },
            { status: 403 }
          )
        }
      }
    }

    // Update the employee
    const updatedEmployee = await db.employee.update({
      where: { id },
      data: {
        ...(typeof body.firstName === 'string' && { firstName: body.firstName }),
        ...(typeof body.lastName === 'string' && { lastName: body.lastName }),
        ...(typeof body.email === 'string' && { email: body.email }),
        ...(typeof body.phone === 'string' && { phone: body.phone }),
        ...(typeof body.position === 'string' && { position: body.position }),
        ...(body.roleId && { roleId: body.roleId }),
        ...(body.departmentId && { departmentId: body.departmentId }),
        ...(typeof body.address === 'string' && { address: body.address }),
        ...(typeof body.status === 'string' && { status: body.status }),
        ...(body.hireDate && !isNaN(Date.parse(body.hireDate)) && { hireDate: new Date(body.hireDate) }),
        updatedAt: new Date(),
        ...(body.autoAssignEnabled !== undefined && { autoAssignEnabled: Boolean(body.autoAssignEnabled) })
      },
      include: {
        department: true,
        role: true
      }
    })

    // Permission cache must be invalidated immediately when a role changes,
    // otherwise revoked/elevated privileges linger for up to 5 minutes.
    if (body.roleId && body.roleId !== existingEmployee.roleId) {
      invalidateUserPermissions(id)
      invalidateCache('employees', companyId)
    }

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
      autoAssignEnabled: updatedEmployee.autoAssignEnabled,
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

// Delete an employee
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(request)
    const userId = sessionUser?.id
    const { id } = await params;

    if (!sessionUser || !userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const requestingUser = await db.employee.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    const isAdministrator = !!requestingUser?.role?.name.toLowerCase().includes('admin')
    const canDelete = await hasPermission(userId, 'employee', 'DELETE')

    if (!isAdministrator && !canDelete) {
      return NextResponse.json(
        { error: 'Only administrators can delete employees' },
        { status: 403 }
      )
    }

    const existingEmployee = await db.employee.findFirst({
      where: {
        id,
        companyId: sessionUser.companyId,
      },
      include: {
        role: true,
      },
    });
    if (!existingEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (id === userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    if (existingEmployee.status === 'TERMINATED' || !existingEmployee.isActive) {
      return NextResponse.json({ success: true, message: 'Employee is already deleted' })
    }

    await db.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          isActive: false,
          status: 'TERMINATED',
          autoAssignEnabled: false,
          terminationDate: new Date(),
          updatedAt: new Date(),
        },
      })

      await tx.lead.updateMany({
        where: {
          assignedToId: id,
          companyId: sessionUser.companyId,
          status: 'NEW',
          contactedAt: null,
        },
        data: {
          assignedToId: null,
          assignedAt: null,
          updatedAt: new Date(),
        },
      })
    })

    invalidateCache('employees', existingEmployee.companyId)
    invalidateCache('leads', existingEmployee.companyId)
    invalidateCache('pool', existingEmployee.companyId)

    return NextResponse.json({ success: true, message: 'Employee deleted successfully' })
  } catch (error) {
    console.error('Error deleting employee:', error)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}

// Get a single employee
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = sessionUser.id
    const companyId = sessionUser.companyId
    const { id } = await params;

    // Check permission to READ employees
    const canRead = await hasPermission(userId, 'employee', 'READ')
    if (!canRead) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view employee' },
        { status: 403 }
      )
    }

    // Fetch employee scoped to caller's company
    const employee: any = await db.employee.findFirst({
      where: { id, companyId },
      include: {
        department: true,
        role: true,
      },
    })

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
      autoAssignEnabled: employee.autoAssignEnabled,
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

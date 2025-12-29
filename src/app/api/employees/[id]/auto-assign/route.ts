import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/rbac'
import { invalidateCache } from '@/lib/cache'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = request.headers.get('x-user-id')
    const { id } = await params
    const { autoAssignEnabled } = await request.json()

    if (typeof autoAssignEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'autoAssignEnabled must be a boolean' },
        { status: 400 }
      )
    }

    if (!userId || !(await hasPermission(userId, 'employee', 'UPDATE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update auto-assign' },
        { status: 403 }
      )
    }

    const requestingUser = await db.employee.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (requestingUser?.role?.name !== 'Administrator' && requestingUser?.role?.name !== 'Manager') {
      return NextResponse.json(
        { error: 'Insufficient permissions to update auto-assign' },
        { status: 403 }
      )
    }

    const existingEmployee = await db.employee.findUnique({
      where: { id }
    })

    if (!existingEmployee || !existingEmployee.isActive) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    const updatedEmployee = await db.employee.update({
      where: { id },
      data: {
        autoAssignEnabled,
        updatedAt: new Date()
      }
    })

    invalidateCache('employees', existingEmployee.companyId)

    return NextResponse.json({
      id: updatedEmployee.id,
      autoAssignEnabled: updatedEmployee.autoAssignEnabled
    })
  } catch (error) {
    console.error('Error updating auto-assign:', error)
    return NextResponse.json(
      { error: 'Failed to update auto-assign' },
      { status: 500 }
    )
  }
}

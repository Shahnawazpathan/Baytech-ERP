import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { getSessionUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const autoAssignEnabled = body?.autoAssignEnabled

    if (typeof autoAssignEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'autoAssignEnabled must be a boolean' },
        { status: 400 }
      )
    }

    // Only admins/managers may toggle this, and only within their own company
    const roleLower = sessionUser.role.toLowerCase()
    if (!roleLower.includes('admin') && !roleLower.includes('manager')) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update auto-assign' },
        { status: 403 }
      )
    }

    const existingEmployee = await db.employee.findFirst({
      where: { id, companyId: sessionUser.companyId },
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

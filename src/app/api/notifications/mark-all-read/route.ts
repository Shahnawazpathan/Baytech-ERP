import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

// Mark all notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update all unread notifications for the session user/company
    const whereClause: any = {
      companyId: sessionUser.companyId,
      isRead: false,
      OR: [
        { employeeId: sessionUser.id },
        { employeeId: null } // Include company-wide notifications
      ]
    }

    const updatedNotifications = await db.notification.updateMany({
      where: whereClause,
      data: { isRead: true }
    })

    return NextResponse.json({ 
      message: 'Notifications marked as read', 
      updatedCount: updatedNotifications.count 
    })
  } catch (error) {
    console.error('Error marking notifications as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Mark all notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const companyId = request.headers.get('x-company-id') || 'default-company'
    
    // Update all unread notifications for the user/company
    const whereClause: any = { 
      companyId, 
      isRead: false,
      isActive: true
    }
    
    if (userId) {
      whereClause.OR = [
        { employeeId: userId },
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
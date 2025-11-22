import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Mark a single notification as read
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const updatedNotification = await db.notification.update({
      where: { id },
      data: { isRead: true }
    })

    return NextResponse.json(updatedNotification)
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

// Get all notifications for a user
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const companyId = request.headers.get('x-company-id') || 'default-company'
    
    // If we have a specific user ID, get their notifications; otherwise get all company notifications
    const whereClause: any = { companyId }
    if (userId) {
      whereClause.OR = [
        { employeeId: userId },
        { employeeId: null } // Include company-wide notifications
      ]
    }
    
    const notifications = await db.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Transform the data to match the expected format
    const transformedNotifications = notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type.toLowerCase(),
      time: formatTimeAgo(notification.createdAt),
      createdAt: notification.createdAt,
      isRead: notification.isRead
    }))

    return NextResponse.json(transformedNotifications)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffMins > 0) {
    return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  } else {
    return 'Just now'
  }
}
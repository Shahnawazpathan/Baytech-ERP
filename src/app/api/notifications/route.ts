import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const employeeId = searchParams.get('employeeId')
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const isRead = searchParams.get('isRead')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (companyId) {
      where.companyId = companyId
    }
    
    if (employeeId) {
      where.employeeId = employeeId
    } else {
      // If no specific employee, show company-wide notifications
      where.employeeId = null
    }
    
    if (type) {
      where.type = type
    }
    
    if (category) {
      where.category = category
    }
    
    if (isRead !== null) {
      where.isRead = isRead === 'true'
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        include: {
          company: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: {
          ...where,
          isRead: false
        }
      })
    ])

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      title,
      message,
      type,
      category,
      companyId,
      employeeId,
      metadata,
      isBroadcast = false
    } = body

    // Validate required fields
    if (!title || !message || !type || !category || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let notifications = []

    if (isBroadcast) {
      // Create notification for all employees in the company
      const employees = await db.employee.findMany({
        where: {
          companyId,
          isActive: true,
          status: 'ACTIVE'
        },
        select: { id: true }
      })

      notifications = await Promise.all(
        employees.map(emp => 
          db.notification.create({
            data: {
              title,
              message,
              type,
              category,
              companyId,
              employeeId: emp.id,
              metadata: metadata ? JSON.stringify(metadata) : null
            }
          })
        )
      )
    } else {
      // Create single notification
      const notification = await db.notification.create({
        data: {
          title,
          message,
          type,
          category,
          companyId,
          employeeId,
          metadata: metadata ? JSON.stringify(metadata) : null
        },
        include: {
          company: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })
      notifications = [notification]
    }

    // Send real-time notifications via WebSocket if available
    try {
      const { getIO } = await import('@/lib/socket')
      const io = getIO()
      
      notifications.forEach(notification => {
        if (notification.employeeId) {
          io.to(`employee_${notification.employeeId}`).emit('notification', {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            category: notification.category,
            createdAt: notification.createdAt
          })
        }
      })
    } catch (socketError) {
      console.log('WebSocket not available for real-time notifications')
    }

    return NextResponse.json({
      success: true,
      data: notifications
    })
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

// Bulk mark as read endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationIds, employeeId, markAll = false } = body

    if (markAll && employeeId) {
      // Mark all notifications for employee as read
      const result = await db.notification.updateMany({
        where: {
          employeeId,
          isRead: false
        },
        data: { isRead: true }
      })

      return NextResponse.json({
        success: true,
        data: {
          markedAsRead: result.count,
          message: `Marked ${result.count} notifications as read`
        }
      })
    }

    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Mark specific notifications as read
      const result = await db.notification.updateMany({
        where: {
          id: { in: notificationIds }
        },
        data: { isRead: true }
      })

      return NextResponse.json({
        success: true,
        data: {
          markedAsRead: result.count,
          message: `Marked ${result.count} notifications as read`
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request parameters' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error marking notifications as read:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to mark notifications as read' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      )
    }

    // Get user to check role
    const user = userId ? await db.employee.findUnique({
      where: { id: userId },
      include: { role: true }
    }) : null

    const userRole = user?.role.name || ''
    const roleLower = userRole.toLowerCase()
    const isAdmin = roleLower.includes('admin')
    const isManager = roleLower.includes('manager')

    // Fetch tasks based on role
    let tasks
    if (isAdmin) {
      // Admins can see all tasks
      tasks = await db.task.findMany({
        where: { companyId, isActive: true },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: { select: { name: true } }
            }
          },
          assignedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    } else if (isManager) {
      // Managers see tasks they created and tasks assigned to them
      tasks = await db.task.findMany({
        where: {
          companyId,
          isActive: true,
          OR: [
            { assignedById: userId },
            { assignedToId: userId }
          ]
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: { select: { name: true } }
            }
          },
          assignedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    } else {
      // Employees only see tasks assigned to them
      tasks = await db.task.findMany({
        where: {
          companyId,
          isActive: true,
          assignedToId: userId
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: { select: { name: true } }
            }
          },
          assignedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    }

    // Transform tasks to include formatted data
    const formattedTasks = tasks.map(task => ({
      ...task,
      assignedToName: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
      assignedByName: `${task.assignedBy.firstName} ${task.assignedBy.lastName}`,
      department: task.assignedTo.department?.name || 'Unknown'
    }))

    return NextResponse.json({ success: true, data: formattedTasks })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      priority,
      category,
      dueDate,
      assignedToId,
      tags,
      companyId
    } = body

    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the user creating the task
    const creator = await db.employee.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!creator) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const creatorRole = creator.role.name
    const creatorRoleLower = creatorRole.toLowerCase()
    const creatorIsAdmin = creatorRoleLower.includes('admin')
    const creatorIsManager = creatorRoleLower.includes('manager')

    // Check if user has permission to create tasks (only Admin and Manager)
    if (!creatorIsAdmin && !creatorIsManager) {
      return NextResponse.json(
        { success: false, error: 'Only Admins and Managers can create tasks' },
        { status: 403 }
      )
    }

    // Get the assignee to check their role
    const assignee = await db.employee.findUnique({
      where: { id: assignedToId },
      include: { role: true }
    })

    if (!assignee) {
      return NextResponse.json(
        { success: false, error: 'Assignee not found' },
        { status: 404 }
      )
    }

    const assigneeRole = assignee.role.name
    const assigneeRoleLower = assigneeRole.toLowerCase()

    // If creator is Manager, they can only assign to Employees (not other Managers or Admins)
    if (creatorIsManager && (assigneeRoleLower.includes('admin') || assigneeRoleLower.includes('manager'))) {
      return NextResponse.json(
        { success: false, error: 'Managers can only create tasks for Employees' },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!title || !assignedToId) {
      return NextResponse.json(
        { success: false, error: 'Title and assignee are required' },
        { status: 400 }
      )
    }

    // Create the task
    const task = await db.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        category,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId,
        assignedById: userId,
        companyId: companyId || 'default-company',
        tags: tags ? JSON.stringify(tags) : null,
        status: 'TODO'
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            department: { select: { name: true } }
          }
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Create notification for the assignee
    await db.notification.create({
      data: {
        title: 'New Task Assigned',
        message: `${creator.firstName} ${creator.lastName} assigned you a new task: ${title}`,
        type: 'INFO',
        category: 'TASK',
        companyId: companyId || 'default-company',
        employeeId: assignedToId,
        metadata: JSON.stringify({ taskId: task.id })
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...task,
        assignedToName: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
        assignedByName: `${task.assignedBy.firstName} ${task.assignedBy.lastName}`,
        department: task.assignedTo.department?.name || 'Unknown'
      }
    })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create task' },
      { status: 500 }
    )
  }
}

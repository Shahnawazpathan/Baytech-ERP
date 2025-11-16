import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;

    const task = await db.task.findUnique({
      where: { id },
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

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

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
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch task' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await request.json()
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the existing task
    const existingTask = await db.task.findUnique({
      where: { id },
      include: {
        assignedBy: { include: { role: true } }
      }
    })

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    // Get current user
    const currentUser = await db.employee.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const userRole = currentUser.role.name

    // Check permissions:
    // - Task creator can update their task
    // - Admin can update any task
    // - Assignee can update task status only
    const isCreator = existingTask.assignedById === userId
    const isAdmin = userRole === 'Admin'
    const isAssignee = existingTask.assignedToId === userId

    if (!isCreator && !isAdmin && !isAssignee) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to update this task' },
        { status: 403 }
      )
    }

    // If user is only assignee (not creator or admin), they can only update status
    const updateData: any = {}

    if (isAssignee && !isCreator && !isAdmin) {
      // Assignee can only update status
      if (body.status) {
        updateData.status = body.status
        if (body.status === 'DONE') {
          updateData.completedAt = new Date()
        }
      }
    } else {
      // Creator or Admin can update everything
      if (body.title !== undefined) updateData.title = body.title
      if (body.description !== undefined) updateData.description = body.description
      if (body.status !== undefined) {
        updateData.status = body.status
        if (body.status === 'DONE' && !existingTask.completedAt) {
          updateData.completedAt = new Date()
        } else if (body.status !== 'DONE') {
          updateData.completedAt = null
        }
      }
      if (body.priority !== undefined) updateData.priority = body.priority
      if (body.category !== undefined) updateData.category = body.category
      if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
      if (body.tags !== undefined) updateData.tags = body.tags ? JSON.stringify(body.tags) : null
    }

    const updatedTask = await db.task.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({
      success: true,
      data: {
        ...updatedTask,
        assignedToName: `${updatedTask.assignedTo.firstName} ${updatedTask.assignedTo.lastName}`,
        assignedByName: `${updatedTask.assignedBy.firstName} ${updatedTask.assignedBy.lastName}`,
        department: updatedTask.assignedTo.department?.name || 'Unknown'
      }
    })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the task
    const task = await db.task.findUnique({
      where: { id }
    })

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    // Get current user
    const currentUser = await db.employee.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const userRole = currentUser.role.name

    // Only task creator or admin can delete tasks
    const isCreator = task.assignedById === userId
    const isAdmin = userRole === 'Admin'

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only task creator or admin can delete tasks' },
        { status: 403 }
      )
    }

    // Soft delete by setting isActive to false
    await db.task.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}

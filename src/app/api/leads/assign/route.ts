import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/rbac'

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json()
    const { leadId, employeeId, notes } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    if (!leadId || !employeeId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check permission to assign leads
    const hasPermissionResult = await hasPermission(userId, 'lead', 'UPDATE');
    if (!hasPermissionResult) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to assign leads' },
        { status: 403 }
      );
    }

    // Get lead and employee
    const [lead, employee] = await Promise.all([
      db.lead.findUnique({
        where: { id: leadId },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      db.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyId: true
        }
      })
    ])

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Update lead assignment
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: { 
        assignedToId: employeeId,
        assignedAt: new Date() // Set the assignment timestamp
      },
      include: {
        company: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Create lead history
    await db.leadHistory.create({
      data: {
        leadId,
        employeeId,
        action: 'ASSIGNED',
        oldValue: JSON.stringify({ 
          assignedToId: lead.assignedToId,
          assignedToName: lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : null
        }),
        newValue: JSON.stringify({ 
          assignedToId: employeeId,
          assignedToName: `${employee.firstName} ${employee.lastName}`
        }),
        notes: notes || `Assigned to ${employee.firstName} ${employee.lastName}`
      }
    })

    // Create notification for assigned employee
    await db.notification.create({
      data: {
        title: 'New Lead Assigned',
        message: `${lead.firstName} ${lead.lastName} has been assigned to you`,
        type: 'INFO',
        category: 'LEAD',
        companyId: employee.companyId,
        employeeId,
        metadata: JSON.stringify({ leadId, leadNumber: lead.leadNumber })
      }
    })

    // Create notification for previous assignee if different
    if (lead.assignedToId && lead.assignedToId !== employeeId) {
      await db.notification.create({
        data: {
          title: 'Lead Reassigned',
          message: `${lead.firstName} ${lead.lastName} has been reassigned to ${employee.firstName} ${employee.lastName}`,
          type: 'INFO',
          category: 'LEAD',
          companyId: employee.companyId,
          employeeId: lead.assignedToId,
          metadata: JSON.stringify({ leadId, leadNumber: lead.leadNumber })
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedLead
    })
  } catch (error) {
    console.error('Error assigning lead:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to assign lead' },
      { status: 500 }
    )
  }
}

// Bulk assignment endpoint
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json()
    const { leadIds, employeeId, strategy = 'round_robin' } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0 || !employeeId) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters' },
        { status: 400 }
      )
    }

    // Check permission to assign leads
    const hasPermissionResult = await hasPermission(userId, 'lead', 'UPDATE');
    if (!hasPermissionResult) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to assign leads' },
        { status: 403 }
      );
    }

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyId: true
      }
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Get leads to be assigned
    const leads = await db.lead.findMany({
      where: {
        id: { in: leadIds },
        isActive: true
      }
    })

    if (leads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid leads found' },
        { status: 404 }
      )
    }

    // Update all leads
    const updatePromises = leads.map(async (lead) => {
      const updatedLead = await db.lead.update({
        where: { id: lead.id },
        data: { 
          assignedToId: employeeId,
          assignedAt: new Date() // Set the assignment timestamp
        }
      })

      // Create lead history
      await db.leadHistory.create({
        data: {
          leadId: lead.id,
          employeeId,
          action: 'BULK_ASSIGNED',
          oldValue: JSON.stringify({ assignedToId: lead.assignedToId }),
          newValue: JSON.stringify({ assignedToId: employeeId }),
          notes: `Bulk assigned to ${employee.firstName} ${employee.lastName}`
        }
      })

      // Create notification
      await db.notification.create({
        data: {
          title: 'Bulk Lead Assignment',
          message: `${leads.length} leads have been assigned to you`,
          type: 'INFO',
          category: 'LEAD',
          companyId: employee.companyId,
          employeeId,
          metadata: JSON.stringify({ leadIds, count: leads.length })
        }
      })

      return updatedLead
    })

    const updatedLeads = await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      data: {
        assignedLeads: updatedLeads.length,
        employee: `${employee.firstName} ${employee.lastName}`
      }
    })
  } catch (error) {
    console.error('Error in bulk lead assignment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to assign leads' },
      { status: 500 }
    )
  }
}
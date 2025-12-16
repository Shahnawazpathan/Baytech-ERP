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
        where: {
          id: employeeId,
          role: {
            name: {
              not: {
                contains: 'Administrator'
              }
            }
          }
        },
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
    const { leadIds, employeeId, employeeIds, strategy = 'round_robin' } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lead IDs are required' },
        { status: 400 }
      )
    }

    // Support both single employee (employeeId) and multiple employees (employeeIds)
    const targetEmployeeIds = employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0
      ? employeeIds
      : employeeId
        ? [employeeId]
        : null;

    if (!targetEmployeeIds || targetEmployeeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one employee ID is required' },
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

    // Get all employees to assign to (excluding admins)
    const employees = await db.employee.findMany({
      where: {
        id: { in: targetEmployeeIds },
        status: 'ACTIVE',
        isActive: true,
        role: {
          name: {
            not: {
              contains: 'Administrator'
            }
          }
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyId: true
      }
    })

    if (employees.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid employees found' },
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

    // Assign leads based on strategy
    const assignments: { [key: string]: string[] } = {}
    employees.forEach(emp => assignments[emp.id] = [])

    if (strategy === 'round_robin' || strategy === 'equal') {
      // Round-robin distribution
      let employeeIndex = 0
      for (const lead of leads) {
        const employee = employees[employeeIndex]
        assignments[employee.id].push(lead.id)
        employeeIndex = (employeeIndex + 1) % employees.length
      }
    } else if (strategy === 'least_loaded') {
      // Get current lead counts for each employee
      const leadCounts = await Promise.all(
        employees.map(async (emp) => {
          const count = await db.lead.count({
            where: {
              assignedToId: emp.id,
              status: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'APPLICATION'] }
            }
          })
          return { employeeId: emp.id, count }
        })
      )

      // Sort employees by lead count (ascending)
      leadCounts.sort((a, b) => a.count - b.count)

      // Assign leads to employees with least load
      for (const lead of leads) {
        // Find employee with minimum current assignments
        const minEmployee = leadCounts.reduce((min, curr) =>
          curr.count < min.count ? curr : min
        )
        assignments[minEmployee.employeeId].push(lead.id)
        minEmployee.count++ // Increment count for next iteration
      }
    } else {
      // Default to first employee if strategy is unknown
      assignments[employees[0].id] = leadIds
    }

    // Process all assignments using batch operations (transaction)
    const employeeNotifications: { [key: string]: number } = {}
    const now = new Date()

    // Prepare all history records
    const historyRecords: Array<{
      leadId: string;
      employeeId: string;
      action: string;
      oldValue: string;
      newValue: string;
      notes: string;
    }> = []
    const notificationRecords: Array<{
      title: string;
      message: string;
      type: string;
      category: string;
      companyId: string;
      employeeId: string;
      metadata: string;
    }> = []

    for (const employee of employees) {
      const employeeLeadIds = assignments[employee.id]
      if (employeeLeadIds.length === 0) continue

      employeeNotifications[employee.id] = employeeLeadIds.length

      // Prepare history records for this batch
      for (const leadId of employeeLeadIds) {
        const lead = leads.find(l => l.id === leadId)
        if (!lead) continue

        historyRecords.push({
          leadId,
          employeeId: employee.id,
          action: 'BULK_ASSIGNED',
          oldValue: JSON.stringify({ assignedToId: lead.assignedToId }),
          newValue: JSON.stringify({ assignedToId: employee.id }),
          notes: `Bulk assigned to ${employee.firstName} ${employee.lastName} using ${strategy} strategy`
        })
      }

      // Prepare notification for this employee
      notificationRecords.push({
        title: 'Bulk Lead Assignment',
        message: `${employeeLeadIds.length} lead${employeeLeadIds.length > 1 ? 's have' : ' has'} been assigned to you`,
        type: 'INFO',
        category: 'LEAD',
        companyId: employee.companyId,
        employeeId: employee.id,
        metadata: JSON.stringify({
          leadIds: employeeLeadIds,
          count: employeeLeadIds.length,
          strategy
        })
      })
    }

    // Execute all updates in a single transaction
    await db.$transaction([
      // Update all leads in batches per employee
      ...employees.flatMap(employee => {
        const employeeLeadIds = assignments[employee.id]
        if (employeeLeadIds.length === 0) return []

        return [
          db.lead.updateMany({
            where: { id: { in: employeeLeadIds } },
            data: {
              assignedToId: employee.id,
              assignedAt: now
            }
          })
        ]
      }),
      // Create all history records at once
      db.leadHistory.createMany({
        data: historyRecords
      }),
      // Create all notifications at once
      db.notification.createMany({
        data: notificationRecords
      })
    ])

    // Get updated leads for response
    const updatedLeads = await db.lead.findMany({
      where: { id: { in: leadIds } },
      select: {
        id: true,
        leadNumber: true,
        assignedToId: true,
        assignedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        assignedLeads: updatedLeads.length,
        employees: employees.map(emp => `${emp.firstName} ${emp.lastName}`),
        strategy,
        distribution: Object.keys(assignments).map(empId => {
          const emp = employees.find(e => e.id === empId)
          return {
            employee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
            leadCount: assignments[empId].length
          }
        })
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
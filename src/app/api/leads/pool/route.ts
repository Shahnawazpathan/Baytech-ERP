import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { parseLeadMetadata } from '@/lib/lead-metadata'

// Get leads pool
export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // all, unassigned, available
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    let whereClause: any = {
      companyId,
      isActive: true,
      status: 'NEW',
      contactedAt: null
    }

    // Filter based on type
    if (filter === 'unassigned') {
      whereClause.assignedToId = null
    } else if (filter === 'available') {
      // Base filter already limits to NEW, keep for clarity
      whereClause.status = 'NEW'
    } else if (filter === 'reassigned') {
      // Show only leads that were actually auto-reassigned due to no contact
      // These are leads that have a history record of AUTO_REASSIGNED action
      whereClause = {
        companyId,
        isActive: true,
        status: 'NEW',
        contactedAt: null,
        history: {
          some: {
            action: 'AUTO_REASSIGNED'
          }
        }
      }
    }

    // Execute queries in parallel
    let leads, total;

    if (filter === 'reassigned') {
      // For 'reassigned' filter, we need to query leads with AUTO_REASSIGNED history that are still not contacted
      // This requires a different approach since we need to join with lead history
      const leadIds = await db.leadHistory.findMany({
        where: {
          action: 'AUTO_REASSIGNED',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Within last 30 days to optimize
          },
          lead: {
            companyId,
            isActive: true,
            contactedAt: null, // Not contacted yet
            status: 'NEW' // Still active
          }
        },
        select: {
          leadId: true
        },
        distinct: ['leadId'] // Get unique lead IDs
      });

      const leadIdsArray = leadIds.map(l => l.leadId);

      [leads, total] = await Promise.all([
        db.lead.findMany({
          where: {
            id: { in: leadIdsArray },
            contactedAt: null, // Ensure they're still not contacted
            status: 'NEW' // Still active
          },
          select: {
            id: true,
            leadNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            loanAmount: true,
            status: true,
            priority: true,
            source: true,
            creditScore: true,
            address: true,
            assignedToId: true,
            assignedAt: true,
            createdAt: true,
            notes: true,
            metadata: true,
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
          ],
          take: limit,
          skip: skip
        }),
        db.lead.count({
          where: {
            id: { in: leadIdsArray },
            contactedAt: null, // Ensure they're still not contacted
            status: 'NEW' // Still active
          }
        })
      ]);
    } else {
      [leads, total] = await Promise.all([
        db.lead.findMany({
          where: whereClause,
          select: {
            id: true,
            leadNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            loanAmount: true,
            status: true,
            priority: true,
            source: true,
            creditScore: true,
            address: true,
            assignedToId: true,
            assignedAt: true,
            createdAt: true,
            notes: true,
            metadata: true,
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
          ],
          take: limit,
          skip: skip
        }),
        db.lead.count({ where: whereClause })
      ]);
    }

    // Transform the data
    const transformedLeads = leads.map(lead => {
      const metadata = parseLeadMetadata(lead.metadata)
      return {
        id: lead.id,
        leadNumber: lead.leadNumber,
        firstName: lead.firstName,
        lastName: lead.lastName,
        name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        email: lead.email,
        phone: lead.phone,
        loanAmount: lead.loanAmount,
        status: lead.status,
        priority: lead.priority,
        source: lead.source,
        creditScore: lead.creditScore,
        propertyAddress: lead.address,
        assignedTo: lead.assignedTo
          ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
          : 'Unassigned',
        assignedToId: lead.assignedToId,
        assignedAt: lead.assignedAt,
        createdAt: lead.createdAt,
        notes: lead.notes,
        notesStatus: metadata.notesStatus,
        followUpDate: metadata.followUpDate,
        canBeTaken: lead.status === 'NEW' // Only NEW leads can be taken
      }
    })

    return NextResponse.json({
      success: true,
      data: transformedLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching leads pool:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads pool' },
      { status: 500 }
    )
  }
}

// Claim a lead from the pool
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const body = await request.json()
    const { leadId, employeeId, force = false } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    if (!leadId || !employeeId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID and Employee ID are required' },
        { status: 400 }
      )
    }

    // Get the lead
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
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

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Check if lead can be taken
    if (!force && lead.status !== 'NEW') {
      return NextResponse.json(
        {
          success: false,
          error: `Lead cannot be taken. Current status: ${lead.status}. Only NEW leads can be claimed.`
        },
        { status: 400 }
      )
    }

    // Get the employee taking the lead
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

    // Check if employee is trying to take their own lead
    if (lead.assignedToId === employeeId) {
      return NextResponse.json(
        { success: false, error: 'This lead is already assigned to you' },
        { status: 400 }
      )
    }

    const previousAssigneeId = lead.assignedToId
    const previousAssigneeName = lead.assignedTo
      ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
      : 'Unassigned'

    // Update the lead assignment
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: {
        assignedToId: employeeId,
        assignedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
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
        action: previousAssigneeId ? 'CLAIMED_FROM_POOL' : 'CLAIMED_UNASSIGNED',
        oldValue: JSON.stringify({
          assignedToId: previousAssigneeId,
          assignedToName: previousAssigneeName
        }),
        newValue: JSON.stringify({
          assignedToId: employeeId,
          assignedToName: `${employee.firstName} ${employee.lastName}`
        }),
        notes: previousAssigneeId
          ? `Claimed from pool (previously assigned to ${previousAssigneeName})`
          : 'Claimed from pool (was unassigned)'
      }
    })

    // Notify the new assignee
    await db.notification.create({
      data: {
        title: 'Lead Claimed Successfully',
        message: `You have successfully claimed ${lead.firstName} ${lead.lastName} from the leads pool`,
        type: 'SUCCESS',
        category: 'LEAD',
        companyId: employee.companyId,
        employeeId,
        metadata: JSON.stringify({
          leadId,
          leadNumber: lead.leadNumber,
          action: 'claimed'
        })
      }
    })

    // Notify previous assignee if there was one
    if (previousAssigneeId && lead.assignedTo) {
      await db.notification.create({
        data: {
          title: 'Lead Claimed by Another Employee',
          message: `${lead.firstName} ${lead.lastName} has been claimed from the pool by ${employee.firstName} ${employee.lastName}`,
          type: 'WARNING',
          category: 'LEAD',
          companyId: employee.companyId,
          employeeId: previousAssigneeId,
          metadata: JSON.stringify({
            leadId,
            leadNumber: lead.leadNumber,
            claimedBy: employeeId,
            claimedByName: `${employee.firstName} ${employee.lastName}`
          })
        }
      })
    }

    invalidateCache('leads', employee.companyId)

    return NextResponse.json({
      success: true,
      message: 'Lead claimed successfully',
      data: {
        id: updatedLead.id,
        leadNumber: updatedLead.leadNumber,
        name: `${updatedLead.firstName || ''} ${updatedLead.lastName || ''}`.trim(),
        email: updatedLead.email,
        phone: updatedLead.phone,
        status: updatedLead.status,
        priority: updatedLead.priority,
        assignedTo: `${employee.firstName} ${employee.lastName}`,
        assignedToId: employee.id,
        assignedAt: updatedLead.assignedAt,
        previousAssignee: previousAssigneeName
      }
    })
  } catch (error) {
    console.error('Error claiming lead:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to claim lead' },
      { status: 500 }
    )
  }
}

// Return a lead to the pool (unclaim)
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')
    const employeeId = searchParams.get('employeeId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    if (!leadId || !employeeId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID and Employee ID are required' },
        { status: 400 }
      )
    }

    // Get the lead
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        assignedTo: true
      }
    })

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Check if the employee is the current assignee
    if (lead.assignedToId !== employeeId) {
      return NextResponse.json(
        { success: false, error: 'You can only return leads assigned to you' },
        { status: 403 }
      )
    }

    // Update the lead to unassigned
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: {
        assignedToId: null,
        assignedAt: null,
        updatedAt: new Date()
      }
    })

    // Create lead history
    await db.leadHistory.create({
      data: {
        leadId,
        employeeId,
        action: 'RETURNED_TO_POOL',
        oldValue: JSON.stringify({
          assignedToId: employeeId,
          assignedToName: lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : ''
        }),
        newValue: JSON.stringify({
          assignedToId: null,
          assignedToName: 'Pool'
        }),
        notes: 'Lead returned to pool'
      }
    })

    // Notify the employee
    await db.notification.create({
      data: {
        title: 'Lead Returned to Pool',
        message: `${lead.firstName} ${lead.lastName} has been returned to the leads pool`,
        type: 'INFO',
        category: 'LEAD',
        companyId: lead.companyId,
        employeeId,
        metadata: JSON.stringify({
          leadId,
          leadNumber: lead.leadNumber,
          action: 'returned'
        })
      }
    })

    invalidateCache('leads', lead.companyId)

    return NextResponse.json({
      success: true,
      message: 'Lead returned to pool successfully',
      data: updatedLead
    })
  } catch (error) {
    console.error('Error returning lead to pool:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to return lead to pool' },
      { status: 500 }
    )
  }
}

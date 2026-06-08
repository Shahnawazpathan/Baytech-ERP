import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { parseLeadMetadata } from '@/lib/lead-metadata'
import { hasPermission } from '@/lib/rbac'
import { claimLeadSchema } from '@/lib/leads-validation'
import { LEAD_RECLAIM_HOURS } from '@/lib/leads-constants'

/**
 * Get leads pool.
 * Filters:
 *  - all          : every active lead in the pool
 *  - unassigned   : never assigned
 *  - available    : unassigned OR assigned > LEAD_RECLAIM_HOURS ago without contact
 *  - reassigned   : currently assigned but overdue (eligible for claim)
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const eightHoursAgo = new Date(Date.now() - LEAD_RECLAIM_HOURS * 60 * 60 * 1000)

    const baseWhere = {
      companyId,
      isActive: true,
      status: 'NEW',
      contactedAt: null,
      OR: [
        { assignedToId: null },
        { assignedAt: { lte: eightHoursAgo } },
      ],
    }

    let whereClause: any = baseWhere
    if (filter === 'unassigned') {
      whereClause = {
        companyId,
        isActive: true,
        status: 'NEW',
        contactedAt: null,
        assignedToId: null,
      }
    } else if (filter === 'available') {
      whereClause = baseWhere
    } else if (filter === 'reassigned') {
      whereClause = {
        companyId,
        isActive: true,
        status: 'NEW',
        contactedAt: null,
        assignedToId: { not: null },
        assignedAt: { lte: eightHoursAgo },
      }
    }

    const [leads, total] = await Promise.all([
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
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip,
      }),
      db.lead.count({ where: whereClause }),
    ])

    const transformedLeads = leads.map((lead) => {
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
        canBeTaken: lead.status === 'NEW',
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
        hasMore: page * limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching leads pool:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads pool' },
      { status: 500 }
    )
  }
}

/**
 * Claim a lead from the pool.
 *
 * The eligibility check AND the update are wrapped in a `db.$transaction` so that
 * two employees cannot both claim the same lead (no race condition).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    const json = await request.json()
    const parsed = claimLeadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { leadId, employeeId, force } = parsed.data

    // Permission check: a user can always claim for themselves; admins/managers can claim for others
    if (employeeId !== userId) {
      const canAssign = await hasPermission(userId, 'lead', 'UPDATE')
      if (!canAssign) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions to claim a lead for another user' },
          { status: 403 }
        )
      }
    }

    // Atomic claim — eligibility check + update in a single transaction
    const result = await db.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      if (!lead) {
        return { error: 'Lead not found', status: 404 }
      }
      if (!lead.isActive) {
        return { error: 'Inactive leads cannot be claimed', status: 400 }
      }
      if (lead.assignedToId === employeeId) {
        return { error: 'This lead is already assigned to you', status: 400 }
      }
      if (!force && lead.status !== 'NEW') {
        return {
          error: `Lead cannot be taken. Current status: ${lead.status}. Only NEW leads can be claimed.`,
          status: 400,
        }
      }
      if (!force && lead.contactedAt) {
        return { error: 'Contacted leads cannot be claimed from the pool', status: 400 }
      }
      if (!force) {
        const eightHoursAgo = new Date(Date.now() - LEAD_RECLAIM_HOURS * 60 * 60 * 1000)
        const isUnassigned = !lead.assignedToId
        const isOverdue = Boolean(lead.assignedAt && lead.assignedAt <= eightHoursAgo)
        if (!isUnassigned && !isOverdue) {
          return {
            error: `Lead is not available yet. Assigned leads become claimable after ${LEAD_RECLAIM_HOURS} hours without contact.`,
            status: 400,
          }
        }
      }

      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, firstName: true, lastName: true, email: true, companyId: true },
      })
      if (!employee) {
        return { error: 'Employee not found', status: 404 }
      }
      if (employee.companyId !== lead.companyId) {
        return { error: 'Lead does not belong to this employee company', status: 403 }
      }

      const previousAssigneeId = lead.assignedToId
      const previousAssigneeName = lead.assignedTo
        ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
        : 'Unassigned'

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: {
          assignedToId: employeeId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        },
      })

      await tx.leadHistory.create({
        data: {
          leadId,
          employeeId,
          action: previousAssigneeId ? 'CLAIMED_FROM_POOL' : 'CLAIMED_UNASSIGNED',
          oldValue: JSON.stringify({
            assignedToId: previousAssigneeId,
            assignedToName: previousAssigneeName,
          }),
          newValue: JSON.stringify({
            assignedToId: employeeId,
            assignedToName: `${employee.firstName} ${employee.lastName}`,
          }),
          notes: previousAssigneeId
            ? `Claimed from pool (previously assigned to ${previousAssigneeName})`
            : 'Claimed from pool (was unassigned)',
        },
      })

      await tx.notification.create({
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
            action: 'claimed',
          }),
        },
      })

      if (previousAssigneeId && lead.assignedTo) {
        await tx.notification.create({
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
              claimedByName: `${employee.firstName} ${employee.lastName}`,
            }),
          },
        })
      }

      return {
        data: {
          id: updatedLead.id,
          leadNumber: lead.leadNumber,
          name: `${updatedLead.firstName || ''} ${updatedLead.lastName || ''}`.trim(),
          email: updatedLead.email,
          phone: updatedLead.phone,
          status: updatedLead.status,
          priority: updatedLead.priority,
          assignedTo: `${employee.firstName} ${employee.lastName}`,
          assignedToId: employee.id,
          assignedAt: updatedLead.assignedAt,
          previousAssignee: previousAssigneeName,
        },
        companyId: employee.companyId,
      }
    })

    if ('error' in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      )
    }

    // Invalidate every relevant cache
    invalidateCache('leads', result.companyId)
    invalidateCache('pool', result.companyId)

    return NextResponse.json({ success: true, message: 'Lead claimed successfully', data: result.data })
  } catch (error) {
    console.error('Error claiming lead:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to claim lead' },
      { status: 500 }
    )
  }
}

/**
 * Return a lead to the pool (unclaim).
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')
    const employeeId = searchParams.get('employeeId')

    if (!leadId || !employeeId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID and Employee ID are required' },
        { status: 400 }
      )
    }

    // Only the assignee or admin/manager can return the lead
    if (employeeId !== userId) {
      const canAssign = await hasPermission(userId, 'lead', 'UPDATE')
      if (!canAssign) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions to return another user\'s lead' },
          { status: 403 }
        )
      }
    }

    // Atomic: verify ownership + update in one transaction
    const result = await db.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        include: { assignedTo: true },
      })
      if (!lead) return { error: 'Lead not found', status: 404 }
      if (lead.assignedToId !== employeeId) {
        return { error: 'You can only return leads assigned to you', status: 403 }
      }

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: { assignedToId: null, assignedAt: null, updatedAt: new Date() },
      })

      await tx.leadHistory.create({
        data: {
          leadId,
          employeeId,
          action: 'RETURNED_TO_POOL',
          oldValue: JSON.stringify({
            assignedToId: employeeId,
            assignedToName: lead.assignedTo
              ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
              : '',
          }),
          newValue: JSON.stringify({ assignedToId: null, assignedToName: 'Pool' }),
          notes: 'Lead returned to pool',
        },
      })

      await tx.notification.create({
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
            action: 'returned',
          }),
        },
      })

      return { data: updatedLead, companyId: lead.companyId }
    })

    if ('error' in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      )
    }

    invalidateCache('leads', result.companyId)
    invalidateCache('pool', result.companyId)

    return NextResponse.json({
      success: true,
      message: 'Lead returned to pool successfully',
      data: result.data,
    })
  } catch (error) {
    console.error('Error returning lead to pool:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to return lead to pool' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { createLeadHistory } from '@/lib/lead-history'
import { LEAD_RECLAIM_HOURS } from '@/lib/leads-constants'

/**
 * Background job to reassign leads not contacted within LEAD_RECLAIM_HOURS hours.
 * Also invalidates the leads and pool caches.
 */
export async function POST(request: NextRequest) {
  try {
    const eightHoursAgo = new Date(Date.now() - LEAD_RECLAIM_HOURS * 60 * 60 * 1000)

    const uncontactedLeads = await db.lead.findMany({
      where: {
        assignedToId: { not: null },
        assignedAt: { not: null, lte: eightHoursAgo },
        contactedAt: null,
        status: { in: ['NEW', 'CONTACTED'] },
      },
      include: {
        assignedTo: {
          include: { department: true },
        },
      },
    })

    if (uncontactedLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads need reassignment',
        reassignedCount: 0,
      })
    }

    // Track company IDs to invalidate caches at the end
    const companiesToInvalidate = new Set<string>()

    const results: Array<{
      leadId: string
      status: string
      previousAssigneeId?: string | null
      newAssigneeId?: string
      error?: string
    }> = []

    for (const lead of uncontactedLeads) {
      try {
        const availableEmployees = await db.employee.findMany({
          where: {
            departmentId: lead.assignedTo?.departmentId,
            status: 'ACTIVE',
            isActive: true,
            autoAssignEnabled: true,
            role: { name: { not: { contains: 'Administrator' } } },
          },
        })

        if (availableEmployees.length === 0) {
          results.push({ leadId: lead.id, status: 'no_available_employees' })
          continue
        }

        const employeeLeadCounts: { [key: string]: number } = {}
        for (const emp of availableEmployees) employeeLeadCounts[emp.id] = 0

        const assignedLeads = await db.lead.groupBy({
          by: ['assignedToId'],
          where: {
            assignedToId: { in: availableEmployees.map((e) => e.id) },
            status: { in: ['NEW', 'CONTACTED'] },
          },
          _count: { id: true },
        })
        for (const assignment of assignedLeads) {
          if (assignment.assignedToId) {
            employeeLeadCounts[assignment.assignedToId] = assignment._count.id
          }
        }

        let leastLoadedEmployee = availableEmployees[0]
        let minLeadCount = employeeLeadCounts[leastLoadedEmployee.id]
        for (const emp of availableEmployees) {
          if (employeeLeadCounts[emp.id] < minLeadCount) {
            minLeadCount = employeeLeadCounts[emp.id]
            leastLoadedEmployee = emp
          }
        }

        if (leastLoadedEmployee.id === lead.assignedToId) {
          results.push({ leadId: lead.id, status: 'already_least_loaded' })
          continue
        }

        const previousAssigneeId = lead.assignedToId
        const previousAssigneeName = lead.assignedTo
          ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
          : 'Unassigned'

        await db.lead.update({
          where: { id: lead.id },
          data: {
            assignedToId: leastLoadedEmployee.id,
            assignedAt: new Date(),
            updatedAt: new Date(),
          },
        })

        await createLeadHistory({
          leadId: lead.id,
          employeeId: leastLoadedEmployee.id,
          action: 'AUTO_REASSIGNED',
          oldValue: {
            assignedToId: previousAssigneeId,
            assignedToName: previousAssigneeName,
          },
          newValue: {
            assignedToId: leastLoadedEmployee.id,
            assignedToName: `${leastLoadedEmployee.firstName} ${leastLoadedEmployee.lastName}`,
          },
          notes: `Auto-reassigned from ${previousAssigneeName} to ${leastLoadedEmployee.firstName} ${leastLoadedEmployee.lastName} after ${LEAD_RECLAIM_HOURS} hours without contact`,
        })

        await db.notification.create({
          data: {
            title: 'Lead Auto-Reassigned',
            message: `${lead.firstName} ${lead.lastName} has been auto-reassigned to you after ${LEAD_RECLAIM_HOURS} hours without contact`,
            type: 'WARNING',
            category: 'LEAD',
            companyId: leastLoadedEmployee.companyId,
            employeeId: leastLoadedEmployee.id,
            metadata: JSON.stringify({
              leadId: lead.id,
              leadNumber: lead.leadNumber,
              reason: 'auto_reassigned_no_contact',
            }),
          },
        })

        if (previousAssigneeId) {
          await db.notification.create({
            data: {
              title: 'Lead Auto-Reassigned',
              message: `${lead.firstName} ${lead.lastName} has been auto-reassigned to ${leastLoadedEmployee.firstName} ${leastLoadedEmployee.lastName} after ${LEAD_RECLAIM_HOURS} hours without contact`,
              type: 'INFO',
              category: 'LEAD',
              companyId: lead.assignedTo?.companyId || 'default-company',
              employeeId: previousAssigneeId,
              metadata: JSON.stringify({
                leadId: lead.id,
                leadNumber: lead.leadNumber,
                reason: 'auto_reassigned_no_contact',
              }),
            },
          })
        }

        companiesToInvalidate.add(leastLoadedEmployee.companyId)
        if (lead.assignedTo?.companyId) {
          companiesToInvalidate.add(lead.assignedTo.companyId)
        }

        results.push({
          leadId: lead.id,
          status: 'reassigned',
          previousAssigneeId,
          newAssigneeId: leastLoadedEmployee.id,
        })
      } catch (error) {
        results.push({
          leadId: lead.id,
          status: 'error',
          error: (error as Error).message,
        })
      }
    }

    // Invalidate caches for all affected companies
    for (const companyId of companiesToInvalidate) {
      invalidateCache('leads', companyId)
      invalidateCache('pool', companyId)
    }

    return NextResponse.json({
      success: true,
      message: 'Automatic reassignment job completed',
      reassignedCount: results.filter((r) => r.status === 'reassigned').length,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to run automatic reassignment job' },
      { status: 500 }
    )
  }
}

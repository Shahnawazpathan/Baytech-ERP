import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { LEAD_RECLAIM_HOURS } from '@/lib/leads-constants'

export const ASSIGNABLE_EMPLOYEE_ROLE_FILTER = {
  name: { notIn: ['Administrator', 'Admin', 'Manager'] },
}

export interface LeadPoolReclaimResult {
  leadId: string
  status: 'returned_to_pool' | 'already_processed' | 'error'
  previousAssigneeId?: string
  error?: string
}

/**
 * Return assigned leads to the pool after a full inactivity window.
 * Both assignedAt and updatedAt must be overdue, so any lead update restarts
 * the inactivity window. Contacted or progressed leads are never reclaimed.
 */
export async function reclaimInactiveLeadsToPool(companyId?: string): Promise<LeadPoolReclaimResult[]> {
  const cutoff = new Date(Date.now() - LEAD_RECLAIM_HOURS * 60 * 60 * 1000)
  const overdueLeads = await db.lead.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      isActive: true,
      assignedToId: { not: null },
      assignedAt: { not: null, lte: cutoff },
      updatedAt: { lte: cutoff },
      contactedAt: null,
      status: 'NEW',
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, companyId: true } },
    },
  })

  const affectedCompanies = new Set<string>()
  const results: LeadPoolReclaimResult[] = []

  for (const lead of overdueLeads) {
    try {
      const previousAssigneeId = lead.assignedToId as string
      const previousAssigneeName = lead.assignedTo
        ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
        : 'Unknown employee'

      const returned = await db.$transaction(async (tx) => {
        const update = await tx.lead.updateMany({
          where: {
            id: lead.id,
            assignedToId: previousAssigneeId,
            assignedAt: { not: null, lte: cutoff },
            updatedAt: { lte: cutoff },
            contactedAt: null,
            status: 'NEW',
          },
          data: {
            assignedToId: null,
            assignedAt: null,
            updatedAt: new Date(),
          },
        })

        if (update.count === 0) return false

        await tx.leadHistory.create({
          data: {
            leadId: lead.id,
            employeeId: previousAssigneeId,
            action: 'AUTO_RETURNED_TO_POOL',
            oldValue: JSON.stringify({
              assignedToId: previousAssigneeId,
              assignedToName: previousAssigneeName,
              assignedAt: lead.assignedAt,
            }),
            newValue: JSON.stringify({ assignedToId: null, assignedToName: 'Leads Pool' }),
            notes: `Returned to leads pool after ${LEAD_RECLAIM_HOURS} hours without contact or update`,
          },
        })

        await tx.notification.create({
          data: {
            title: 'Lead Returned to Pool',
            message: `${lead.firstName} ${lead.lastName || ''}`.trim()
              + ` was returned to the leads pool after ${LEAD_RECLAIM_HOURS} hours without contact or update`,
            type: 'WARNING',
            category: 'LEAD',
            companyId: lead.companyId,
            employeeId: previousAssigneeId,
            metadata: JSON.stringify({
              leadId: lead.id,
              leadNumber: lead.leadNumber,
              reason: 'inactive_returned_to_pool',
            }),
          },
        })

        return true
      })

      if (!returned) {
        results.push({ leadId: lead.id, status: 'already_processed' })
        continue
      }

      affectedCompanies.add(lead.companyId)
      results.push({ leadId: lead.id, status: 'returned_to_pool', previousAssigneeId })
    } catch (error) {
      results.push({
        leadId: lead.id,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  for (const affectedCompanyId of affectedCompanies) {
    invalidateCache('leads', affectedCompanyId)
    invalidateCache('pool', affectedCompanyId)
  }

  return results
}

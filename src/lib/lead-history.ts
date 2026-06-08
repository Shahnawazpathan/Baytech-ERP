import { db } from '@/lib/db'

interface CreateLeadHistoryInput {
  leadId: string
  employeeId: string | null
  action: string
  oldValue?: string | object | null
  newValue?: string | object | null
  notes?: string
}

/**
 * Create a lead history entry. Accepts objects/strings for old/new value and
 * JSON-serializes them automatically.
 */
export async function createLeadHistory(input: CreateLeadHistoryInput): Promise<void> {
  const { leadId, employeeId, action, oldValue, newValue, notes } = input
  const stringify = (v: unknown): string | undefined => {
    if (v === null || v === undefined) return undefined
    return typeof v === 'string' ? v : JSON.stringify(v)
  }
  await db.leadHistory.create({
    data: {
      leadId,
      employeeId: employeeId ?? null,
      action,
      oldValue: stringify(oldValue ?? null),
      newValue: stringify(newValue ?? null),
      notes,
    },
  })
}

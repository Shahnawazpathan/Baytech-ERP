import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { createLeadHistory } from '@/lib/lead-history'
import { parseLeadMetadata } from '@/lib/lead-metadata'

const dispositionSchema = z.object({
  leadId: z.string().min(1),
  disposition: z.enum([
    'INTERESTED',
    'CALLBACK',
    'BUSY',
    'NO_ANSWER',
    'NOT_INTERESTED',
    'SALE',
    'DO_NOT_CALL',
  ]),
  notes: z.string().trim().max(2000).optional().default(''),
  callbackAt: z.string().datetime().optional().nullable(),
  durationSeconds: z.number().int().nonnegative().optional().default(0),
})

const leadStatusByDisposition: Record<string, string> = {
  INTERESTED: 'QUALIFIED',
  CALLBACK: 'CONTACTED',
  BUSY: 'CONTACTED',
  NO_ANSWER: 'CONTACTED',
  NOT_INTERESTED: 'REJECTED',
  SALE: 'REAL',
  DO_NOT_CALL: 'CLOSED',
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const companyId = request.headers.get('x-company-id')
    if (!userId || !companyId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const parsed = dispositionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid disposition', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { leadId, disposition, notes, callbackAt, durationSeconds } = parsed.data
    if (disposition === 'CALLBACK' && !callbackAt) {
      return NextResponse.json({ error: 'Callback date and time is required' }, { status: 400 })
    }

    const lead = await db.lead.findFirst({ where: { id: leadId, companyId, isActive: true } })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const employee = await db.employee.findUnique({ where: { id: userId }, include: { role: true } })
    const elevated = employee?.role.name.toLowerCase().includes('admin')
      || employee?.role.name.toLowerCase().includes('manager')
    if (lead.assignedToId !== userId && !elevated) {
      return NextResponse.json({ error: 'This lead is assigned to another agent' }, { status: 403 })
    }

    const now = new Date()
    const metadata = parseLeadMetadata(lead.metadata)
    let rawMetadata: Record<string, unknown> = {}
    try {
      rawMetadata = lead.metadata ? JSON.parse(lead.metadata) : {}
    } catch {
      rawMetadata = {}
    }
    const nextMetadata = JSON.stringify({
      ...rawMetadata,
      ...metadata,
      dnc: disposition === 'DO_NOT_CALL' ? true : metadata.dnc,
      notesStatus: disposition === 'CALLBACK' ? 'FOLLOW_UP' : disposition === 'NO_ANSWER' ? 'RING' : null,
      followUpDate: callbackAt || null,
      lastDisposition: disposition,
      lastCallAt: now.toISOString(),
      callAttempts: (metadata.callAttempts || 0) + 1,
    })

    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: leadStatusByDisposition[disposition],
          notes: notes || lead.notes,
          metadata: nextMetadata,
          contactedAt: now,
          updatedAt: now,
        },
      })

      if (callbackAt) {
        await tx.followUpReminder.create({
          data: {
            leadId,
            employeeId: lead.assignedToId || userId,
            companyId,
            subject: `Callback ${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ''}`,
            notes: notes || null,
            dueDate: new Date(callbackAt),
            priority: lead.priority,
          },
        })
      }
    })

    await createLeadHistory({
      leadId,
      employeeId: userId,
      action: 'CALL_DISPOSITION_SAVED',
      oldValue: { status: lead.status },
      newValue: {
        status: leadStatusByDisposition[disposition],
        disposition,
        durationSeconds,
        callbackAt: callbackAt || null,
      },
      notes: notes || undefined,
    })

    invalidateCache('leads', companyId)
    invalidateCache('reports', companyId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving call disposition:', error)
    return NextResponse.json({ error: 'Failed to save call disposition' }, { status: 500 })
  }
}

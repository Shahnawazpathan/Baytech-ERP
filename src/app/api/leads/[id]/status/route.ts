import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { parseLeadMetadata } from '@/lib/lead-metadata'
import { updateStatusSchema } from '@/lib/leads-validation'
import { createLeadHistory } from '@/lib/lead-history'

/** Update lead status. Records an entry in the lead history. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = request.headers.get('x-user-id') || undefined

    const json = await request.json()
    const parsed = updateStatusSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { status } = parsed.data

    const existingLead = await db.lead.findUnique({ where: { id } })
    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const shouldSetContactedAt = status === 'CONTACTED' && !existingLead.contactedAt
    const updatedLead = await db.lead.update({
      where: { id },
      data: {
        status,
        contactedAt: shouldSetContactedAt ? new Date() : existingLead.contactedAt,
        updatedAt: new Date(),
      },
      include: { assignedTo: true },
    })

    // Audit log: status change
    await createLeadHistory({
      leadId: id,
      employeeId: userId || null,
      action: 'STATUS_CHANGED',
      oldValue: JSON.stringify({ status: existingLead.status }),
      newValue: JSON.stringify({ status }),
      notes: `Status changed from ${existingLead.status} to ${status}`,
    })

    invalidateCache('leads', existingLead.companyId)
    invalidateCache('pool', existingLead.companyId)

    const metadataValues = parseLeadMetadata(updatedLead.metadata)
    const transformedLead = {
      id: updatedLead.id,
      name: `${updatedLead.firstName || ''} ${updatedLead.lastName || ''}`.trim(),
      email: updatedLead.email,
      phone: updatedLead.phone,
      loanAmount: updatedLead.loanAmount,
      status: updatedLead.status,
      priority: updatedLead.priority,
      assignedTo: updatedLead.assignedTo
        ? `${updatedLead.assignedTo.firstName} ${updatedLead.assignedTo.lastName}`
        : 'Unassigned',
      assignedToId: updatedLead.assignedToId,
      assignedAt: updatedLead.assignedAt,
      contactedAt: updatedLead.contactedAt,
      propertyAddress: updatedLead.address,
      creditScore: updatedLead.creditScore,
      source: updatedLead.source,
      createdAt: updatedLead.createdAt,
      updatedAt: updatedLead.updatedAt,
      firstName: updatedLead.firstName,
      lastName: updatedLead.lastName,
      notes: updatedLead.notes || '',
      notesStatus: metadataValues.notesStatus,
      followUpDate: metadataValues.followUpDate,
    }

    return NextResponse.json(transformedLead)
  } catch (error) {
    console.error('Error updating lead status:', error)
    return NextResponse.json({ error: 'Failed to update lead status' }, { status: 500 })
  }
}

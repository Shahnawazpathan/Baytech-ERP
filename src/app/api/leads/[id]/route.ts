import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { mergeLeadMetadata, parseLeadMetadata } from '@/lib/lead-metadata'
import { updateLeadSchema } from '@/lib/leads-validation'
import { getSessionUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

/** Update a lead. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await hasPermission(sessionUser.id, 'lead', 'UPDATE'))) {
      return NextResponse.json({ error: 'Insufficient permissions to update leads' }, { status: 403 })
    }

    const { id } = await params
    const json = await request.json()
    const parsed = updateLeadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const body = parsed.data

    // Scoped to caller's company; non-admins may only update leads assigned to them
    const roleLower = sessionUser.role.toLowerCase()
    const canSeeCompanyLeads = roleLower.includes('admin') || roleLower.includes('manager')
    const existingLead = await db.lead.findFirst({
      where: {
        id,
        companyId: sessionUser.companyId,
        ...(canSeeCompanyLeads ? {} : { assignedToId: sessionUser.id }),
      },
    })
    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // If reassigning, target employee must belong to the same company
    let assignedToId = existingLead.assignedToId
    if (body.assignedToId !== undefined) {
      if (body.assignedToId === null || body.assignedToId === '') {
        assignedToId = null
      } else {
        const assignee = await db.employee.findFirst({
          where: { id: body.assignedToId, companyId: sessionUser.companyId },
          select: { id: true },
        })
        if (!assignee) {
          return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 })
        }
        assignedToId = assignee.id
      }
    }

    const shouldUpdateMetadata =
      body.notesStatus !== undefined || body.followUpDate !== undefined
    const metadata = shouldUpdateMetadata
      ? mergeLeadMetadata(existingLead.metadata, {
          notesStatus: body.notesStatus,
          followUpDate: body.followUpDate,
        })
      : existingLead.metadata

    const updatedLead = await db.lead.update({
      where: { id },
      data: {
        firstName: body.firstName ?? existingLead.firstName,
        lastName:
          body.lastName !== undefined
            ? body.lastName === ''
              ? null
              : body.lastName
            : existingLead.lastName,
        email:
          body.email !== undefined ? (body.email === '' ? null : body.email) : existingLead.email,
        phone: body.phone !== undefined ? body.phone : existingLead.phone,
        loanAmount: body.loanAmount !== undefined ? body.loanAmount : existingLead.loanAmount,
        status: body.status !== undefined ? body.status : existingLead.status,
        priority: body.priority !== undefined ? body.priority : existingLead.priority,
        assignedToId,
        ...(assignedToId !== existingLead.assignedToId && {
          assignedAt: assignedToId ? new Date() : null,
        }),
        address:
          body.propertyAddress !== undefined
            ? body.propertyAddress === ''
              ? null
              : body.propertyAddress
            : existingLead.address,
        creditScore: body.creditScore !== undefined ? body.creditScore : existingLead.creditScore,
        source: body.source !== undefined ? body.source : existingLead.source,
        notes: body.notes !== undefined ? (body.notes === '' ? null : body.notes) : existingLead.notes,
        metadata,
        updatedAt: new Date(),
      },
      include: { assignedTo: true },
    })

    invalidateCache('leads', existingLead.companyId)
    invalidateCache('pool', existingLead.companyId)

    const metadataValues = parseLeadMetadata(updatedLead.metadata)
    const transformedLead = {
      id: updatedLead.id,
      name: updatedLead.lastName
        ? `${updatedLead.firstName || ''} ${updatedLead.lastName}`.trim()
        : updatedLead.firstName,
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
      lastName: updatedLead.lastName || '',
      notes: updatedLead.notes,
      notesStatus: metadataValues.notesStatus,
      followUpDate: metadataValues.followUpDate,
      dnc: metadataValues.dnc,
      whatsappOptIn: metadataValues.whatsappOptIn,
      lastDisposition: metadataValues.lastDisposition,
      lastCallAt: metadataValues.lastCallAt,
      callAttempts: metadataValues.callAttempts,
    }

    return NextResponse.json(transformedLead)
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

/** Get a single lead. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await hasPermission(sessionUser.id, 'lead', 'READ'))) {
      return NextResponse.json({ error: 'Insufficient permissions to view leads' }, { status: 403 })
    }

    const { id } = await params

    // Scoped to caller's company; non-admins may only view leads assigned to them
    const roleLower = sessionUser.role.toLowerCase()
    const canSeeCompanyLeads = roleLower.includes('admin') || roleLower.includes('manager')
    const lead = await db.lead.findFirst({
      where: {
        id,
        companyId: sessionUser.companyId,
        ...(canSeeCompanyLeads ? {} : { assignedToId: sessionUser.id }),
      },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
    })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const metadataValues = parseLeadMetadata(lead.metadata)
    const transformedLead = {
      id: lead.id,
      name: lead.lastName ? `${lead.firstName || ''} ${lead.lastName}`.trim() : lead.firstName,
      email: lead.email,
      phone: lead.phone,
      loanAmount: lead.loanAmount,
      status: lead.status,
      priority: lead.priority,
      assignedTo: lead.assignedTo
        ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
        : 'Unassigned',
      assignedToId: lead.assignedToId,
      assignedAt: lead.assignedAt,
      contactedAt: lead.contactedAt,
      propertyAddress: lead.address,
      creditScore: lead.creditScore,
      source: lead.source,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      firstName: lead.firstName,
      lastName: lead.lastName || '',
      notes: lead.notes,
      notesStatus: metadataValues.notesStatus,
      followUpDate: metadataValues.followUpDate,
      dnc: metadataValues.dnc,
      whatsappOptIn: metadataValues.whatsappOptIn,
      lastDisposition: metadataValues.lastDisposition,
      lastCallAt: metadataValues.lastCallAt,
      callAttempts: metadataValues.callAttempts,
    }

    return NextResponse.json(transformedLead)
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { mergeLeadMetadata, parseLeadMetadata } from '@/lib/lead-metadata'

// Update a lead
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json()
    
    // Check if lead exists
    const existingLead = await db.lead.findUnique({
      where: { id }
    })
    
    if (!existingLead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }
    
    // Update the lead
    const shouldUpdateMetadata = body.notesStatus !== undefined || body.followUpDate !== undefined
    const metadata = shouldUpdateMetadata
      ? mergeLeadMetadata(existingLead.metadata, {
          notesStatus: body.notesStatus,
          followUpDate: body.followUpDate
        })
      : existingLead.metadata
    const updatedLead = await db.lead.update({
      where: { id },
      data: {
        firstName: body.firstName ?? existingLead.firstName,
        lastName: body.lastName !== undefined ? (body.lastName === '' ? null : body.lastName) : existingLead.lastName,
        email: body.email !== undefined ? (body.email === '' ? null : body.email) : existingLead.email,
        phone: body.phone !== undefined ? body.phone : existingLead.phone,
        loanAmount: body.loanAmount !== undefined ? body.loanAmount : existingLead.loanAmount,
        status: body.status !== undefined ? body.status : existingLead.status,
        priority: body.priority !== undefined ? body.priority : existingLead.priority,
        assignedToId: body.assignedToId !== undefined ? body.assignedToId : existingLead.assignedToId,
        address: body.propertyAddress !== undefined ? (body.propertyAddress === '' ? null : body.propertyAddress) : existingLead.address,
        creditScore: body.creditScore !== undefined ? body.creditScore : existingLead.creditScore,
        source: body.source !== undefined ? body.source : existingLead.source,
        notes: body.notes !== undefined ? (body.notes === '' ? null : body.notes) : existingLead.notes,
        metadata,
        updatedAt: new Date()
      },
      include: {
        assignedTo: true
      }
    })

    invalidateCache('leads', existingLead.companyId)

    // Transform the updated lead to match expected format
    const metadataValues = parseLeadMetadata(updatedLead.metadata)
    const transformedLead = {
      id: updatedLead.id,
      name: updatedLead.lastName ? `${updatedLead.firstName || ''} ${updatedLead.lastName}`.trim() : updatedLead.firstName,
      email: updatedLead.email,
      phone: updatedLead.phone,
      loanAmount: updatedLead.loanAmount,
      status: updatedLead.status,
      priority: updatedLead.priority,
      assignedTo: updatedLead.assignedTo ? `${updatedLead.assignedTo.firstName} ${updatedLead.assignedTo.lastName}` : 'Unassigned',
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
      followUpDate: metadataValues.followUpDate
    }

    return NextResponse.json(transformedLead)
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}

// Get a single lead
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        assignedTo: true
      }
    })

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Transform the lead to match expected format
    const metadataValues = parseLeadMetadata(lead.metadata)
    const transformedLead = {
      id: lead.id,
      name: lead.lastName ? `${lead.firstName || ''} ${lead.lastName}`.trim() : lead.firstName,
      email: lead.email,
      phone: lead.phone,
      loanAmount: lead.loanAmount,
      status: lead.status,
      priority: lead.priority,
      assignedTo: lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned',
      assignedToId: lead.assignedToId,
      assignedAt: lead.assignedAt,
      propertyAddress: lead.address,
      creditScore: lead.creditScore,
      source: lead.source,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      firstName: lead.firstName,
      lastName: lead.lastName || '',
      notes: lead.notes,
      notesStatus: metadataValues.notesStatus,
      followUpDate: metadataValues.followUpDate
    }

    return NextResponse.json(transformedLead)
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    )
  }
}

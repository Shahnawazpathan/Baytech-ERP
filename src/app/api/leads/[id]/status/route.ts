import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Update lead status
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status } = await request.json()
    
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
    
    // Update the lead status
    const updatedLead = await db.lead.update({
      where: { id },
      data: {
        status: status,
        updatedAt: new Date()
      },
      include: {
        assignedTo: true
      }
    })

    // Transform the updated lead to match expected format
    const transformedLead = {
      id: updatedLead.id,
      name: `${updatedLead.firstName || ''} ${updatedLead.lastName || ''}`.trim(),
      email: updatedLead.email,
      phone: updatedLead.phone,
      loanAmount: updatedLead.loanAmount,
      status: updatedLead.status,
      priority: updatedLead.priority,
      assignedTo: updatedLead.assignedTo ? `${updatedLead.assignedTo.firstName} ${updatedLead.assignedTo.lastName}` : 'Unassigned',
      assignedToId: updatedLead.assignedToId,
      assignedAt: updatedLead.assignedAt,
      propertyAddress: updatedLead.address,
      creditScore: updatedLead.creditScore,
      source: updatedLead.source,
      createdAt: updatedLead.createdAt,
      updatedAt: updatedLead.updatedAt,
      firstName: updatedLead.firstName,
      lastName: updatedLead.lastName
    }

    return NextResponse.json(transformedLead)
  } catch (error) {
    console.error('Error updating lead status:', error)
    return NextResponse.json(
      { error: 'Failed to update lead status' },
      { status: 500 }
    )
  }
}
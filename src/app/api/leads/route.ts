import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    
    const leads = await db.lead.findMany({
      where: { 
        companyId,
        isActive: true
      },
      include: {
        assignedTo: true
      }
    })

    // Transform the data to match the expected format
    const transformedLeads = leads.map(lead => ({
      id: lead.id,
      name: `${lead.firstName} ${lead.lastName}`,
      email: lead.email,
      phone: lead.phone,
      loanAmount: lead.loanAmount,
      status: lead.status,
      priority: lead.priority,
      assignedTo: lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned',
      assignedToId: lead.assignedToId,
      propertyAddress: lead.address,
      creditScore: lead.creditScore,
      source: lead.source,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      firstName: lead.firstName,
      lastName: lead.lastName,
      notes: lead.notes || ''
    }))

    return NextResponse.json(transformedLeads)
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Create a new lead
    const lead = await db.lead.create({
      data: {
        leadNumber: `LEAD${Date.now()}`, // Generate lead number
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        loanAmount: body.loanAmount,
        status: body.status,
        priority: body.priority,
        assignedToId: body.assignedToId,
        companyId: body.companyId,
        address: body.propertyAddress,
        creditScore: body.creditScore,
        source: body.source,
        isActive: true
      },
      include: {
        assignedTo: true
      }
    })

    // Transform the created lead to match expected format
    const transformedLead = {
      id: lead.id,
      name: `${lead.firstName} ${lead.lastName}`,
      email: lead.email,
      phone: lead.phone,
      loanAmount: lead.loanAmount,
      status: lead.status,
      priority: lead.priority,
      assignedTo: lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned',
      assignedToId: lead.assignedToId,
      propertyAddress: lead.address,
      creditScore: lead.creditScore,
      source: lead.source,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      firstName: lead.firstName,
      lastName: lead.lastName,
      notes: lead.notes || ''
    }

    return NextResponse.json(transformedLead)
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    )
  }
}
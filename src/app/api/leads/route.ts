import { NextRequest, NextResponse } from 'next/server'

// Mock database
let leads = [
  {
    id: 1,
    name: "John Smith",
    email: "john@email.com",
    phone: "555-1234",
    loanAmount: 450000,
    status: "NEW",
    priority: "HIGH",
    assignedTo: "Alice Johnson",
    propertyAddress: "123 Main St, City, State",
    creditScore: 750
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah@email.com",
    phone: "555-5678",
    loanAmount: 320000,
    status: "QUALIFIED",
    priority: "MEDIUM",
    assignedTo: "Bob Smith",
    propertyAddress: "456 Oak Ave, City, State",
    creditScore: 680
  }
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || 'ALL'
  const priority = searchParams.get('priority') || 'ALL'

  try {
    let filteredLeads = leads.filter(lead => {
      const matchesSearch = lead.name.toLowerCase().includes(search.toLowerCase()) ||
                           lead.email.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = status === 'ALL' || lead.status === status
      const matchesPriority = priority === 'ALL' || lead.priority === priority
      return matchesSearch && matchesStatus && matchesPriority
    })

    return NextResponse.json({
      success: true,
      data: filteredLeads,
      total: filteredLeads.length
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, loanAmount, status, priority, assignedTo, propertyAddress, creditScore } = body

    if (!name || !email || !loanAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const newLead = {
      id: leads.length + 1,
      name,
      email,
      phone: phone || '',
      loanAmount: Number(loanAmount),
      status: status || 'NEW',
      priority: priority || 'MEDIUM',
      assignedTo: assignedTo || 'Unassigned',
      propertyAddress: propertyAddress || '',
      creditScore: creditScore || 0
    }

    leads.push(newLead)

    return NextResponse.json({
      success: true,
      data: newLead,
      message: 'Lead created successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create lead' },
      { status: 500 }
    )
  }
}
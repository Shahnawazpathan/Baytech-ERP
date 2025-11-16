import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'

    // Optimize: Only select necessary fields instead of fetching all
    const leads = await db.lead.findMany({
      where: {
        companyId,
        isActive: true
      },
      select: {
        id: true,
        leadNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        loanAmount: true,
        status: true,
        priority: true,
        assignedToId: true,
        assignedAt: true,
        address: true,
        creditScore: true,
        source: true,
        createdAt: true,
        updatedAt: true,
        notes: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Transform the data to match the expected format
    const transformedLeads = leads.map(lead => ({
      id: lead.id,
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
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
        assignedAt: body.assignedToId ? new Date() : null,
        companyId: body.companyId,
        address: body.propertyAddress,
        creditScore: body.creditScore,
        source: body.source,
        notes: body.notes,
        isActive: true
      },
      include: {
        assignedTo: true
      }
    })

    // Transform the created lead to match expected format
    const transformedLead = {
      id: lead.id,
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
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

// Bulk import endpoint with auto-assignment
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { leads, autoAssign = true, companyId } = body

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'No leads provided' },
        { status: 400 }
      )
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // Get all active employees for this company
    const activeEmployees = await db.employee.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        isActive: true
      },
      include: {
        _count: {
          select: {
            leads: {
              where: {
                status: {
                  in: ['NEW', 'CONTACTED', 'QUALIFIED', 'APPLICATION']
                }
              }
            }
          }
        }
      },
      orderBy: {
        leads: {
          _count: 'asc'
        }
      }
    })

    if (autoAssign && activeEmployees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees available for assignment' },
        { status: 400 }
      )
    }

    const createdLeads = []
    let employeeIndex = 0

    // Create leads with round-robin assignment
    for (const leadData of leads) {
      let assignedEmployeeId = null

      if (autoAssign && activeEmployees.length > 0) {
        // Round-robin assignment
        assignedEmployeeId = activeEmployees[employeeIndex].id
        employeeIndex = (employeeIndex + 1) % activeEmployees.length
      }

      const lead = await db.lead.create({
        data: {
          leadNumber: `LEAD${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          email: leadData.email || null,
          phone: leadData.phone,
          loanAmount: leadData.loanAmount ? parseFloat(leadData.loanAmount.toString()) : null,
          status: leadData.status || 'NEW',
          priority: leadData.priority || 'MEDIUM',
          assignedToId: assignedEmployeeId,
          assignedAt: assignedEmployeeId ? new Date() : null,
          companyId,
          address: leadData.propertyAddress || null,
          creditScore: leadData.creditScore ? parseInt(leadData.creditScore.toString()) : null,
          source: leadData.source || 'Import',
          notes: leadData.notes || null,
          isActive: true
        },
        include: {
          assignedTo: true
        }
      })

      // Create lead history for import
      await db.leadHistory.create({
        data: {
          leadId: lead.id,
          employeeId: assignedEmployeeId,
          action: 'IMPORTED',
          newValue: JSON.stringify({
            assignedToId: assignedEmployeeId,
            status: lead.status
          }),
          notes: assignedEmployeeId
            ? `Imported and auto-assigned to ${lead.assignedTo?.firstName} ${lead.assignedTo?.lastName}`
            : 'Imported without assignment'
        }
      })

      // Create notification for assigned employee
      if (assignedEmployeeId && lead.assignedTo) {
        await db.notification.create({
          data: {
            title: 'New Lead Assigned',
            message: `${lead.firstName} ${lead.lastName} has been assigned to you via import`,
            type: 'INFO',
            category: 'LEAD',
            companyId,
            employeeId: assignedEmployeeId,
            metadata: JSON.stringify({
              leadId: lead.id,
              leadNumber: lead.leadNumber,
              source: 'bulk_import'
            })
          }
        })
      }

      createdLeads.push({
        id: lead.id,
        name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
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
        lastName: lead.lastName,
        notes: lead.notes || ''
      })
    }

    return NextResponse.json({
      success: true,
      imported: createdLeads.length,
      leads: createdLeads,
      assignedToEmployees: autoAssign ? activeEmployees.length : 0
    })
  } catch (error) {
    console.error('Error bulk importing leads:', error)
    return NextResponse.json(
      { error: 'Failed to bulk import leads' },
      { status: 500 }
    )
  }
}
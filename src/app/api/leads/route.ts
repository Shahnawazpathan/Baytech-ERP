import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache, createCacheKey } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = (page - 1) * limit

    // Check cache first
    const cacheKey = createCacheKey('leads', { companyId, page, limit })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const whereClause = {
      companyId,
      isActive: true
    }

    // Optimize: Run count and fetch in parallel
    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where: whereClause,
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
        ],
        skip,
        take: limit
      }),
      db.lead.count({ where: whereClause })
    ])

    // Transform the data to match the expected format
    const transformedLeads = leads.map(lead => ({
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
      notes: lead.notes || ''
    }))

    const response = {
      data: transformedLeads,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    }

    // Cache for 30 seconds
    cache.set(cacheKey, response, 30000)

    return NextResponse.json(response)
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
        firstName: body.firstName?.trim() || 'Unknown',
        lastName: body.lastName?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || 'N/A',
        loanAmount: body.loanAmount || null,
        status: body.status || 'NEW',
        priority: body.priority || 'MEDIUM',
        assignedToId: body.assignedToId || null,
        assignedAt: body.assignedToId ? new Date() : null,
        companyId: body.companyId,
        address: body.propertyAddress?.trim() || null,
        creditScore: body.creditScore || null,
        source: body.source?.trim() || 'Website',
        notes: body.notes?.trim() || null,
        isActive: true
      },
      include: {
        assignedTo: true
      }
    })

    // Transform the created lead to match expected format
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

    // Get all active employees for this company (excluding admins)
    const activeEmployees = await db.employee.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        isActive: true,
        role: {
          name: {
            not: {
              contains: 'Administrator'
            }
          }
        }
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

    const createdLeads: any[] = []
    let employeeIndex = 0

    // Create leads with round-robin assignment
    for (const leadData of leads) {
      let assignedEmployeeId: string | null = null

      if (autoAssign && activeEmployees.length > 0) {
        // Round-robin assignment
        assignedEmployeeId = activeEmployees[employeeIndex].id
        employeeIndex = (employeeIndex + 1) % activeEmployees.length
      }

      const lead = await db.lead.create({
        data: {
          leadNumber: `LEAD${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          firstName: leadData.firstName ? (typeof leadData.firstName === 'string' ? leadData.firstName.trim() : String(leadData.firstName).trim()) : 'Unknown',
          lastName: leadData.lastName ? (typeof leadData.lastName === 'string' ? leadData.lastName.trim() : String(leadData.lastName).trim()) : '',
          email: leadData.email ? (typeof leadData.email === 'string' ? leadData.email.trim() : String(leadData.email).trim()) : null,
          phone: leadData.phone ? (typeof leadData.phone === 'string' ? leadData.phone.trim() : String(leadData.phone).trim()) : 'N/A',
          loanAmount: leadData.loanAmount ? parseFloat(leadData.loanAmount.toString()) : null,
          status: leadData.status || 'NEW',
          priority: leadData.priority || 'MEDIUM',
          assignedToId: assignedEmployeeId,
          assignedAt: assignedEmployeeId ? new Date() : null,
          companyId,
          address: leadData.propertyAddress ? (typeof leadData.propertyAddress === 'string' ? leadData.propertyAddress.trim() : String(leadData.propertyAddress).trim()) : null,
          creditScore: leadData.creditScore ? parseInt(leadData.creditScore.toString()) : null,
          source: leadData.source ? (typeof leadData.source === 'string' ? leadData.source.trim() : String(leadData.source).trim()) : 'Import',
          notes: leadData.notes ? (typeof leadData.notes === 'string' ? leadData.notes.trim() : String(leadData.notes).trim()) : null,
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
            message: `${lead.lastName ? `${lead.firstName} ${lead.lastName}` : lead.firstName} has been assigned to you via import`,
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

// Bulk delete endpoint
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadIds } = body

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'No lead IDs provided' },
        { status: 400 }
      )
    }

    // Delete the leads (soft delete by setting isActive to false)
    const result = await db.lead.updateMany({
      where: {
        id: {
          in: leadIds
        }
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    // Clear cache
    cache.clear()

    return NextResponse.json({
      success: true,
      deleted: result.count
    })
  } catch (error) {
    console.error('Error deleting leads:', error)
    return NextResponse.json(
      { error: 'Failed to delete leads' },
      { status: 500 }
    )
  }
}

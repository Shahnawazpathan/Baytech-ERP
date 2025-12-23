import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PrismaPromise } from '@prisma/client'
import { cache, createCacheKey, invalidateCache } from '@/lib/cache'
import { mergeLeadMetadata, parseLeadMetadata } from '@/lib/lead-metadata'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '1000')
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
          contactedAt: true,
          address: true,
          creditScore: true,
          source: true,
          createdAt: true,
          updatedAt: true,
          notes: true,
          metadata: true,
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
    const transformedLeads = leads.map(lead => {
      const metadata = parseLeadMetadata(lead.metadata)
      return {
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
        contactedAt: lead.contactedAt,
        propertyAddress: lead.address,
        creditScore: lead.creditScore,
        source: lead.source,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        firstName: lead.firstName,
        lastName: lead.lastName || '',
        notes: lead.notes || '',
        notesStatus: metadata.notesStatus,
        followUpDate: metadata.followUpDate
      }
    })

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
    const normalizedStatus = body.status || 'NEW'
    const metadata = mergeLeadMetadata(null, {
      notesStatus: body.notesStatus,
      followUpDate: body.followUpDate
    })
    const lead = await db.lead.create({
      data: {
        leadNumber: `LEAD${Date.now()}`, // Generate lead number
        firstName: body.firstName?.trim() || 'Unknown',
        lastName: body.lastName?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || 'N/A',
        loanAmount: body.loanAmount || null,
        status: normalizedStatus,
        priority: body.priority || 'MEDIUM',
        assignedToId: body.assignedToId || null,
        assignedAt: body.assignedToId ? new Date() : null,
        companyId: body.companyId,
        address: body.propertyAddress?.trim() || null,
        creditScore: body.creditScore || null,
        source: body.source?.trim() || 'Website',
        notes: body.notes?.trim() || null,
        metadata,
        contactedAt: normalizedStatus === 'CONTACTED' ? new Date() : null,
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
      contactedAt: lead.contactedAt,
      propertyAddress: lead.address,
      creditScore: lead.creditScore,
      source: lead.source,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      firstName: lead.firstName,
      lastName: lead.lastName || '',
      notes: lead.notes || '',
      notesStatus: body.notesStatus || null,
      followUpDate: body.followUpDate || null
    }

    invalidateCache('leads', lead.companyId)

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
    const activeEmployees = autoAssign ? await db.employee.findMany({
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
    }) : []

    if (autoAssign && activeEmployees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees available for assignment' },
        { status: 400 }
      )
    }

    const createdAt = new Date()
    const leadNumberPrefix = Date.now()
    let employeeIndex = 0

    const leadsToCreate = leads.map((leadData, index) => {
      let assignedEmployeeId: string | null = null

      if (autoAssign && activeEmployees.length > 0) {
        assignedEmployeeId = activeEmployees[employeeIndex].id
        employeeIndex = (employeeIndex + 1) % activeEmployees.length
      }

      const normalizedStatus = leadData.status || 'NEW'
      const leadNumber = `LEAD${leadNumberPrefix}-${index}-${Math.random().toString(36).slice(2, 9)}`

      return {
        leadNumber,
        firstName: leadData.firstName ? (typeof leadData.firstName === 'string' ? leadData.firstName.trim() : String(leadData.firstName).trim()) : 'Unknown',
        lastName: leadData.lastName ? (typeof leadData.lastName === 'string' ? leadData.lastName.trim() : String(leadData.lastName).trim()) : '',
        email: leadData.email ? (typeof leadData.email === 'string' ? leadData.email.trim() : String(leadData.email).trim()) : null,
        phone: leadData.phone ? (typeof leadData.phone === 'string' ? leadData.phone.trim() : String(leadData.phone).trim()) : 'N/A',
        loanAmount: leadData.loanAmount ? parseFloat(leadData.loanAmount.toString()) : null,
        status: normalizedStatus,
        priority: leadData.priority || 'MEDIUM',
        assignedToId: assignedEmployeeId,
        assignedAt: assignedEmployeeId ? createdAt : null,
        companyId,
        address: leadData.propertyAddress ? (typeof leadData.propertyAddress === 'string' ? leadData.propertyAddress.trim() : String(leadData.propertyAddress).trim()) : null,
        creditScore: leadData.creditScore ? parseInt(leadData.creditScore.toString()) : null,
        source: leadData.source ? (typeof leadData.source === 'string' ? leadData.source.trim() : String(leadData.source).trim()) : 'Import',
        notes: leadData.notes ? (typeof leadData.notes === 'string' ? leadData.notes.trim() : String(leadData.notes).trim()) : null,
        contactedAt: normalizedStatus === 'CONTACTED' ? createdAt : null,
        isActive: true
      }
    })

    await db.lead.createMany({
      data: leadsToCreate
    })

    const leadNumbers = leadsToCreate.map(lead => lead.leadNumber)
    const createdLeadRecords = await db.lead.findMany({
      where: {
        companyId,
        leadNumber: { in: leadNumbers }
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
        contactedAt: true,
        address: true,
        creditScore: true,
        source: true,
        createdAt: true,
        updatedAt: true,
        notes: true,
        metadata: true
      }
    })

    const employeeById = new Map(activeEmployees.map(emp => [emp.id, emp]))
    const historyRecords = createdLeadRecords.map(lead => {
      const employee = lead.assignedToId ? employeeById.get(lead.assignedToId) : null
      return {
        leadId: lead.id,
        employeeId: lead.assignedToId,
        action: 'IMPORTED',
        newValue: JSON.stringify({
          assignedToId: lead.assignedToId,
          status: lead.status
        }),
        notes: lead.assignedToId && employee
          ? `Imported and auto-assigned to ${employee.firstName} ${employee.lastName}`
          : 'Imported without assignment'
      }
    })

    const notificationRecords = createdLeadRecords
      .filter(lead => lead.assignedToId && employeeById.has(lead.assignedToId))
      .map(lead => {
        return {
          title: 'New Lead Assigned',
          message: `${lead.lastName ? `${lead.firstName} ${lead.lastName}` : lead.firstName} has been assigned to you via import`,
          type: 'INFO',
          category: 'LEAD',
          companyId,
          employeeId: lead.assignedToId as string,
          metadata: JSON.stringify({
            leadId: lead.id,
            leadNumber: lead.leadNumber,
            source: 'bulk_import'
          })
        }
      })

    const transactionOps: PrismaPromise<unknown>[] = []
    if (historyRecords.length > 0) {
      transactionOps.push(db.leadHistory.createMany({ data: historyRecords }))
    }
    if (notificationRecords.length > 0) {
      transactionOps.push(db.notification.createMany({ data: notificationRecords }))
    }
    if (transactionOps.length > 0) {
      await db.$transaction(transactionOps)
    }

    const createdLeads = createdLeadRecords.map(lead => {
      const metadata = parseLeadMetadata(lead.metadata)
      const employee = lead.assignedToId ? employeeById.get(lead.assignedToId) : null
      return {
        id: lead.id,
        name: lead.lastName ? `${lead.firstName || ''} ${lead.lastName}`.trim() : lead.firstName,
        email: lead.email,
        phone: lead.phone,
        loanAmount: lead.loanAmount,
        status: lead.status,
        priority: lead.priority,
        assignedTo: employee ? `${employee.firstName} ${employee.lastName}` : 'Unassigned',
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
        notes: lead.notes || '',
        notesStatus: metadata.notesStatus,
        followUpDate: metadata.followUpDate
      }
    })

    invalidateCache('leads', companyId)

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
    const companyId = request.headers.get('x-company-id') || 'default-company'
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

    invalidateCache('leads', companyId)

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

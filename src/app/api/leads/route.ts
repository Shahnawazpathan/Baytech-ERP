import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PrismaPromise } from '@prisma/client'
import { cache, createCacheKey, invalidateCache } from '@/lib/cache'
import { mergeLeadMetadata, parseLeadMetadata } from '@/lib/lead-metadata'
import {
  createLeadSchema,
  bulkImportSchema,
  deleteLeadsSchema,
} from '@/lib/leads-validation'
import { LEADS_CACHE_TTL_MS } from '@/lib/leads-constants'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'ALL'
    const priority = searchParams.get('priority') || 'ALL'
    const assignedTo = searchParams.get('assignedTo') || 'ALL'

    const skip = (page - 1) * limit

    const cacheKey = createCacheKey('leads', { companyId, page, limit, search, status, priority, assignedTo })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const whereClause: any = {
      companyId,
      isActive: true,
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    if (status !== 'ALL') {
      whereClause.status = status
    }

    if (priority !== 'ALL') {
      whereClause.priority = priority
    }

    if (assignedTo !== 'ALL') {
      if (assignedTo === 'unassigned') {
        whereClause.assignedToId = null
      } else {
        whereClause.assignedToId = assignedTo
      }
    }

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
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.lead.count({ where: whereClause }),
    ])

    const transformedLeads = leads.map((lead) => {
      const metadata = parseLeadMetadata(lead.metadata)
      return {
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
        notes: lead.notes || '',
        notesStatus: metadata.notesStatus,
        followUpDate: metadata.followUpDate,
        dnc: metadata.dnc,
        whatsappOptIn: metadata.whatsappOptIn,
        lastDisposition: metadata.lastDisposition,
        lastCallAt: metadata.lastCallAt,
        callAttempts: metadata.callAttempts,
      }
    })

    const response = {
      data: transformedLeads,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    }

    cache.set(cacheKey, response, LEADS_CACHE_TTL_MS)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const parsed = createLeadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const body = parsed.data

    const normalizedStatus = body.status || 'NEW'
    const metadata = mergeLeadMetadata(null, {
      notesStatus: body.notesStatus,
      followUpDate: body.followUpDate,
    })
    const lead = await db.lead.create({
      data: {
        leadNumber: `LEAD${Date.now()}`,
        firstName: body.firstName?.trim() || 'Unknown',
        lastName: body.lastName?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || 'N/A',
        loanAmount: body.loanAmount ?? null,
        status: normalizedStatus,
        priority: body.priority || 'MEDIUM',
        assignedToId: body.assignedToId || null,
        assignedAt: body.assignedToId ? new Date() : null,
        companyId: body.companyId,
        address: body.propertyAddress?.trim() || null,
        creditScore: body.creditScore ?? null,
        source: body.source?.trim() || 'Website',
        notes: body.notes?.trim() || null,
        metadata,
        contactedAt: normalizedStatus === 'CONTACTED' ? new Date() : null,
        isActive: true,
      },
      include: { assignedTo: true },
    })

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
      notes: lead.notes || '',
      notesStatus: metadataValues.notesStatus,
      followUpDate: metadataValues.followUpDate,
      dnc: metadataValues.dnc,
      whatsappOptIn: metadataValues.whatsappOptIn,
      lastDisposition: metadataValues.lastDisposition,
      lastCallAt: metadataValues.lastCallAt,
      callAttempts: metadataValues.callAttempts,
    }

    invalidateCache('leads', lead.companyId)
    invalidateCache('pool', lead.companyId)

    return NextResponse.json(transformedLead)
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}

/** Bulk import with auto-assignment. */
export async function PUT(request: NextRequest) {
  try {
    const json = await request.json()
    const parsed = bulkImportSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { leads, autoAssign = true, companyId } = parsed.data

    const activeEmployees = autoAssign
      ? await db.employee.findMany({
          where: {
            companyId,
            status: 'ACTIVE',
            isActive: true,
            autoAssignEnabled: true,
            role: { name: { not: { contains: 'Administrator' } } },
          },
          include: {
            _count: {
              select: {
                leads: { where: { status: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'APPLICATION'] } } },
              },
            },
          },
          orderBy: { leads: { _count: 'asc' } },
        })
      : []

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
        firstName: leadData.firstName
          ? typeof leadData.firstName === 'string'
            ? leadData.firstName.trim()
            : String(leadData.firstName).trim()
          : 'Unknown',
        lastName: leadData.lastName
          ? typeof leadData.lastName === 'string'
            ? leadData.lastName.trim()
            : String(leadData.lastName).trim()
          : '',
        email: leadData.email
          ? typeof leadData.email === 'string'
            ? leadData.email.trim()
            : String(leadData.email).trim()
          : null,
        phone: leadData.phone
          ? typeof leadData.phone === 'string'
            ? leadData.phone.trim()
            : String(leadData.phone).trim()
          : 'N/A',
        loanAmount: leadData.loanAmount ? parseFloat(leadData.loanAmount.toString()) : null,
        status: normalizedStatus,
        priority: leadData.priority || 'MEDIUM',
        assignedToId: assignedEmployeeId,
        assignedAt: assignedEmployeeId ? createdAt : null,
        companyId,
        address: leadData.propertyAddress
          ? typeof leadData.propertyAddress === 'string'
            ? leadData.propertyAddress.trim()
            : String(leadData.propertyAddress).trim()
          : null,
        creditScore: leadData.creditScore ? parseInt(leadData.creditScore.toString()) : null,
        source: leadData.source
          ? typeof leadData.source === 'string'
            ? leadData.source.trim()
            : String(leadData.source).trim()
          : 'Import',
        notes: leadData.notes
          ? typeof leadData.notes === 'string'
            ? leadData.notes.trim()
            : String(leadData.notes).trim()
          : null,
        contactedAt: normalizedStatus === 'CONTACTED' ? createdAt : null,
        isActive: true,
      }
    })

    await db.lead.createMany({ data: leadsToCreate })

    const leadNumbers = leadsToCreate.map((l) => l.leadNumber)
    const createdLeadRecords = await db.lead.findMany({
      where: { companyId, leadNumber: { in: leadNumbers } },
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
      },
    })

    const employeeById = new Map(activeEmployees.map((emp) => [emp.id, emp]))
    const historyRecords = createdLeadRecords.map((lead) => {
      const employee = lead.assignedToId ? employeeById.get(lead.assignedToId) : null
      return {
        leadId: lead.id,
        employeeId: lead.assignedToId,
        action: 'IMPORTED',
        newValue: JSON.stringify({ assignedToId: lead.assignedToId, status: lead.status }),
        notes:
          lead.assignedToId && employee
            ? `Imported and auto-assigned to ${employee.firstName} ${employee.lastName}`
            : 'Imported without assignment',
      }
    })

    const notificationRecords = createdLeadRecords
      .filter((lead) => lead.assignedToId && employeeById.has(lead.assignedToId))
      .map((lead) => ({
        title: 'New Lead Assigned',
        message: `${lead.lastName ? `${lead.firstName} ${lead.lastName}` : lead.firstName} has been assigned to you via import`,
        type: 'INFO',
        category: 'LEAD',
        companyId,
        employeeId: lead.assignedToId as string,
        metadata: JSON.stringify({
          leadId: lead.id,
          leadNumber: lead.leadNumber,
          source: 'bulk_import',
        }),
      }))

    const transactionOps: PrismaPromise<unknown>[] = []
    if (historyRecords.length > 0) transactionOps.push(db.leadHistory.createMany({ data: historyRecords }))
    if (notificationRecords.length > 0) transactionOps.push(db.notification.createMany({ data: notificationRecords }))
    if (transactionOps.length > 0) await db.$transaction(transactionOps)

    const createdLeads = createdLeadRecords.map((lead) => {
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
        followUpDate: metadata.followUpDate,
      }
    })

    invalidateCache('leads', companyId)
    invalidateCache('pool', companyId)

    return NextResponse.json({
      success: true,
      imported: createdLeads.length,
      leads: createdLeads,
      assignedToEmployees: autoAssign ? activeEmployees.length : 0,
    })
  } catch (error) {
    console.error('Error bulk importing leads:', error)
    return NextResponse.json({ error: 'Failed to bulk import leads' }, { status: 500 })
  }
}

/** Bulk soft-delete. */
export async function DELETE(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    const json = await request.json()
    const parsed = deleteLeadsSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { leadIds } = parsed.data

    const result = await db.lead.updateMany({
      where: { id: { in: leadIds }, companyId },
      data: { isActive: false, updatedAt: new Date() },
    })

    invalidateCache('leads', companyId)
    invalidateCache('pool', companyId)

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('Error deleting leads:', error)
    return NextResponse.json({ error: 'Failed to delete leads' }, { status: 500 })
  }
}

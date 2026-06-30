import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { hasPermission } from '@/lib/rbac'
import { createLeadHistory } from '@/lib/lead-history'
import { assignLeadSchema, bulkAssignSchema } from '@/lib/leads-validation'
import { ASSIGNABLE_EMPLOYEE_ROLE_FILTER } from '@/lib/lead-pool'
import { getSessionUser } from '@/lib/auth'

/** Assign a single lead to an employee. */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    const userId = sessionUser?.id
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    const json = await request.json()
    const parsed = assignLeadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { leadId, employeeId, notes } = parsed.data

    const hasPermissionResult = await hasPermission(userId, 'lead', 'UPDATE')
    if (!hasPermissionResult) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to assign leads' },
        { status: 403 }
      )
    }

    const [lead, employee] = await Promise.all([
      db.lead.findUnique({
        where: { id: leadId },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      db.employee.findFirst({
        where: {
          id: employeeId,
          status: 'ACTIVE',
          isActive: true,
          autoAssignEnabled: true,
          role: ASSIGNABLE_EMPLOYEE_ROLE_FILTER,
        },
        select: { id: true, firstName: true, lastName: true, email: true, companyId: true },
      }),
    ])

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }
    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not available for assignment' },
        { status: 404 }
      )
    }
    if (lead.companyId !== employee.companyId || lead.companyId !== sessionUser!.companyId) {
      return NextResponse.json(
        { success: false, error: 'Lead and employee belong to different companies' },
        { status: 403 }
      )
    }

    const previousAssigneeId = lead.assignedToId
    const previousAssigneeName = lead.assignedTo
      ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
      : null

    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: { assignedToId: employeeId, assignedAt: new Date() },
      include: {
        company: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    await createLeadHistory({
      leadId,
      employeeId,
      action: 'ASSIGNED',
      oldValue: { assignedToId: previousAssigneeId, assignedToName: previousAssigneeName },
      newValue: {
        assignedToId: employeeId,
        assignedToName: `${employee.firstName} ${employee.lastName}`,
      },
      notes: notes || `Assigned to ${employee.firstName} ${employee.lastName}`,
    })

    await db.notification.create({
      data: {
        title: 'New Lead Assigned',
        message: `${lead.firstName} ${lead.lastName} has been assigned to you`,
        type: 'INFO',
        category: 'LEAD',
        companyId: employee.companyId,
        employeeId,
        metadata: JSON.stringify({ leadId, leadNumber: lead.leadNumber }),
      },
    })

    if (previousAssigneeId && previousAssigneeId !== employeeId) {
      await db.notification.create({
        data: {
          title: 'Lead Reassigned',
          message: `${lead.firstName} ${lead.lastName} has been reassigned to ${employee.firstName} ${employee.lastName}`,
          type: 'INFO',
          category: 'LEAD',
          companyId: employee.companyId,
          employeeId: previousAssigneeId,
          metadata: JSON.stringify({ leadId, leadNumber: lead.leadNumber }),
        },
      })
    }

    invalidateCache('leads', employee.companyId)
    invalidateCache('pool', employee.companyId)

    return NextResponse.json({ success: true, data: updatedLead })
  } catch (error) {
    console.error('Error assigning lead:', error)
    return NextResponse.json({ success: false, error: 'Failed to assign lead' }, { status: 500 })
  }
}

/** Bulk-assign leads (one or many employees, with strategy). */
export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    const userId = sessionUser?.id
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    const json = await request.json()
    const parsed = bulkAssignSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { leadIds, employeeId, employeeIds, strategy = 'round_robin' } = parsed.data

    const targetEmployeeIds =
      employeeIds && employeeIds.length > 0
        ? employeeIds
        : employeeId
        ? [employeeId]
        : []

    if (targetEmployeeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one employee ID is required' },
        { status: 400 }
      )
    }

    const hasPermissionResult = await hasPermission(userId, 'lead', 'UPDATE')
    if (!hasPermissionResult) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to assign leads' },
        { status: 403 }
      )
    }

    const employees = await db.employee.findMany({
      where: {
        id: { in: targetEmployeeIds },
        status: 'ACTIVE',
        isActive: true,
        autoAssignEnabled: true,
        role: ASSIGNABLE_EMPLOYEE_ROLE_FILTER,
      },
      select: { id: true, firstName: true, lastName: true, email: true, companyId: true },
    })

    if (employees.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid employees found' },
        { status: 404 }
      )
    }

    const leads = await db.lead.findMany({
      where: { id: { in: leadIds }, isActive: true },
    })
    if (leads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid leads found' },
        { status: 404 }
      )
    }

    // Constrain leads to the same company as the employees
    const companyId = sessionUser!.companyId
    const crossCompanyEmployee = employees.some((employee) => employee.companyId !== companyId)
    if (crossCompanyEmployee) {
      return NextResponse.json(
        { success: false, error: 'All employees must belong to your company' },
        { status: 403 }
      )
    }
    const companyLeads = leads.filter((l) => l.companyId === companyId)
    if (companyLeads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leads belong to this company' },
        { status: 403 }
      )
    }

    const assignments: { [key: string]: string[] } = {}
    employees.forEach((emp) => (assignments[emp.id] = []))

    if (strategy === 'round_robin' || strategy === 'equal') {
      let i = 0
      for (const lead of companyLeads) {
        assignments[employees[i].id].push(lead.id)
        i = (i + 1) % employees.length
      }
    } else if (strategy === 'least_loaded') {
      const leadCounts = await Promise.all(
        employees.map(async (emp) => ({
          employeeId: emp.id,
          count: await db.lead.count({
            where: {
              assignedToId: emp.id,
              status: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'APPLICATION'] },
            },
          }),
        }))
      )
      leadCounts.sort((a, b) => a.count - b.count)
      for (const lead of companyLeads) {
        const minEmployee = leadCounts.reduce((min, curr) => (curr.count < min.count ? curr : min))
        assignments[minEmployee.employeeId].push(lead.id)
        minEmployee.count++
      }
    } else {
      assignments[employees[0].id] = companyLeads.map((l) => l.id)
    }

    const now = new Date()
    const historyRecords: any[] = []
    const notificationRecords: any[] = []

    for (const employee of employees) {
      const employeeLeadIds = assignments[employee.id]
      if (employeeLeadIds.length === 0) continue

      for (const lid of employeeLeadIds) {
        const lead = companyLeads.find((l) => l.id === lid)
        if (!lead) continue
        historyRecords.push({
          leadId: lid,
          employeeId: employee.id,
          action: 'BULK_ASSIGNED',
          oldValue: JSON.stringify({ assignedToId: lead.assignedToId }),
          newValue: JSON.stringify({ assignedToId: employee.id }),
          notes: `Bulk assigned to ${employee.firstName} ${employee.lastName} using ${strategy} strategy`,
        })
      }
      notificationRecords.push({
        title: 'Bulk Lead Assignment',
        message: `${employeeLeadIds.length} lead${employeeLeadIds.length > 1 ? 's have' : ' has'} been assigned to you`,
        type: 'INFO',
        category: 'LEAD',
        companyId: employee.companyId,
        employeeId: employee.id,
        metadata: JSON.stringify({ leadIds: employeeLeadIds, count: employeeLeadIds.length, strategy }),
      })
    }

    await db.$transaction([
      ...employees.flatMap((employee) => {
        const ids = assignments[employee.id]
        if (ids.length === 0) return []
        return [
          db.lead.updateMany({
            where: { id: { in: ids } },
            data: { assignedToId: employee.id, assignedAt: now },
          }),
        ]
      }),
      ...(historyRecords.length > 0 ? [db.leadHistory.createMany({ data: historyRecords })] : []),
      ...(notificationRecords.length > 0 ? [db.notification.createMany({ data: notificationRecords })] : []),
    ])

    invalidateCache('leads', companyId)
    invalidateCache('pool', companyId)

    return NextResponse.json({
      success: true,
      data: {
        assignedLeads: companyLeads.length,
        employees: employees.map((emp) => `${emp.firstName} ${emp.lastName}`),
        strategy,
        distribution: Object.keys(assignments).map((empId) => {
          const emp = employees.find((e) => e.id === empId)
          return {
            employee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
            leadCount: assignments[empId].length,
          }
        }),
      },
    })
  } catch (error) {
    console.error('Error in bulk lead assignment:', error)
    return NextResponse.json({ success: false, error: 'Failed to assign leads' }, { status: 500 })
  }
}

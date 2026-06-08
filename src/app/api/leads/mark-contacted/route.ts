import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/cache'
import { hasPermission } from '@/lib/rbac'
import { markContactedSchema } from '@/lib/leads-validation'

/**
 * Mark a lead as contacted.
 * Either the assignee OR a user with the `lead.UPDATE` permission (admin/manager) can do this.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      )
    }

    const json = await request.json()
    const parsed = markContactedSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { leadId } = parsed.data

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Authorization: the assignee OR a user with the `lead.UPDATE` permission can mark contacted
    const isAssignee = lead.assignedToId === userId
    if (!isAssignee) {
      const canUpdate = await hasPermission(userId, 'lead', 'UPDATE')
      if (!canUpdate) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions to mark this lead as contacted' },
          { status: 403 }
        )
      }
    }

    // Update the lead to mark as contacted and set status to CONTACTED
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: {
        contactedAt: new Date(),
        status: 'CONTACTED',
        updatedAt: new Date(),
      },
    })

    invalidateCache('leads', lead.companyId)

    return NextResponse.json({
      success: true,
      data: updatedLead,
    })
  } catch (error) {
    console.error('Error marking lead as contacted:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to mark lead as contacted' },
      { status: 500 }
    )
  }
}

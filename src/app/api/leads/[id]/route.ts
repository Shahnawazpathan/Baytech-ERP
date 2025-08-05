import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lead = await db.lead.findUnique({
      where: { id: params.id },
      include: {
        company: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: {
              select: {
                name: true
              }
            }
          }
        },
        history: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: lead
    })
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lead' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      loanAmount,
      propertyType,
      propertyValue,
      creditScore,
      income,
      source,
      status,
      priority,
      assignedToId,
      notes,
      tags,
      metadata
    } = body

    // Get existing lead for audit log
    const existingLead = await db.lead.findUnique({
      where: { id: params.id }
    })

    if (!existingLead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (loanAmount !== undefined) updateData.loanAmount = loanAmount
    if (propertyType !== undefined) updateData.propertyType = propertyType
    if (propertyValue !== undefined) updateData.propertyValue = propertyValue
    if (creditScore !== undefined) updateData.creditScore = creditScore
    if (income !== undefined) updateData.income = income
    if (source !== undefined) updateData.source = source
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId
    if (notes !== undefined) updateData.notes = notes
    if (tags !== undefined) updateData.tags = tags ? JSON.stringify(tags) : null
    if (metadata !== undefined) updateData.metadata = metadata ? JSON.stringify(metadata) : null

    const updatedLead = await db.lead.update({
      where: { id: params.id },
      data: updateData,
      include: {
        company: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Create lead history for status changes
    if (status && status !== existingLead.status) {
      await db.leadHistory.create({
        data: {
          leadId: params.id,
          action: 'STATUS_CHANGED',
          oldValue: JSON.stringify({ status: existingLead.status }),
          newValue: JSON.stringify({ status }),
          notes: notes || `Status changed from ${existingLead.status} to ${status}`
        }
      })

      // Create notification for status change
      await db.notification.create({
        data: {
          title: 'Lead Status Updated',
          message: `${existingLead.firstName} ${existingLead.lastName} status changed to ${status}`,
          type: 'INFO',
          category: 'LEAD',
          companyId: existingLead.companyId,
          employeeId: existingLead.assignedToId,
          metadata: JSON.stringify({ leadId: params.id, oldStatus: existingLead.status, newStatus: status })
        }
      })
    }

    // Create lead history for assignment changes
    if (assignedToId && assignedToId !== existingLead.assignedToId) {
      const newEmployee = assignedToId ? await db.employee.findUnique({
        where: { id: assignedToId },
        select: { firstName: true, lastName: true }
      }) : null

      await db.leadHistory.create({
        data: {
          leadId: params.id,
          action: 'ASSIGNED',
          oldValue: JSON.stringify({ assignedToId: existingLead.assignedToId }),
          newValue: JSON.stringify({ assignedToId }),
          notes: newEmployee ? `Assigned to ${newEmployee.firstName} ${newEmployee.lastName}` : 'Unassigned'
        }
      })

      // Create notification for new assignment
      if (assignedToId) {
        await db.notification.create({
          data: {
            title: 'Lead Assigned',
            message: `${existingLead.firstName} ${existingLead.lastName} assigned to you`,
            type: 'INFO',
            category: 'LEAD',
            companyId: existingLead.companyId,
            employeeId: assignedToId,
            metadata: JSON.stringify({ leadId: params.id })
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedLead
    })
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingLead = await db.lead.findUnique({
      where: { id: params.id }
    })

    if (!existingLead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    const deletedLead = await db.lead.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    // Create lead history
    await db.leadHistory.create({
      data: {
        leadId: params.id,
        action: 'DELETED',
        oldValue: JSON.stringify(existingLead),
        notes: 'Lead deleted'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete lead' },
      { status: 500 }
    )
  }
}
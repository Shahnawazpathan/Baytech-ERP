import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employee = await db.employee.findUnique({
      where: { id: params.id },
      include: {
        company: true,
        department: true,
        role: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        subordinates: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: employee
    })
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employee' },
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
      dateOfBirth,
      hireDate,
      terminationDate,
      position,
      departmentId,
      roleId,
      managerId,
      salary,
      status
    } = body

    // Get existing employee for audit log
    const existingEmployee = await db.employee.findUnique({
      where: { id: params.id }
    })

    if (!existingEmployee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Check if email already exists for different employee
    if (email && email !== existingEmployee.email) {
      const emailExists = await db.employee.findUnique({
        where: { email }
      })

      if (emailExists) {
        return NextResponse.json(
          { success: false, error: 'Employee with this email already exists' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null
    if (hireDate !== undefined) updateData.hireDate = new Date(hireDate)
    if (terminationDate !== undefined) updateData.terminationDate = terminationDate ? new Date(terminationDate) : null
    if (position !== undefined) updateData.position = position
    if (departmentId !== undefined) updateData.departmentId = departmentId
    if (roleId !== undefined) updateData.roleId = roleId
    if (managerId !== undefined) updateData.managerId = managerId
    if (salary !== undefined) updateData.salary = salary
    if (status !== undefined) updateData.status = status

    const updatedEmployee = await db.employee.update({
      where: { id: params.id },
      data: updateData,
      include: {
        company: true,
        department: true,
        role: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Employee',
        entityId: params.id,
        companyId: existingEmployee.companyId,
        oldValues: JSON.stringify(existingEmployee),
        newValues: JSON.stringify(updatedEmployee),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedEmployee
    })
  } catch (error) {
    console.error('Error updating employee:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update employee' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingEmployee = await db.employee.findUnique({
      where: { id: params.id }
    })

    if (!existingEmployee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    const deletedEmployee = await db.employee.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'Employee',
        entityId: params.id,
        companyId: existingEmployee.companyId,
        oldValues: JSON.stringify(existingEmployee),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting employee:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete employee' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDubaiTime, formatDubaiTime } from '@/lib/timezone'

// Update an attendance record
export async function PUT(request: NextRequest, context: any) {
  try {
    const { id } = context.params;
    const body = await request.json()
    
    // Check if attendance record exists
    const existingAttendance = await db.attendance.findUnique({
      where: { id }
    })
    
    if (!existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      )
    }
    
    // Update the attendance record
    const updatedAttendance = await db.attendance.update({
      where: { id },
      data: {
        employeeId: body.employeeId,
        companyId: body.companyId,
        checkInTime: body.checkInTime ? new Date(body.checkInTime) : existingAttendance.checkInTime,
        checkOutTime: body.checkOutTime ? new Date(body.checkOutTime) : body.checkOutTime, // Allow null
        checkInLat: body.checkInLat !== undefined ? body.checkInLat : existingAttendance.checkInLat,
        checkInLng: body.checkInLng !== undefined ? body.checkInLng : existingAttendance.checkInLng,
        checkOutLat: body.checkOutLat,
        checkOutLng: body.checkOutLng,
        checkInAddress: body.checkInAddress,
        checkOutAddress: body.checkOutAddress,
        status: body.status,
        notes: body.notes,
        isVerified: body.isVerified !== undefined ? body.isVerified : existingAttendance.isVerified,
        updatedAt: getDubaiTime()
      },
      include: {
        employee: {
          include: {
            department: true
          }
        },
        company: true
      }
    })

    // Transform the updated attendance to match expected format with Dubai timezone
    const transformedRecord = {
      id: updatedAttendance.id,
      name: `${updatedAttendance.employee.firstName} ${updatedAttendance.employee.lastName}`,
      employeeId: updatedAttendance.employeeId,
      department: updatedAttendance.employee.department?.name || 'Unknown',
      checkIn: updatedAttendance.checkInTime ? formatDubaiTime(updatedAttendance.checkInTime, 'hh:mm a') : '-',
      checkOut: updatedAttendance.checkOutTime ? formatDubaiTime(updatedAttendance.checkOutTime, 'hh:mm a') : '-',
      status: updatedAttendance.status,
      location: updatedAttendance.checkInAddress || 'Unknown',
      coordinates: updatedAttendance.checkInLat && updatedAttendance.checkInLng ? { lat: updatedAttendance.checkInLat, lng: updatedAttendance.checkInLng } : null,
      checkInTime: updatedAttendance.checkInTime,
      checkOutTime: updatedAttendance.checkOutTime,
      createdAt: updatedAttendance.createdAt,
      updatedAt: updatedAttendance.updatedAt
    }

    return NextResponse.json(transformedRecord)
  } catch (error) {
    console.error('Error updating attendance:', error)
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    )
  }
}

// Get a single attendance record
export async function GET(request: NextRequest, context: any) {
  try {
    const { id } = context.params;
    
    const attendance = await db.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            department: true
          }
        },
        company: true
      }
    })

    if (!attendance) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      )
    }

    // Transform the attendance to match expected format with Dubai timezone
    const transformedRecord = {
      id: attendance.id,
      name: `${attendance.employee.firstName} ${attendance.employee.lastName}`,
      employeeId: attendance.employeeId,
      department: attendance.employee.department?.name || 'Unknown',
      checkIn: attendance.checkInTime ? formatDubaiTime(attendance.checkInTime, 'hh:mm a') : '-',
      checkOut: attendance.checkOutTime ? formatDubaiTime(attendance.checkOutTime, 'hh:mm a') : '-',
      status: attendance.status,
      location: attendance.checkInAddress || 'Unknown',
      coordinates: attendance.checkInLat && attendance.checkInLng ? { lat: attendance.checkInLat, lng: attendance.checkInLng } : null,
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt
    }

    return NextResponse.json(transformedRecord)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

// Delete an attendance record
export async function DELETE(request: NextRequest, context: any) {
  try {
    const { id } = context.params;
    
    // Check if attendance record exists
    const existingAttendance = await db.attendance.findUnique({
      where: { id }
    })
    
    if (!existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      )
    }
    
    // Delete the attendance record
    await db.attendance.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Attendance record deleted successfully' })
  } catch (error) {
    console.error('Error deleting attendance:', error)
    return NextResponse.json(
      { error: 'Failed to delete attendance' },
      { status: 500 }
    )
  }
}

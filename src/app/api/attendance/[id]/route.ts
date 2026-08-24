import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatDubaiTime } from '@/lib/timezone'
import { getSessionUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE']

function transformRecord(record: any) {
  return {
    id: record.id,
    name: `${record.employee.firstName} ${record.employee.lastName}`,
    employeeId: record.employeeId,
    department: record.employee.department?.name || 'Unknown',
    checkIn: record.checkInTime ? formatDubaiTime(record.checkInTime, 'hh:mm a') : '-',
    checkOut: record.checkOutTime ? formatDubaiTime(record.checkOutTime, 'hh:mm a') : '-',
    status: record.status,
    location: record.checkInAddress || 'Unknown',
    coordinates:
      record.checkInLat && record.checkInLng
        ? { lat: record.checkInLat, lng: record.checkInLng }
        : null,
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime,
    totalHours: record.totalHours,
    isVerified: record.isVerified,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

// Update an attendance record (admin/permissioned correction of times/status only)
export async function PUT(request: NextRequest, context: any) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await hasPermission(sessionUser.id, 'attendance', 'UPDATE'))) {
      return NextResponse.json({ error: 'Insufficient permissions to update attendance' }, { status: 403 })
    }

    const { id } = context.params;
    const body = await request.json()

    // Scoped to caller's company - identity and tenant can never be reassigned via this endpoint
    const existingAttendance = await db.attendance.findFirst({
      where: { id, companyId: sessionUser.companyId },
    })

    if (!existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      )
    }

    if (
      body.status !== undefined &&
      (typeof body.status !== 'string' || !ATTENDANCE_STATUSES.includes(body.status.toUpperCase()))
    ) {
      return NextResponse.json(
        { error: `Status must be one of: ${ATTENDANCE_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Update the attendance record (times/status/notes only)
    const updatedAttendance = await db.attendance.update({
      where: { id },
      data: {
        checkInTime:
          body.checkInTime && !isNaN(Date.parse(body.checkInTime))
            ? new Date(body.checkInTime)
            : existingAttendance.checkInTime,
        checkOutTime:
          body.checkOutTime === null
            ? null
            : body.checkOutTime && !isNaN(Date.parse(body.checkOutTime))
              ? new Date(body.checkOutTime)
              : existingAttendance.checkOutTime,
        status: typeof body.status === 'string' ? body.status.toUpperCase() : existingAttendance.status,
        notes: typeof body.notes === 'string' ? body.notes : existingAttendance.notes,
        updatedAt: new Date(),
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

    return NextResponse.json(transformRecord(updatedAttendance))
  } catch (error) {
    console.error('Error updating attendance:', error)
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    )
  }
}

// Get a single attendance record (own record, or any with READ permission)
export async function GET(request: NextRequest, context: any) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = context.params;

    const canReadAll =
      (await hasPermission(sessionUser.id, 'attendance', 'READ')) ||
      sessionUser.role.toLowerCase().includes('admin') ||
      sessionUser.role.toLowerCase().includes('manager')

    const attendance = await db.attendance.findFirst({
      where: {
        id,
        companyId: sessionUser.companyId,
        ...(canReadAll ? {} : { employeeId: sessionUser.id }),
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

    if (!attendance) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(transformRecord(attendance))
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
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await hasPermission(sessionUser.id, 'attendance', 'DELETE'))) {
      return NextResponse.json({ error: 'Insufficient permissions to delete attendance' }, { status: 403 })
    }

    const { id } = context.params;

    // Scoped to caller's company
    const existingAttendance = await db.attendance.findFirst({
      where: { id, companyId: sessionUser.companyId },
      select: { id: true },
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

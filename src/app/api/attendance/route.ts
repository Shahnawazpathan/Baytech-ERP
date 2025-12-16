import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDubaiTime, getDubaiTodayRange, formatDubaiTime } from '@/lib/timezone'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'

    // Get today's date range in Dubai timezone for filtering attendance records
    const { start: todayStart, end: todayEnd } = getDubaiTodayRange()

    const attendanceRecords = await db.attendance.findMany({
      where: {
        companyId,
        checkInTime: {
          gte: todayStart,
          lt: todayEnd
        }
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

    // Transform the data to match the expected format with Dubai timezone
    const transformedRecords = attendanceRecords.map(record => ({
      id: record.id,
      employeeId: record.employeeId,
      name: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department?.name || 'Unknown',
      checkIn: record.checkInTime ? formatDubaiTime(record.checkInTime, 'hh:mm a') : '-',
      checkOut: record.checkOutTime ? formatDubaiTime(record.checkOutTime, 'hh:mm a') : '-',
      status: record.status,
      location: record.checkInAddress || 'Unknown',
      coordinates: record.checkInLat && record.checkInLng ? { lat: record.checkInLat, lng: record.checkInLng } : null,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }))

    return NextResponse.json(transformedRecords)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // This route handles check-in/check-out based on whether checkOutTime exists in the body
    // Get today's date range in Dubai timezone
    const { start: todayStart, end: todayEnd } = getDubaiTodayRange()

    // Check if there's already a check-in record for today for this employee
    const existingAttendance = await db.attendance.findFirst({
      where: {
        employeeId: body.employeeId,
        checkInTime: {
          gte: todayStart,
          lt: todayEnd
        }
      }
    })

    if (body.checkOutTime) {
      // This is a check-out request
      if (!existingAttendance) {
        return NextResponse.json(
          { error: 'No check-in record found for today' },
          { status: 404 }
        )
      }

      if (existingAttendance.checkOutTime) {
        return NextResponse.json(
          { error: 'Already checked out today' },
          { status: 400 }
        )
      }

      // Update the existing record with check-out time
      const updatedAttendance = await db.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          checkOutTime: new Date(body.checkOutTime),
          checkOutLat: body.latitude,
          checkOutLng: body.longitude,
          checkOutAddress: body.address,
          notes: body.notes
        },
        include: {
          employee: {
          include: {
            department: true
          }
        }
        }
      })

      // Transform the updated record to match expected format with Dubai timezone
      const transformedRecord = {
        id: updatedAttendance.id,
        employeeId: updatedAttendance.employeeId,
        name: `${updatedAttendance.employee.firstName} ${updatedAttendance.employee.lastName}`,
        department: updatedAttendance.employee.department?.name || 'Unknown',
        checkIn: updatedAttendance.checkInTime ? formatDubaiTime(updatedAttendance.checkInTime, 'hh:mm a') : '-',
        checkOut: updatedAttendance.checkOutTime ? formatDubaiTime(updatedAttendance.checkOutTime, 'hh:mm a') : '-',
        status: updatedAttendance.status,
        location: updatedAttendance.checkOutAddress || 'Unknown',
        coordinates: updatedAttendance.checkOutLat && updatedAttendance.checkOutLng ? { lat: updatedAttendance.checkOutLat, lng: updatedAttendance.checkOutLng } : null,
        checkInTime: updatedAttendance.checkInTime,
        checkOutTime: updatedAttendance.checkOutTime,
        createdAt: updatedAttendance.createdAt,
        updatedAt: updatedAttendance.updatedAt
      }

      return NextResponse.json(transformedRecord)
    } else {
      // This is a check-in request
      if (existingAttendance) {
        return NextResponse.json(
          { error: 'Already checked in today' },
          { status: 400 }
        )
      }

      // Create a new attendance record with check-in time (Dubai timezone)
      const attendance = await db.attendance.create({
        data: {
          employeeId: body.employeeId,
          companyId: body.companyId,
          checkInTime: getDubaiTime(),
          checkInLat: body.latitude,
          checkInLng: body.longitude,
          checkInAddress: body.address,
          notes: body.notes,
          status: 'PRESENT' // Default status, can be adjusted based on check-in time
        },
        include: {
          employee: {
          include: {
            department: true
          }
        }
        }
      })

      // Transform the created record to match expected format with Dubai timezone
      const transformedRecord = {
        id: attendance.id,
        employeeId: attendance.employeeId,
        name: `${attendance.employee.firstName} ${attendance.employee.lastName}`,
        department: attendance.employee.department?.name || 'Unknown',
        checkIn: attendance.checkInTime ? formatDubaiTime(attendance.checkInTime, 'hh:mm a') : '-',
        checkOut: '-',
        status: attendance.status,
        location: attendance.checkInAddress || 'Unknown',
        coordinates: attendance.checkInLat && attendance.checkInLng ? { lat: attendance.checkInLat, lng: attendance.checkInLng } : null,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt
      }

      return NextResponse.json(transformedRecord)
    }
  } catch (error) {
    console.error('Error processing attendance:', error)
    return NextResponse.json(
      { error: 'Failed to process attendance' },
      { status: 500 }
    )
  }
}
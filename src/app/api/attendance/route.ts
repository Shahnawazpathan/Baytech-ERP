import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    
    // Get today's date for filtering attendance records
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const attendanceRecords = await db.attendance.findMany({
      where: {
        companyId,
        checkInTime: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        employee: true,
        company: true
      }
    })

    // Transform the data to match the expected format
    const transformedRecords = attendanceRecords.map(record => ({
      id: record.id,
      employeeId: record.employeeId,
      name: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department?.name || 'Unknown',
      checkIn: record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
      checkOut: record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // Check if there's already a check-in record for today for this employee
    const existingAttendance = await db.attendance.findFirst({
      where: {
        employeeId: body.employeeId,
        checkInTime: {
          gte: today,
          lt: tomorrow
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
          employee: true
        }
      })

      // Transform the updated record to match expected format
      const transformedRecord = {
        id: updatedAttendance.id,
        employeeId: updatedAttendance.employeeId,
        name: `${updatedAttendance.employee.firstName} ${updatedAttendance.employee.lastName}`,
        department: updatedAttendance.employee.department?.name || 'Unknown',
        checkIn: updatedAttendance.checkInTime ? new Date(updatedAttendance.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
        checkOut: updatedAttendance.checkOutTime ? new Date(updatedAttendance.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
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

      // Create a new attendance record with check-in time
      const attendance = await db.attendance.create({
        data: {
          employeeId: body.employeeId,
          companyId: body.companyId,
          checkInTime: new Date(),
          checkInLat: body.latitude,
          checkInLng: body.longitude,
          checkInAddress: body.address,
          notes: body.notes,
          status: 'PRESENT' // Default status, can be adjusted based on check-in time
        },
        include: {
          employee: true
        }
      })

      // Transform the created record to match expected format
      const transformedRecord = {
        id: attendance.id,
        employeeId: attendance.employeeId,
        name: `${attendance.employee.firstName} ${attendance.employee.lastName}`,
        department: attendance.employee.department?.name || 'Unknown',
        checkIn: attendance.checkInTime ? new Date(attendance.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
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
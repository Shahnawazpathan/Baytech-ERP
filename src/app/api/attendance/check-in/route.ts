import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employeeId, companyId, latitude, longitude, address, notes } = body

    // Validate required fields
    if (!employeeId || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if employee exists and is active
    const employee = await db.employee.findUnique({
      where: { id: employeeId, companyId, isActive: true }
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found or inactive' },
        { status: 404 }
      )
    }

    // Check for existing attendance record for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const existingAttendance = await db.attendance.findFirst({
      where: {
        employeeId,
        companyId,
        checkInTime: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    if (existingAttendance) {
      return NextResponse.json(
        { success: false, error: 'Already checked in today' },
        { status: 400 }
      )
    }

    // Get current time
    const checkInTime = new Date()

    // Validate location if provided
    let locationVerified = false
    let checkInAddress = address
    let checkInLat = latitude
    let checkInLng = longitude

    if (latitude && longitude) {
      locationVerified = await verifyLocation(latitude, longitude, companyId)
      
      // Get address from coordinates if not provided
      if (!address) {
        checkInAddress = await getAddressFromCoordinates(latitude, longitude)
      }
    }

    // Calculate attendance status
    const status = calculateAttendanceStatus(checkInTime, employee)

    const attendance = await db.attendance.create({
      data: {
        employeeId,
        companyId,
        checkInTime,
        checkInLat,
        checkInLng,
        checkInAddress,
        status,
        notes,
        isVerified: locationVerified
      },
      include: {
        company: true,
        employee: {
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
        }
      }
    })

    // Create notifications
    if (status === 'LATE') {
      await db.notification.create({
        data: {
          title: 'Late Arrival',
          message: `${employee.firstName} ${employee.lastName} arrived late today`,
          type: 'WARNING',
          category: 'ATTENDANCE',
          companyId,
          employeeId,
          metadata: JSON.stringify({ attendanceId: attendance.id, status, checkInTime })
        }
      })
    }

    // Notify manager if location verification failed
    if (!locationVerified && (latitude || longitude)) {
      await db.notification.create({
        data: {
          title: 'Location Verification Failed',
          message: `${employee.firstName} ${employee.lastName} checked in from unverified location`,
          type: 'WARNING',
          category: 'ATTENDANCE',
          companyId,
          employeeId: employee.managerId,
          metadata: JSON.stringify({ 
            attendanceId: attendance.id, 
            employeeId, 
            location: { lat: latitude, lng: longitude }
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: attendance
    })
  } catch (error) {
    console.error('Error checking in:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check in' },
      { status: 500 }
    )
  }
}

// Helper functions
async function verifyLocation(lat: number, lng: number, companyId: string): Promise<boolean> {
  try {
    // In a real implementation, you would:
    // 1. Get company office location from database
    // 2. Calculate distance between employee location and office
    // 3. Check if within acceptable radius (e.g., 100 meters)
    
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { address: true }
    })

    if (!company || !company.address) {
      return false
    }

    // Simulate distance calculation (in real app, use geocoding API)
    const distance = Math.random() * 200 // Random distance in meters
    
    return distance <= 100 // Within 100 meters
  } catch (error) {
    console.error('Error verifying location:', error)
    return false
  }
}

async function getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
  try {
    // In a real implementation, you would use a geocoding service like Google Maps API
    // For demo purposes, return a simulated address
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch (error) {
    console.error('Error getting address from coordinates:', error)
    return 'Unknown location'
  }
}

function calculateAttendanceStatus(checkInTime: Date, employee: any): string {
  // Get company settings or use default (9:00 AM start time)
  const officeStartTime = new Date(checkInTime)
  officeStartTime.setHours(9, 0, 0, 0) // 9:00 AM
  
  const gracePeriod = 15 // 15 minutes grace period
  const lateThreshold = new Date(officeStartTime.getTime() + gracePeriod * 60000)

  if (checkInTime <= lateThreshold) {
    return 'PRESENT'
  } else {
    return 'LATE'
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDubaiTime, getDubaiTodayRange, isLateCheckIn } from '@/lib/timezone'

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

    // Check for existing attendance record for today (Dubai time)
    const { start: todayStart, end: todayEnd } = getDubaiTodayRange()

    const existingAttendance = await db.attendance.findFirst({
      where: {
        employeeId,
        companyId,
        checkInTime: {
          gte: todayStart,
          lt: todayEnd
        }
      }
    })

    if (existingAttendance) {
      return NextResponse.json(
        { success: false, error: 'Already checked in today' },
        { status: 400 }
      )
    }

    // Get current time in Dubai timezone
    const checkInTime = getDubaiTime()

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
        isVerified: locationVerified,
        locationId: body.locationId,
        locationName: body.locationName
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
    // Get all active geofence locations for the company
    const geofenceLocations = await db.geofenceLocation.findMany({
      where: { companyId, isActive: true }
    })

    if (geofenceLocations.length === 0) {
      // If no geofence locations configured, allow check-in
      return true
    }

    // Check if the user is within any geofence
    for (const location of geofenceLocations) {
      const distance = calculateDistance(lat, lng, location.latitude, location.longitude)
      if (distance <= location.radius) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Error verifying location:', error)
    return false
  }
}

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
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
  // Check if employee is late based on Dubai timezone
  // Default office start time: 9:00 AM with 15 minutes grace period
  const late = isLateCheckIn(checkInTime, 9, 0, 15)

  return late ? 'LATE' : 'PRESENT'
}
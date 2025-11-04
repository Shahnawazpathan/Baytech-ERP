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

    // Find today's attendance record
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

    if (!existingAttendance) {
      return NextResponse.json(
        { success: false, error: 'No check-in record found for today' },
        { status: 404 }
      )
    }

    if (existingAttendance.checkOutTime) {
      return NextResponse.json(
        { success: false, error: 'Already checked out today' },
        { status: 400 }
      )
    }

    // Get current time
    const checkOutTime = new Date()

    // Validate location if provided
    let locationVerified = false
    let checkOutAddress = address
    let checkOutLat = latitude
    let checkOutLng = longitude

    if (latitude && longitude) {
      locationVerified = await verifyLocation(latitude, longitude, companyId)
      
      // Get address from coordinates if not provided
      if (!address) {
        checkOutAddress = await getAddressFromCoordinates(latitude, longitude)
      }
    }

    // Calculate total hours
    const totalHours = calculateTotalHours(
      existingAttendance.checkInTime,
      checkOutTime,
      existingAttendance.breakStartTime,
      existingAttendance.breakEndTime
    )

    // Update attendance record
    const updatedAttendance = await db.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        checkOutTime,
        checkOutLat,
        checkOutLng,
        checkOutAddress,
        totalHours,
        notes: notes || existingAttendance.notes,
        isVerified: existingAttendance.isVerified && locationVerified
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

    // Create notification for early checkout
    const minimumWorkHours = 8 // 8 hours
    if (totalHours < minimumWorkHours) {
      await db.notification.create({
        data: {
          title: 'Early Checkout',
          message: `${employee.firstName} ${employee.lastName} checked out early (${totalHours} hours)`,
          type: 'WARNING',
          category: 'ATTENDANCE',
          companyId,
          employeeId: employee.managerId,
          metadata: JSON.stringify({ 
            attendanceId: existingAttendance.id, 
            totalHours,
            employeeId
          })
        }
      })
    }

    // Notify manager if location verification failed
    if (!locationVerified && (latitude || longitude)) {
      await db.notification.create({
        data: {
          title: 'Checkout Location Verification Failed',
          message: `${employee.firstName} ${employee.lastName} checked out from unverified location`,
          type: 'WARNING',
          category: 'ATTENDANCE',
          companyId,
          employeeId: employee.managerId,
          metadata: JSON.stringify({ 
            attendanceId: existingAttendance.id, 
            employeeId, 
            location: { lat: latitude, lng: longitude }
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedAttendance
    })
  } catch (error) {
    console.error('Error checking out:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check out' },
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
      // If no geofence locations configured, allow check-out
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
    // In a real implementation, use geocoding service
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch (error) {
    console.error('Error getting address from coordinates:', error)
    return 'Unknown location'
  }
}

function calculateTotalHours(
  checkInTime: Date, 
  checkOutTime: Date, 
  breakStartTime?: Date | null, 
  breakEndTime?: Date | null
): number {
  let totalMs = checkOutTime.getTime() - checkInTime.getTime()
  
  // Subtract break time if provided
  if (breakStartTime && breakEndTime) {
    const breakMs = breakEndTime.getTime() - breakStartTime.getTime()
    totalMs -= breakMs
  }
  
  return Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100 // Round to 2 decimal places
}
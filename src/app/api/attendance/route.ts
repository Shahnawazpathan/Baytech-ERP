import { NextRequest, NextResponse } from 'next/server'

// Mock database
let attendanceRecords = [
  {
    id: 1,
    name: "Alice Johnson",
    department: "Sales",
    checkIn: "09:00 AM",
    checkOut: "05:30 PM",
    status: "PRESENT",
    location: "Office",
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  {
    id: 2,
    name: "Bob Smith",
    department: "IT",
    checkIn: "08:45 AM",
    checkOut: "-",
    status: "PRESENT",
    location: "Remote",
    coordinates: { lat: 40.7589, lng: -73.9851 }
  }
]

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: attendanceRecords,
      total: attendanceRecords.length
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch attendance records' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, name, location, coordinates } = body

    if (!action || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const now = new Date()
    const timeString = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })

    let record = attendanceRecords.find(r => r.name === name)
    
    if (!record) {
      // Create new record if not found
      record = {
        id: attendanceRecords.length + 1,
        name,
        department: "Unknown",
        checkIn: "-",
        checkOut: "-",
        status: "ABSENT",
        location: "-",
        coordinates: null
      }
      attendanceRecords.push(record)
    }

    if (action === 'checkIn') {
      record.checkIn = timeString
      record.status = "PRESENT"
      record.location = location || "Office"
      record.coordinates = coordinates || null
    } else if (action === 'checkOut') {
      record.checkOut = timeString
      record.location = location || "Office"
      record.coordinates = coordinates || null
    }

    return NextResponse.json({
      success: true,
      data: record,
      message: `${action} completed successfully`
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to process ${action}` },
      { status: 500 }
    )
  }
}
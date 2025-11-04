import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'

    const locations = await db.geofenceLocation.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ success: true, data: locations })
  } catch (error) {
    console.error('Error fetching geofence locations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch geofence locations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, address, latitude, longitude, radius, companyId } = body

    // Validate required fields
    if (!name || !address || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    // Create the geofence location
    const location = await db.geofenceLocation.create({
      data: {
        name,
        address,
        latitude,
        longitude,
        radius: radius || 100,
        companyId: companyId || 'default-company',
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      data: location
    })
  } catch (error) {
    console.error('Error creating geofence location:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create geofence location' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, address, latitude, longitude, radius, isActive } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Location ID is required' },
        { status: 400 }
      )
    }

    // Build update data object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (address !== undefined) updateData.address = address
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude
    if (radius !== undefined) updateData.radius = radius
    if (isActive !== undefined) updateData.isActive = isActive

    const location = await db.geofenceLocation.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: location
    })
  } catch (error) {
    console.error('Error updating geofence location:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update geofence location' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Location ID is required' },
        { status: 400 }
      )
    }

    await db.geofenceLocation.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Geofence location deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting geofence location:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete geofence location' },
      { status: 500 }
    )
  }
}

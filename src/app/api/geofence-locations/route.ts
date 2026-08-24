import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const locations = await db.geofenceLocation.findMany({
      where: {
        companyId: sessionUser.companyId,
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
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins/managers may manage geofences (they gate attendance verification)
    const roleLower = sessionUser.role.toLowerCase()
    if (!roleLower.includes('admin') && !roleLower.includes('manager')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to manage geofence locations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const address = typeof body?.address === 'string' ? body.address.trim() : ''
    const latitude = Number(body?.latitude)
    const longitude = Number(body?.longitude)
    const radius = Number(body?.radius) || 100

    // Validate required fields
    if (!name || !address || isNaN(latitude) || isNaN(longitude)) {
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

    if (radius < 10 || radius > 10000) {
      return NextResponse.json(
        { success: false, error: 'Radius must be between 10 and 10000 meters' },
        { status: 400 }
      )
    }

    // Create the geofence location scoped to the session company
    const location = await db.geofenceLocation.create({
      data: {
        name,
        address,
        latitude,
        longitude,
        radius,
        companyId: sessionUser.companyId,
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
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roleLower = sessionUser.role.toLowerCase()
    if (!roleLower.includes('admin') && !roleLower.includes('manager')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to manage geofence locations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, address, latitude, longitude, radius, isActive } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Location ID is required' },
        { status: 400 }
      )
    }

    // Scoped to caller's company
    const existing = await db.geofenceLocation.findFirst({
      where: { id, companyId: sessionUser.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Geofence location not found' }, { status: 404 })
    }

    if (
      (latitude !== undefined && (isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) ||
      (longitude !== undefined && (isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180))
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    // Build update data object
    const updateData: any = {}
    if (typeof name === 'string' && name.trim()) updateData.name = name.trim()
    if (typeof address === 'string' && address.trim()) updateData.address = address.trim()
    if (latitude !== undefined) updateData.latitude = Number(latitude)
    if (longitude !== undefined) updateData.longitude = Number(longitude)
    if (radius !== undefined) {
      const r = Number(radius)
      if (isNaN(r) || r < 10 || r > 10000) {
        return NextResponse.json(
          { success: false, error: 'Radius must be between 10 and 10000 meters' },
          { status: 400 }
        )
      }
      updateData.radius = r
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

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
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roleLower = sessionUser.role.toLowerCase()
    if (!roleLower.includes('admin') && !roleLower.includes('manager')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to manage geofence locations' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Location ID is required' },
        { status: 400 }
      )
    }

    // Scoped to caller's company
    const existing = await db.geofenceLocation.findFirst({
      where: { id, companyId: sessionUser.companyId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Geofence location not found' }, { status: 404 })
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

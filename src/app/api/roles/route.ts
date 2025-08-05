import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    const where: any = {}
    
    if (companyId) {
      where.companyId = companyId
    }

    const roles = await db.role.findMany({
      where,
      include: {
        company: true,
        permissions: {
          include: {
            permission: true
          }
        },
        _count: {
          select: {
            employees: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: roles
    })
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { name, description, companyId, permissionIds } = body

    if (!name || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if role already exists for this company
    const existingRole = await db.role.findFirst({
      where: {
        name,
        companyId
      }
    })

    if (existingRole) {
      return NextResponse.json(
        { success: false, error: 'Role with this name already exists' },
        { status: 400 }
      )
    }

    const role = await db.role.create({
      data: {
        name,
        description,
        companyId,
        permissions: permissionIds ? {
          create: permissionIds.map((permissionId: string) => ({
            permissionId
          }))
        } : undefined
      },
      include: {
        company: true,
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: role
    })
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create role' },
      { status: 500 }
    )
  }
}
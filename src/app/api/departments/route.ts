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

    const departments = await db.department.findMany({
      where,
      include: {
        company: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
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
      data: departments
    })
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch departments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { name, description, companyId, managerId } = body

    if (!name || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if department already exists for this company
    const existingDepartment = await db.department.findFirst({
      where: {
        name,
        companyId
      }
    })

    if (existingDepartment) {
      return NextResponse.json(
        { success: false, error: 'Department with this name already exists' },
        { status: 400 }
      )
    }

    const department = await db.department.create({
      data: {
        name,
        description,
        companyId,
        managerId
      },
      include: {
        company: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: department
    })
  } catch (error) {
    console.error('Error creating department:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create department' },
      { status: 500 }
    )
  }
}
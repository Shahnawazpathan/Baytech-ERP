import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    
    // Get today's date for filtering
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // Get yesterday's date for comparison
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    // Fetch all required stats
    const totalLeads = await db.lead.count({
      where: { 
        companyId,
        isActive: true
      }
    })
    
    const activeLeads = await db.lead.count({
      where: { 
        companyId,
        isActive: true,
        status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] }
      }
    })
    
    const convertedLeads = await db.lead.count({
      where: { 
        companyId,
        isActive: true,
        status: 'APPLICATION' // Assuming APPLICATION means converted
      }
    })
    
    const totalEmployees = await db.employee.count({
      where: { 
        companyId,
        isActive: true
      }
    })
    
    const attendanceRecords = await db.attendance.count({
      where: {
        companyId,
        checkInTime: {
          gte: today,
          lt: tomorrow
        }
      }
    })
    
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

    const stats = {
      totalLeads,
      activeLeads,
      convertedLeads,
      totalEmployees,
      presentToday: attendanceRecords,
      conversionRate: parseFloat(conversionRate.toFixed(1))
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching overview stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overview stats' },
      { status: 500 }
    )
  }
}
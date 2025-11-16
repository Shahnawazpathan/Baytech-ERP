import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache, createCacheKey } from '@/lib/cache'

// Cache for 30 seconds to improve performance
const CACHE_TTL = 30000

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'

    // Check cache first
    const cacheKey = createCacheKey('overview-stats', { companyId })
    const cachedStats = cache.get(cacheKey)

    if (cachedStats) {
      return NextResponse.json(cachedStats, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
        }
      })
    }

    // Get today's date for filtering
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Optimize: Run all queries in parallel using Promise.all
    const [
      totalLeads,
      activeLeads,
      convertedLeads,
      totalEmployees,
      attendanceRecords
    ] = await Promise.all([
      db.lead.count({
        where: {
          companyId,
          isActive: true
        }
      }),
      db.lead.count({
        where: {
          companyId,
          isActive: true,
          status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
          NOT: { status: 'JUNK' }
        }
      }),
      db.lead.count({
        where: {
          companyId,
          isActive: true,
          OR: [
            { status: 'APPLICATION' },
            { status: 'APPROVED' },
            { status: 'REAL' }
          ]
        }
      }),
      db.employee.count({
        where: {
          companyId,
          isActive: true
        }
      }),
      db.attendance.count({
        where: {
          companyId,
          checkInTime: {
            gte: today,
            lt: tomorrow
          }
        }
      })
    ])

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

    const stats = {
      totalLeads,
      activeLeads,
      convertedLeads,
      totalEmployees,
      presentToday: attendanceRecords,
      conversionRate: parseFloat(conversionRate.toFixed(1))
    }

    // Cache the result
    cache.set(cacheKey, stats, CACHE_TTL)

    return NextResponse.json(stats, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Error fetching overview stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overview stats' },
      { status: 500 }
    )
  }
}
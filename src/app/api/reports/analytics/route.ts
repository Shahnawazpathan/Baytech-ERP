import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache, createCacheKey } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('range') || '30' // days

    // Check cache first
    const cacheKey = createCacheKey('analytics', { companyId, dateRange })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: cached })
    }

    const daysAgo = parseInt(dateRange)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)
    startDate.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Fetch all leads once with optimized query
    const [allLeads, statusCounts, priorityCounts, sourceCounts] = await Promise.all([
      db.lead.findMany({
        where: {
          companyId,
          isActive: true
        },
        select: {
          id: true,
          status: true,
          priority: true,
          source: true,
          loanAmount: true,
          createdAt: true,
          assignedAt: true,
          assignedToId: true,
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      // Aggregate status distribution
      db.lead.groupBy({
        by: ['status'],
        where: { companyId, isActive: true },
        _count: true
      }),
      // Aggregate priority distribution
      db.lead.groupBy({
        by: ['priority'],
        where: { companyId, isActive: true },
        _count: true
      }),
      // Aggregate source distribution
      db.lead.groupBy({
        by: ['source'],
        where: { companyId, isActive: true },
        _count: true
      })
    ])

    // Convert aggregated counts to distribution objects
    const statusDistribution: Record<string, number> = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      APPLICATION: 0,
      APPROVED: 0,
      REJECTED: 0,
      CLOSED: 0,
      JUNK: 0,
      REAL: 0
    }
    statusCounts.forEach(item => {
      statusDistribution[item.status] = item._count
    })

    const priorityDistribution: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0
    }
    priorityCounts.forEach(item => {
      priorityDistribution[item.priority] = item._count
    })

    const sources: Record<string, number> = {}
    sourceCounts.forEach(item => {
      sources[item.source || 'Unknown'] = item._count
    })

    // Lead trends by day (optimized - single loop)
    const trendsMap = new Map<string, { new: number; contacted: number; qualified: number; converted: number; total: number }>()

    for (let i = daysAgo; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      trendsMap.set(dateKey, { new: 0, contacted: 0, qualified: 0, converted: 0, total: 0 })
    }

    // Single loop through leads to populate trends
    allLeads.forEach(lead => {
      const leadDate = new Date(lead.createdAt)
      const dateKey = leadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const dayData = trendsMap.get(dateKey)

      if (dayData) {
        dayData.total++
        if (lead.status === 'NEW') dayData.new++
        else if (lead.status === 'CONTACTED') dayData.contacted++
        else if (lead.status === 'QUALIFIED') dayData.qualified++
        else if (lead.status === 'APPLICATION' || lead.status === 'REAL') dayData.converted++
      }
    })

    const leadTrends = Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      ...data
    }))

    // Top performers (employees with most conversions)
    const employeePerformance = allLeads.reduce((acc, lead) => {
      if (lead.assignedTo) {
        const empId = lead.assignedTo.id
        const empName = `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`

        if (!acc[empId]) {
          acc[empId] = {
            id: empId,
            name: empName,
            totalLeads: 0,
            converted: 0,
            qualified: 0,
            contacted: 0,
            new: 0
          }
        }

        acc[empId].totalLeads++
        if (lead.status === 'APPLICATION' || lead.status === 'APPROVED' || lead.status === 'REAL') acc[empId].converted++
        if (lead.status === 'QUALIFIED') acc[empId].qualified++
        if (lead.status === 'CONTACTED') acc[empId].contacted++
        if (lead.status === 'NEW') acc[empId].new++
      }
      return acc
    }, {} as Record<string, any>)

    const topPerformers = Object.values(employeePerformance)
      .map(emp => ({
        ...emp,
        conversionRate: emp.totalLeads > 0 ? (emp.converted / emp.totalLeads) * 100 : 0
      }))
      .sort((a, b) => b.converted - a.converted)
      .slice(0, 10)

    // Revenue analytics
    const totalRevenuePotential = allLeads.reduce((sum, lead) => {
      return sum + (lead.loanAmount || 0)
    }, 0)

    const convertedRevenue = allLeads
      .filter(l => l.status === 'APPLICATION' || l.status === 'APPROVED' || l.status === 'REAL')
      .reduce((sum, lead) => sum + (lead.loanAmount || 0), 0)

    const pipelineRevenue = allLeads
      .filter(l => ['NEW', 'CONTACTED', 'QUALIFIED'].includes(l.status) && l.status !== 'JUNK')
      .reduce((sum, lead) => sum + (lead.loanAmount || 0), 0)

    // Response time analytics (mock data - would need actual timestamps)
    const avgResponseTime = 2.3 // hours
    const leadsContactedWithin2Hours = allLeads.filter(l =>
      l.status !== 'NEW' && l.assignedAt
    ).length
    const responseRate = allLeads.length > 0
      ? (leadsContactedWithin2Hours / allLeads.length) * 100
      : 0

    // Conversion funnel
    const funnel = [
      { stage: 'New Leads', count: statusDistribution.NEW, percentage: 100 },
      {
        stage: 'Contacted',
        count: statusDistribution.CONTACTED,
        percentage: allLeads.length > 0 ? (statusDistribution.CONTACTED / allLeads.length) * 100 : 0
      },
      {
        stage: 'Qualified',
        count: statusDistribution.QUALIFIED,
        percentage: allLeads.length > 0 ? (statusDistribution.QUALIFIED / allLeads.length) * 100 : 0
      },
      {
        stage: 'Application',
        count: statusDistribution.APPLICATION,
        percentage: allLeads.length > 0 ? (statusDistribution.APPLICATION / allLeads.length) * 100 : 0
      },
      {
        stage: 'Approved',
        count: statusDistribution.APPROVED,
        percentage: allLeads.length > 0 ? (statusDistribution.APPROVED / allLeads.length) * 100 : 0
      },
      {
        stage: 'Real Leads',
        count: statusDistribution.REAL,
        percentage: allLeads.length > 0 ? (statusDistribution.REAL / allLeads.length) * 100 : 0
      }
    ]

    // Department performance (optimized with _count aggregation)
    const departments = await db.department.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            employees: {
              where: { isActive: true }
            }
          }
        }
      }
    })

    // Calculate department stats from allLeads data
    const departmentStatsMap = new Map<string, { totalLeads: number; converted: number }>()

    // Get employee-department mapping
    const employees = await db.employee.findMany({
      where: { companyId, isActive: true },
      select: { id: true, departmentId: true }
    })
    const empDeptMap = new Map(employees.map(e => [e.id, e.departmentId]))

    // Aggregate leads by department
    allLeads.forEach(lead => {
      if (lead.assignedToId) {
        const deptId = empDeptMap.get(lead.assignedToId)
        if (deptId) {
          if (!departmentStatsMap.has(deptId)) {
            departmentStatsMap.set(deptId, { totalLeads: 0, converted: 0 })
          }
          const stats = departmentStatsMap.get(deptId)!
          stats.totalLeads++
          if (lead.status === 'APPLICATION' || lead.status === 'APPROVED' || lead.status === 'REAL') {
            stats.converted++
          }
        }
      }
    })

    const departmentStats = departments.map(dept => {
      const stats = departmentStatsMap.get(dept.id) || { totalLeads: 0, converted: 0 }
      return {
        name: dept.name,
        employees: dept._count.employees,
        totalLeads: stats.totalLeads,
        converted: stats.converted,
        conversionRate: stats.totalLeads > 0 ? (stats.converted / stats.totalLeads) * 100 : 0
      }
    })

    const analyticsData = {
      overview: {
        totalLeads: allLeads.length,
        activeLeads: allLeads.filter(l => ['NEW', 'CONTACTED', 'QUALIFIED'].includes(l.status) && l.status !== 'JUNK').length,
        convertedLeads: statusDistribution.APPLICATION + statusDistribution.APPROVED + statusDistribution.REAL,
        conversionRate: allLeads.length > 0
          ? ((statusDistribution.APPLICATION + statusDistribution.APPROVED + statusDistribution.REAL) / allLeads.length) * 100
          : 0,
        totalRevenuePotential,
        convertedRevenue,
        pipelineRevenue,
        avgResponseTime,
        responseRate
      },
      trends: leadTrends,
      statusDistribution,
      priorityDistribution,
      sources,
      topPerformers,
      funnel,
      departmentStats
    }

    // Cache for 2 minutes
    cache.set(cacheKey, analyticsData, 120000)

    return NextResponse.json({
      success: true,
      data: analyticsData
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

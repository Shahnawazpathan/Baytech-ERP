import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || 'default-company'
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('range') || '30' // days

    const daysAgo = parseInt(dateRange)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)
    startDate.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Get all leads within date range
    const leads = await db.lead.findMany({
      where: {
        companyId,
        isActive: true,
        createdAt: {
          gte: startDate,
          lte: today
        }
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    const allLeads = await db.lead.findMany({
      where: {
        companyId,
        isActive: true
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Lead trends by day
    const leadTrends = []
    for (let i = daysAgo; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const leadsOnDay = allLeads.filter(lead => {
        const leadDate = new Date(lead.createdAt)
        return leadDate >= date && leadDate < nextDate
      })

      leadTrends.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        new: leadsOnDay.filter(l => l.status === 'NEW').length,
        contacted: leadsOnDay.filter(l => l.status === 'CONTACTED').length,
        qualified: leadsOnDay.filter(l => l.status === 'QUALIFIED').length,
        converted: leadsOnDay.filter(l => l.status === 'APPLICATION' || l.status === 'REAL').length,
        total: leadsOnDay.length
      })
    }

    // Status distribution
    const statusDistribution = {
      NEW: allLeads.filter(l => l.status === 'NEW').length,
      CONTACTED: allLeads.filter(l => l.status === 'CONTACTED').length,
      QUALIFIED: allLeads.filter(l => l.status === 'QUALIFIED').length,
      APPLICATION: allLeads.filter(l => l.status === 'APPLICATION').length,
      APPROVED: allLeads.filter(l => l.status === 'APPROVED').length,
      REJECTED: allLeads.filter(l => l.status === 'REJECTED').length,
      CLOSED: allLeads.filter(l => l.status === 'CLOSED').length,
      JUNK: allLeads.filter(l => l.status === 'JUNK').length,
      REAL: allLeads.filter(l => l.status === 'REAL').length
    }

    // Priority distribution
    const priorityDistribution = {
      LOW: allLeads.filter(l => l.priority === 'LOW').length,
      MEDIUM: allLeads.filter(l => l.priority === 'MEDIUM').length,
      HIGH: allLeads.filter(l => l.priority === 'HIGH').length,
      URGENT: allLeads.filter(l => l.priority === 'URGENT').length
    }

    // Lead sources
    const sources = allLeads.reduce((acc, lead) => {
      const source = lead.source || 'Unknown'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

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

    // Department performance
    const departments = await db.department.findMany({
      where: { companyId },
      include: {
        employees: {
          where: { isActive: true },
          include: {
            leads: {
              where: { isActive: true }
            }
          }
        }
      }
    })

    const departmentStats = departments.map(dept => {
      const totalLeads = dept.employees.reduce((sum, emp) => sum + emp.leads.length, 0)
      const convertedLeads = dept.employees.reduce((sum, emp) =>
        sum + emp.leads.filter(l => l.status === 'APPLICATION' || l.status === 'APPROVED' || l.status === 'REAL').length, 0
      )

      return {
        name: dept.name,
        employees: dept.employees.length,
        totalLeads,
        converted: convertedLeads,
        conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0
      }
    })

    return NextResponse.json({
      success: true,
      data: {
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
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

const reportTypes = ['Sales', 'Employee Performance', 'Lead Conversion'] as const
type ReportType = (typeof reportTypes)[number]

function isReportType(value: unknown): value is ReportType {
  return typeof value === 'string' && reportTypes.includes(value as ReportType)
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const generatedDate = new Date().toISOString().split('T')[0]
    return NextResponse.json({
      success: true,
      data: reportTypes.map((type, index) => ({
        id: index + 1,
        name: `${type} Report`,
        type,
        generatedDate,
        status: 'AVAILABLE',
      })),
      total: reportTypes.length,
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
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

    const body = await request.json()
    const { type, format = 'json' } = body

    if (!isReportType(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid report type' },
        { status: 400 }
      )
    }

    const companyId = sessionUser.companyId
    const generated = new Date()
    const reportName = `${type} Report - ${generated.toLocaleDateString()}`

    const [leadStatusCounts, priorityCounts, employeeCounts, attendanceCounts, revenue] =
      await Promise.all([
        db.lead.groupBy({
          by: ['status'],
          where: { companyId, isActive: true },
          _count: true,
        }),
        db.lead.groupBy({
          by: ['priority'],
          where: { companyId, isActive: true },
          _count: true,
        }),
        db.employee.groupBy({
          by: ['status'],
          where: { companyId, isActive: true },
          _count: true,
        }),
        db.attendance.groupBy({
          by: ['status'],
          where: { companyId },
          _count: true,
        }),
        db.lead.aggregate({
          where: { companyId, isActive: true },
          _sum: { loanAmount: true },
          _avg: { loanAmount: true },
          _count: true,
        }),
      ])

    const totalLeads = revenue._count
    const convertedStatuses = new Set(['APPLICATION', 'APPROVED', 'REAL', 'CLOSED'])
    const convertedLeads = leadStatusCounts
      .filter((item) => convertedStatuses.has(item.status))
      .reduce((sum, item) => sum + item._count, 0)

    const content = {
      title: reportName,
      generated: generated.toISOString(),
      companyId,
      metrics: {
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(2)) : 0,
        totalLoanAmount: revenue._sum.loanAmount || 0,
        averageLoanAmount: Math.round(revenue._avg.loanAmount || 0),
      },
      leadStatusBreakdown: leadStatusCounts.map((item) => ({
        status: item.status,
        count: item._count,
        percentage: totalLeads > 0 ? Number(((item._count / totalLeads) * 100).toFixed(1)) : 0,
      })),
      priorityDistribution: priorityCounts.map((item) => ({
        priority: item.priority,
        count: item._count,
      })),
      employeeStatusBreakdown: employeeCounts.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      attendanceBreakdown: attendanceCounts.map((item) => ({
        status: item.status,
        count: item._count,
      })),
    }

    return NextResponse.json({
      success: true,
      data: {
        report: {
          id: generated.getTime(),
          name: reportName,
          type,
          generatedDate: generated.toISOString().split('T')[0],
          status: 'COMPLETED',
        },
        content: format === 'json' ? content : JSON.stringify(content, null, 2),
        format,
      },
      message: 'Report generated successfully',
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

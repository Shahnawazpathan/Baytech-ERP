import { NextRequest, NextResponse } from 'next/server'

// Mock reports data
let reports = [
  {
    id: 1,
    name: "Monthly Sales Report",
    type: "Sales",
    generatedDate: "2024-01-15",
    status: "COMPLETED"
  },
  {
    id: 2,
    name: "Employee Performance Report",
    type: "HR",
    generatedDate: "2024-01-10",
    status: "COMPLETED"
  }
]

// Mock data for report generation
const mockLeads = [
  { name: "John Smith", loanAmount: 450000, status: "APPLICATION", priority: "HIGH" },
  { name: "Sarah Johnson", loanAmount: 320000, status: "QUALIFIED", priority: "MEDIUM" }
]

const mockEmployees = [
  { name: "Alice Johnson", department: "Sales", status: "ACTIVE" },
  { name: "Bob Smith", department: "IT", status: "ACTIVE" }
]

const mockAttendance = [
  { name: "Alice Johnson", status: "PRESENT" },
  { name: "Bob Smith", status: "LATE" }
]

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: reports,
      total: reports.length
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, format = 'json' } = body

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Report type is required' },
        { status: 400 }
      )
    }

    let reportContent = ''
    let reportName = ''

    switch (type) {
      case 'Sales':
        reportName = `Sales Report - ${new Date().toLocaleDateString()}`
        const totalLeads = mockLeads.length
        const convertedLeads = mockLeads.filter(lead => lead.status === 'APPLICATION').length
        const conversionRate = ((convertedLeads / totalLeads) * 100).toFixed(2)
        const totalLoanAmount = mockLeads.reduce((sum, lead) => sum + lead.loanAmount, 0)
        
        reportContent = JSON.stringify({
          title: reportName,
          generated: new Date().toISOString(),
          metrics: {
            totalLeads,
            convertedLeads,
            conversionRate: `${conversionRate}%`,
            totalLoanAmount,
            averageLoanAmount: Math.round(totalLoanAmount / totalLeads)
          },
          breakdown: mockLeads.reduce((acc, lead) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }, null, 2)
        break

      case 'Employee Performance':
        reportName = `Employee Performance Report - ${new Date().toLocaleDateString()}`
        const activeEmployees = mockEmployees.filter(emp => emp.status === 'ACTIVE')
        
        reportContent = JSON.stringify({
          title: reportName,
          generated: new Date().toISOString(),
          metrics: {
            totalEmployees: mockEmployees.length,
            activeEmployees: activeEmployees.length,
            departmentBreakdown: mockEmployees.reduce((acc, emp) => {
              acc[emp.department] = (acc[emp.department] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          },
          attendance: {
            present: mockAttendance.filter(a => a.status === 'PRESENT').length,
            late: mockAttendance.filter(a => a.status === 'LATE').length,
            absent: mockAttendance.filter(a => a.status === 'ABSENT').length
          }
        }, null, 2)
        break

      case 'Lead Conversion':
        reportName = `Lead Conversion Analysis - ${new Date().toLocaleDateString()}`
        const statusBreakdown = mockLeads.reduce((acc, lead) => {
          acc[lead.status] = (acc[lead.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        reportContent = JSON.stringify({
          title: reportName,
          generated: new Date().toISOString(),
          metrics: {
            totalLeads: mockLeads.length,
            statusBreakdown: Object.entries(statusBreakdown).map(([status, count]) => ({
              status,
              count,
              percentage: `${((count / mockLeads.length) * 100).toFixed(1)}%`
            })),
            priorityDistribution: {
              high: mockLeads.filter(l => l.priority === 'HIGH').length,
              medium: mockLeads.filter(l => l.priority === 'MEDIUM').length,
              low: mockLeads.filter(l => l.priority === 'LOW').length
            }
          }
        }, null, 2)
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid report type' },
          { status: 400 }
        )
    }

    // Save report
    const newReport = {
      id: reports.length + 1,
      name: reportName,
      type: type,
      generatedDate: new Date().toISOString().split('T')[0],
      status: "COMPLETED"
    }
    reports.push(newReport)

    return NextResponse.json({
      success: true,
      data: {
        report: newReport,
        content: reportContent,
        format: format
      },
      message: 'Report generated successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
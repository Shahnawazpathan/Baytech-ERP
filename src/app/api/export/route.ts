import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, companyId, filters = {} } = body

    if (!type || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    let data
    let filename

    switch (type) {
      case 'employees':
        data = await exportEmployees(companyId, filters)
        filename = 'employees_export.xlsx'
        break
      case 'leads':
        data = await exportLeads(companyId, filters)
        filename = 'leads_export.xlsx'
        break
      case 'attendance':
        data = await exportAttendance(companyId, filters)
        filename = 'attendance_export.xlsx'
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export type' },
          { status: 400 }
        )
    }

    // In a real implementation, you would generate an actual Excel file
    // For demo purposes, we'll return the data as JSON
    return NextResponse.json({
      success: true,
      data: {
        filename,
        records: data.length,
        data
      }
    })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

// Employee export function
async function exportEmployees(companyId: string, filters: any) {
  try {
    const where: any = { companyId, isActive: true }
    
    if (filters.departmentId) {
      where.departmentId = filters.departmentId
    }
    
    if (filters.status) {
      where.status = filters.status
    }
    
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    const employees = await db.employee.findMany({
      where,
      include: {
        department: {
          select: { name: true }
        },
        role: {
          select: { name: true }
        },
        manager: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { lastName: 'asc' }
    })

    // Format data for export
    return employees.map(emp => ({
      'Employee ID': emp.employeeId,
      'First Name': emp.firstName,
      'Last Name': emp.lastName,
      'Email': emp.email,
      'Phone': emp.phone || '',
      'Position': emp.position,
      'Department': emp.department?.name || '',
      'Role': emp.role?.name || '',
      'Manager': emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '',
      'Salary': emp.salary || 0,
      'Status': emp.status,
      'Hire Date': emp.hireDate.toISOString().split('T')[0],
      'Termination Date': emp.terminationDate ? emp.terminationDate.toISOString().split('T')[0] : '',
      'Created Date': emp.createdAt.toISOString().split('T')[0]
    }))
  } catch (error) {
    console.error('Error exporting employees:', error)
    throw error
  }
}

// Lead export function
async function exportLeads(companyId: string, filters: any) {
  try {
    const where: any = { companyId, isActive: true }
    
    if (filters.status) {
      where.status = filters.status
    }
    
    if (filters.priority) {
      where.priority = filters.priority
    }
    
    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId
    }
    
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom)
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo)
      }
    }
    
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    const leads = await db.lead.findMany({
      where,
      include: {
        assignedTo: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Format data for export
    return leads.map(lead => ({
      'Lead Number': lead.leadNumber,
      'First Name': lead.firstName,
      'Last Name': lead.lastName,
      'Email': lead.email || '',
      'Phone': lead.phone,
      'Address': lead.address || '',
      'Loan Amount': lead.loanAmount || 0,
      'Property Type': lead.propertyType || '',
      'Property Value': lead.propertyValue || 0,
      'Credit Score': lead.creditScore || 0,
      'Income': lead.income || 0,
      'Source': lead.source,
      'Status': lead.status,
      'Priority': lead.priority,
      'Assigned To': lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : '',
      'Notes': lead.notes || '',
      'Created Date': lead.createdAt.toISOString().split('T')[0],
      'Updated Date': lead.updatedAt.toISOString().split('T')[0]
    }))
  } catch (error) {
    console.error('Error exporting leads:', error)
    throw error
  }
}

// Attendance export function
async function exportAttendance(companyId: string, filters: any) {
  try {
    const where: any = { companyId }
    
    if (filters.employeeId) {
      where.employeeId = filters.employeeId
    }
    
    if (filters.status) {
      where.status = filters.status
    }
    
    if (filters.dateFrom || filters.dateTo) {
      where.checkInTime = {}
      if (filters.dateFrom) {
        where.checkInTime.gte = new Date(filters.dateFrom)
      }
      if (filters.dateTo) {
        where.checkInTime.lte = new Date(filters.dateTo)
      }
    }

    const attendance = await db.attendance.findMany({
      where,
      include: {
        employee: {
          select: { 
            firstName: true, 
            lastName: true, 
            email: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { checkInTime: 'desc' }
    })

    // Format data for export
    return attendance.map(record => ({
      'Employee Name': `${record.employee.firstName} ${record.employee.lastName}`,
      'Employee Email': record.employee.email,
      'Department': record.employee.department?.name || '',
      'Check In Time': record.checkInTime.toISOString(),
      'Check Out Time': record.checkOutTime ? record.checkOutTime.toISOString() : '',
      'Check In Address': record.checkInAddress || '',
      'Check Out Address': record.checkOutAddress || '',
      'Break Start': record.breakStartTime ? record.breakStartTime.toISOString() : '',
      'Break End': record.breakEndTime ? record.breakEndTime.toISOString() : '',
      'Total Hours': record.totalHours || 0,
      'Status': record.status,
      'Verified': record.isVerified ? 'Yes' : 'No',
      'Notes': record.notes || '',
      'Created Date': record.createdAt.toISOString().split('T')[0]
    }))
  } catch (error) {
    console.error('Error exporting attendance:', error)
    throw error
  }
}
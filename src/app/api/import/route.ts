import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'employees', 'leads', 'attendance'
    const companyId = formData.get('companyId') as string

    if (!file || !type || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload an Excel file.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Process file based on type
    let result
    switch (type) {
      case 'employees':
        result = await importEmployees(buffer, companyId)
        break
      case 'leads':
        result = await importLeads(buffer, companyId)
        break
      case 'attendance':
        result = await importAttendance(buffer, companyId)
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid import type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import data' },
      { status: 500 }
    )
  }
}

// Employee import function
async function importEmployees(buffer: Buffer, companyId: string) {
  try {
    // In a real implementation, you would use a library like xlsx to parse Excel
    // For demo purposes, we'll simulate the parsing and validation
    
    const employees: any[] = []
    const errors: any[] = []
    const warnings: any[] = []

    // Simulate parsing Excel data
    const mockData = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-1234',
        position: 'Sales Manager',
        department: 'Sales',
        salary: 75000
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '555-5678',
        position: 'Developer',
        department: 'IT',
        salary: 85000
      }
    ]

    for (let i = 0; i < mockData.length; i++) {
      const row = mockData[i]
      const rowNum = i + 2 // Excel rows start at 1, header is row 1

      try {
        // Validate required fields
        if (!row.firstName || !row.lastName || !row.email || !row.position) {
          errors.push({
            row: rowNum,
            field: 'required',
            message: 'Missing required fields'
          })
          continue
        }

        // Check for duplicate email
        const existingEmployee = await db.employee.findUnique({
          where: { email: row.email }
        })

        if (existingEmployee) {
          errors.push({
            row: rowNum,
            field: 'email',
            message: 'Email already exists'
          })
          continue
        }

        // Get or create department
        let department = await db.department.findFirst({
          where: {
            name: row.department,
            companyId
          }
        })

        if (!department) {
          department = await db.department.create({
            data: {
              name: row.department,
              companyId,
              description: `Auto-created department for ${row.department}`
            }
          })
          warnings.push({
            row: rowNum,
            message: `Department "${row.department}" was auto-created`
          })
        }

        // Get default role
        let role = await db.role.findFirst({
          where: {
            name: 'Employee',
            companyId
          }
        })

        if (!role) {
          role = await db.role.create({
            data: {
              name: 'Employee',
              companyId,
              description: 'Default employee role'
            }
          })
        }

        // Generate unique employee ID
        const employeeId = `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        // Create employee
        const employee = await db.employee.create({
          data: {
            employeeId,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
            position: row.position,
            departmentId: department.id,
            roleId: role.id,
            salary: row.salary,
            companyId,
            status: 'ACTIVE',
            hireDate: new Date()
          }
        })

        employees.push(employee)

      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error)
        errors.push({
          row: rowNum,
          message: `Processing error: ${(error as Error).message}`
        })
      }
    }

    return {
      imported: employees.length,
      total: mockData.length,
      errors,
      warnings,
      employees
    }
  } catch (error) {
    console.error('Error importing employees:', error)
    throw error
  }
}

// Lead import function
async function importLeads(buffer: Buffer, companyId: string) {
  try {
    const leads: any[] = []
    const errors: any[] = []
    const warnings: any[] = []

    // Simulate parsing Excel data
    const mockData = [
      {
        firstName: 'Michael',
        lastName: 'Johnson',
        email: 'michael.j@email.com',
        phone: '555-1111',
        loanAmount: 350000,
        propertyType: 'Single Family',
        creditScore: 720,
        income: 85000,
        source: 'Website'
      },
      {
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'sarah.w@email.com',
        phone: '555-2222',
        loanAmount: 450000,
        propertyType: 'Condo',
        creditScore: 680,
        income: 95000,
        source: 'Referral'
      }
    ]

    for (let i = 0; i < mockData.length; i++) {
      const row = mockData[i]
      const rowNum = i + 2

      try {
        // Validate required fields
        if (!row.firstName || !row.lastName || !row.phone) {
          errors.push({
            row: rowNum,
            field: 'required',
            message: 'Missing required fields'
          })
          continue
        }

        // Get available employee for assignment
        const assignedEmployee = await getAvailableEmployee(companyId)

        // Generate unique lead number
        const leadNumber = `LD-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        // Create lead
        const lead = await db.lead.create({
          data: {
            leadNumber,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
            loanAmount: row.loanAmount,
            propertyType: row.propertyType,
            creditScore: row.creditScore,
            income: row.income,
            source: row.source,
            status: 'NEW',
            priority: calculatePriority(row.loanAmount, row.creditScore),
            assignedToId: assignedEmployee?.id,
            companyId
          }
        })

        // Create lead history
        await db.leadHistory.create({
          data: {
            leadId: lead.id,
            action: 'IMPORTED',
            newValue: JSON.stringify(lead),
            notes: 'Imported from Excel file'
          }
        })

        leads.push(lead)

      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error)
        errors.push({
          row: rowNum,
          message: `Processing error: ${(error as Error).message}`
        })
      }
    }

    return {
      imported: leads.length,
      total: mockData.length,
      errors,
      warnings,
      leads
    }
  } catch (error) {
    console.error('Error importing leads:', error)
    throw error
  }
}

// Attendance import function
async function importAttendance(buffer: Buffer, companyId: string) {
  try {
    const attendanceRecords: any[] = []
    const errors: any[] = []
    const warnings: any[] = []

    // Simulate parsing Excel data
    const mockData = [
      {
        employeeEmail: 'john.doe@example.com',
        date: '2024-01-15',
        checkInTime: '09:00',
        checkOutTime: '17:30',
        status: 'PRESENT'
      },
      {
        employeeEmail: 'jane.smith@example.com',
        date: '2024-01-15',
        checkInTime: '09:15',
        checkOutTime: '17:45',
        status: 'LATE'
      }
    ]

    for (let i = 0; i < mockData.length; i++) {
      const row = mockData[i]
      const rowNum = i + 2

      try {
        // Validate required fields
        if (!row.employeeEmail || !row.date) {
          errors.push({
            row: rowNum,
            field: 'required',
            message: 'Missing required fields'
          })
          continue
        }

        // Find employee by email
        const employee = await db.employee.findFirst({
          where: {
            email: row.employeeEmail,
            companyId
          }
        })

        if (!employee) {
          errors.push({
            row: rowNum,
            field: 'employeeEmail',
            message: 'Employee not found'
          })
          continue
        }

        // Parse dates and times
        const date = new Date(row.date)
        const checkInTime = new Date(`${row.date} ${row.checkInTime}`)
        const checkOutTime = row.checkOutTime ? new Date(`${row.date} ${row.checkOutTime}`) : null

        // Check for existing attendance record
        const existingRecord = await db.attendance.findFirst({
          where: {
            employeeId: employee.id,
            companyId,
            checkInTime: {
              gte: new Date(date.setHours(0, 0, 0, 0)),
              lt: new Date(date.setHours(23, 59, 59, 999))
            }
          }
        })

        if (existingRecord) {
          warnings.push({
            row: rowNum,
            message: 'Attendance record already exists for this date'
          })
          continue
        }

        // Calculate total hours
        let totalHours: number | null = null
        if (checkOutTime) {
          totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
        }

        // Create attendance record
        const attendance = await db.attendance.create({
          data: {
            employeeId: employee.id,
            companyId,
            checkInTime,
            checkOutTime,
            status: row.status,
            totalHours,
            isVerified: true // Assume imported data is verified
          }
        })

        attendanceRecords.push(attendance)

      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error)
        errors.push({
          row: rowNum,
          message: `Processing error: ${(error as Error).message}`
        })
      }
    }

    return {
      imported: attendanceRecords.length,
      total: mockData.length,
      errors,
      warnings,
      attendanceRecords
    }
  } catch (error) {
    console.error('Error importing attendance:', error)
    throw error
  }
}

// Helper functions
async function getAvailableEmployee(companyId: string) {
  try {
    const employees = await db.employee.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        isActive: true
      },
      include: {
        _count: {
          select: {
            leads: {
              where: {
                status: {
                  in: ['NEW', 'CONTACTED', 'QUALIFIED', 'APPLICATION']
                }
              }
            }
          }
        }
      },
      orderBy: {
        leads: {
          _count: 'asc'
        }
      },
      take: 1
    })

    return employees[0] || null
  } catch (error) {
    console.error('Error getting available employee:', error)
    return null
  }
}

function calculatePriority(loanAmount?: number, creditScore?: number): string {
  if (!loanAmount && !creditScore) return 'MEDIUM'
  
  let score = 0
  
  if (loanAmount) {
    if (loanAmount > 500000) score += 3
    else if (loanAmount > 300000) score += 2
    else if (loanAmount > 100000) score += 1
  }
  
  if (creditScore) {
    if (creditScore > 750) score += 3
    else if (creditScore > 700) score += 2
    else if (creditScore > 650) score += 1
  }
  
  if (score >= 5) return 'HIGH'
  if (score >= 3) return 'MEDIUM'
  return 'LOW'
}
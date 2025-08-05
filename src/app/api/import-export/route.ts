import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file || !type) {
      return NextResponse.json(
        { success: false, error: 'File and type are required' },
        { status: 400 }
      )
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV files are supported' },
        { status: 400 }
      )
    }

    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'CSV file must have at least a header and one data row' },
        { status: 400 }
      )
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const dataLines = lines.slice(1)

    let importedData: any[] = []
    let errors: string[] = []

    switch (type) {
      case 'employees':
        importedData = dataLines.map((line, index) => {
          const values = line.split(',').map(v => v.trim())
          if (values.length < 4) {
            errors.push(`Row ${index + 2}: Insufficient data`)
            return null
          }
          
          return {
            id: index + 1,
            name: values[0] || '',
            email: values[1] || '',
            phone: values[2] || '',
            position: values[3] || '',
            department: values[4] || 'General',
            status: 'ACTIVE',
            hireDate: new Date().toISOString().split('T')[0],
            address: values[5] || ''
          }
        }).filter(Boolean)
        break

      case 'leads':
        importedData = dataLines.map((line, index) => {
          const values = line.split(',').map(v => v.trim())
          if (values.length < 3) {
            errors.push(`Row ${index + 2}: Insufficient data`)
            return null
          }
          
          return {
            id: index + 1,
            name: values[0] || '',
            email: values[1] || '',
            phone: values[2] || '',
            loanAmount: parseInt(values[3]) || 0,
            status: values[4] || 'NEW',
            priority: values[5] || 'MEDIUM',
            assignedTo: values[6] || 'Unassigned',
            propertyAddress: values[7] || '',
            creditScore: parseInt(values[8]) || 0
          }
        }).filter(Boolean)
        break

      case 'attendance':
        importedData = dataLines.map((line, index) => {
          const values = line.split(',').map(v => v.trim())
          if (values.length < 2) {
            errors.push(`Row ${index + 2}: Insufficient data`)
            return null
          }
          
          return {
            id: index + 1,
            name: values[0] || '',
            department: values[1] || 'General',
            checkIn: values[2] || '-',
            checkOut: values[3] || '-',
            status: values[4] || 'PRESENT',
            location: values[5] || 'Office'
          }
        }).filter(Boolean)
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid import type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: {
        imported: importedData.length,
        total: dataLines.length,
        errors: errors,
        sample: importedData.slice(0, 3) // Show first 3 records as sample
      },
      message: `Imported ${importedData.length} ${type} successfully`
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process import' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const format = searchParams.get('format') || 'csv'

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Export type is required' },
        { status: 400 }
      )
    }

    let csvContent = ''
    let filename = ''

    switch (type) {
      case 'employees':
        csvContent = [
          ['Name', 'Email', 'Phone', 'Position', 'Department', 'Status', 'Hire Date'],
          // Sample data - in real app, this would come from database
          ['John Doe', 'john@example.com', '555-0101', 'Manager', 'Sales', 'ACTIVE', '2023-01-15'],
          ['Jane Smith', 'jane@example.com', '555-0102', 'Developer', 'IT', 'ACTIVE', '2023-03-20']
        ].map(row => row.join(',')).join('\n')
        filename = `employees_${new Date().toISOString().split('T')[0]}.csv`
        break

      case 'leads':
        csvContent = [
          ['Name', 'Email', 'Phone', 'Loan Amount', 'Status', 'Priority', 'Assigned To'],
          // Sample data
          ['Mike Johnson', 'mike@example.com', '555-0201', '450000', 'NEW', 'HIGH', 'Alice Johnson'],
          ['Sarah Wilson', 'sarah@example.com', '555-0202', '320000', 'QUALIFIED', 'MEDIUM', 'Bob Smith']
        ].map(row => row.join(',')).join('\n')
        filename = `leads_${new Date().toISOString().split('T')[0]}.csv`
        break

      case 'attendance':
        csvContent = [
          ['Name', 'Department', 'Check In', 'Check Out', 'Status', 'Location'],
          // Sample data
          ['Alice Johnson', 'Sales', '09:00 AM', '05:30 PM', 'PRESENT', 'Office'],
          ['Bob Smith', 'IT', '08:45 AM', '-', 'PRESENT', 'Remote']
        ].map(row => row.join(',')).join('\n')
        filename = `attendance_${new Date().toISOString().split('T')[0]}.csv`
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export type' },
          { status: 400 }
        )
    }

    if (format === 'csv') {
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    } else {
      return NextResponse.json({
        success: true,
        data: {
          content: csvContent,
          filename,
          type,
          format
        },
        message: 'Export data prepared successfully'
      })
    }

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate export' },
      { status: 500 }
    )
  }
}
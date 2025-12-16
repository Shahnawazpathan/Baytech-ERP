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
    if (!file.name.match(/\.(csv)$/)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload a CSV file.' },
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

// Employee import function (optimized with batch operations)
async function importEmployees(buffer: Buffer, companyId: string) {
  try {
    const employees: any[] = []
    const errors: any[] = []
    const warnings: any[] = []

    // Parse CSV file (simplified approach)
    const text = buffer.toString('utf-8');
    const rows = text.split('\n').filter(row => row.trim() !== '');

    if (rows.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    // Parse CSV rows (simple implementation - would use papaparse in production)
    const data = rows.map(row => {
      // Split by comma and handle quoted fields
      const result: string[] = [];
      let field = '';
      let inQuotes = false;
      let i = 0;

      while (i < row.length) {
        const char = row[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(field.trim());
          field = '';
        } else {
          field += char;
        }

        i++;
      }

      if (field !== undefined) {
        result.push(field.trim());
      }

      return result;
    });

    if (data.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    const headers = data[0];
    const rowsData = data.slice(1);

    // Map headers to expected field names
    const headerMap: Record<string, string> = {};
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim();

      // Map various name formats
      if (['first_name', 'firstname', 'first name', 'name'].includes(normalizedHeader)) {
        headerMap[header] = 'firstName';
      } else if (['last_name', 'lastname', 'last name'].includes(normalizedHeader)) {
        headerMap[header] = 'lastName';
      }
      // Map various email formats
      else if (['email', 'email_address', 'e-mail', 'mail'].includes(normalizedHeader)) {
        headerMap[header] = 'email';
      }
      // Map various phone formats
      else if (['phone', 'phone_number', 'telephone', 'mobile', 'contact'].includes(normalizedHeader)) {
        headerMap[header] = 'phone';
      }
      // Map various position formats
      else if (['position', 'job_title', 'title', 'role'].includes(normalizedHeader)) {
        headerMap[header] = 'position';
      }
      // Map various department formats
      else if (['department', 'dept'].includes(normalizedHeader)) {
        headerMap[header] = 'department';
      }
      // Map various salary formats
      else if (['salary', 'wage', 'pay', 'compensation'].includes(normalizedHeader)) {
        headerMap[header] = 'salary';
      }
    }

    // Check if required fields are present
    const hasFirstName = Object.values(headerMap).includes('firstName');
    const hasLastName = Object.values(headerMap).includes('lastName');
    const hasEmail = Object.values(headerMap).includes('email');
    const hasPosition = Object.values(headerMap).includes('position');

    if (!hasFirstName || !hasLastName || !hasEmail || !hasPosition) {
      throw new Error('CSV file must contain "First Name", "Last Name", "Email", and "Position" columns');
    }

    // Pre-fetch all existing data to avoid N+1 queries
    const [existingEmployees, existingDepartments, existingRoles] = await Promise.all([
      db.employee.findMany({
        where: { companyId },
        select: { email: true, id: true }
      }),
      db.department.findMany({
        where: { companyId },
        select: { id: true, name: true }
      }),
      db.role.findMany({
        where: { companyId },
        select: { id: true, name: true }
      })
    ]);

    // Create lookup maps for O(1) access
    const existingEmails = new Set(existingEmployees.map(e => e.email))
    const departmentMap = new Map(existingDepartments.map(d => [d.name, d.id]))
    const roleMap = new Map(existingRoles.map(r => [r.name, r.id]))

    // Collect new departments
    const newDepartments = new Set<string>()
    const validRows: Array<{ row: any; rowNum: number }> = []

    for (let i = 0; i < rowsData.length; i++) {
      const row = rowsData[i];
      const rowNum = i + 2; // CSV rows start at 1, header is row 1

      try {
        // Create a row object based on header mapping
        const rowData: any = {};
        for (let j = 0; j < headers.length; j++) {
          if (j < row.length) {
            const mappedKey = headerMap[headers[j]];
            if (mappedKey) {
              rowData[mappedKey] = row[j];
            }
          }
        }

        // Validate required fields
        if (!rowData.firstName || !rowData.lastName || !rowData.email || !rowData.position) {
          errors.push({
            row: rowNum,
            field: 'required',
            message: 'Missing required fields (First Name, Last Name, Email, and Position are required)'
          });
          continue;
        }

        // Check for duplicate email
        if (existingEmails.has(rowData.email)) {
          errors.push({
            row: rowNum,
            field: 'email',
            message: 'Email already exists'
          });
          continue;
        }

        // Track new departments
        if (rowData.department && !departmentMap.has(rowData.department)) {
          newDepartments.add(rowData.department)
        }

        validRows.push({ row: rowData, rowNum })
      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        errors.push({
          row: rowNum,
          message: `Processing error: ${(error as Error).message}`
        });
      }
    }

    // Create missing departments in batch
    if (newDepartments.size > 0) {
      const newDeptData = Array.from(newDepartments).map(name => ({
        name,
        companyId,
        description: `Auto-created department for ${name}`
      }))

      const createdDepts = await db.department.createManyAndReturn({
        data: newDeptData
      })

      createdDepts.forEach(dept => {
        departmentMap.set(dept.name, dept.id)
        warnings.push({
          message: `Department "${dept.name}" was auto-created`
        })
      })
    }

    // Ensure default role exists
    let defaultRoleId = roleMap.get('Employee')
    if (!defaultRoleId) {
      const newRole = await db.role.create({
        data: {
          name: 'Employee',
          companyId,
          description: 'Default employee role'
        }
      })
      defaultRoleId = newRole.id
    }

    // Ensure default department exists
    let defaultDepartmentId = departmentMap.get('General')
    if (!defaultDepartmentId) {
      const newDept = await db.department.create({
        data: {
          name: 'General',
          companyId,
          description: 'Default department for employees'
        }
      })
      defaultDepartmentId = newDept.id
      departmentMap.set('General', defaultDepartmentId)
    }

    // Prepare employee records for batch creation
    const employeeData = validRows.map(({ row }) => ({
      employeeId: `EMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone || '',
      position: row.position,
      departmentId: departmentMap.get(row.department) || defaultDepartmentId,
      roleId: defaultRoleId,
      salary: row.salary ? parseFloat(row.salary) : 0,
      companyId,
      status: 'ACTIVE',
      hireDate: new Date()
    }))

    // Create all employees in batch
    if (employeeData.length > 0) {
      const createdEmployees = await db.employee.createManyAndReturn({
        data: employeeData
      })
      employees.push(...createdEmployees)
    }

    return {
      imported: employees.length,
      total: rowsData.length,
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

    // Determine file type and parse accordingly
    let data: any[][] = [];
    if (Buffer.isBuffer(buffer)) {
      // Parse CSV file (simplified approach - would use a library like papaparse in production)
      const text = buffer.toString('utf-8');
      const rows = text.split('\n').filter(row => row.trim() !== '');

      // Check if file has at least a header and one data row
      if (rows.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      // Parse CSV rows (simple implementation - would use papaparse in production)
      data = rows.map(row => {
        // Split by comma and handle quoted fields
        const result: string[] = [];
        let field = '';
        let inQuotes = false;
        let i = 0;

        while (i < row.length) {
          const char = row[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(field.trim());
            field = '';
          } else {
            field += char;
          }

          i++;
        }

        if (field !== undefined) {
          result.push(field.trim());
        }

        return result;
      });
    } else {
      throw new Error('Invalid file format');
    }

    if (data.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    const headers = data[0];
    const rows = data.slice(1);

    // Map headers to expected field names
    const headerMap: Record<string, string> = {};
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim();

      // Map various name formats to 'firstName'
      if (['name', 'first_name', 'firstname', 'first name', 'fname', 'customer_name', 'client_name'].includes(normalizedHeader)) {
        headerMap[header] = 'firstName';
      }
      // Map various mobile formats to 'phone'
      else if (['phone', 'mobile', 'phone_number', 'mobile_number', 'phone no', 'mobile_no', 'contact', 'contact_number', 'telephone', 'cell'].includes(normalizedHeader)) {
        headerMap[header] = 'phone';
      }
      // Map various property location formats to 'propertyAddress'
      else if (['property_location', 'property location', 'property_address', 'property address', 'location', 'address', 'property', 'property_info', 'property details'].includes(normalizedHeader)) {
        headerMap[header] = 'propertyAddress';
      }
      // Any other headers will be ignored
    }

    // Check if required fields are present
    const hasName = Object.values(headerMap).includes('firstName');
    const hasPhone = Object.values(headerMap).includes('phone');

    if (!hasName) {
      throw new Error('CSV file must contain a "Name" column (or variations like "first_name", "customer_name", etc.)');
    }

    if (!hasPhone) {
      throw new Error('CSV file must contain a "Mobile Number" column (or variations like "phone", "mobile", etc.)');
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel rows start at 1, header is row 1

      try {
        // Create a row object based on header mapping
        const rowData: any = {};
        for (let j = 0; j < headers.length; j++) {
          if (j < row.length) {
            const mappedKey = headerMap[headers[j]];
            if (mappedKey) {
              rowData[mappedKey] = row[j];
            }
          }
        }

        // Validate required fields
        if (!rowData.firstName || !rowData.phone) {
          errors.push({
            row: rowNum,
            field: 'required',
            message: 'Missing required fields (Name and Mobile Number are required)'
          });
          continue;
        }

        // Get available employee for assignment
        const assignedEmployee = await getAvailableEmployee(companyId);

        // Generate unique lead number
        const leadNumber = `LD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Create lead
        const lead = await db.lead.create({
          data: {
            leadNumber,
            firstName: rowData.firstName?.trim() || 'Unknown',
            lastName: null, // We're not capturing last name in this version
            email: null, // We're not capturing email in this version
            phone: rowData.phone?.trim() || 'N/A',
            loanAmount: null, // We're not capturing loan amount in this version
            propertyType: null, // We're not capturing property type in this version
            creditScore: null, // We're not capturing credit score in this version
            income: null, // We're not capturing income in this version
            source: 'Import', // Default to import source
            status: 'NEW',
            priority: 'MEDIUM', // Default priority
            assignedToId: assignedEmployee?.id || null,
            address: rowData.propertyAddress?.trim() || null, // Use property address if available
            companyId
          }
        });

        // Create lead history
        await db.leadHistory.create({
          data: {
            leadId: lead.id,
            action: 'IMPORTED',
            newValue: JSON.stringify(lead),
            notes: 'Imported from CSV file'
          }
        });

        leads.push(lead);

      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        errors.push({
          row: rowNum,
          message: `Processing error: ${(error as Error).message}`
        });
      }
    }

    return {
      imported: leads.length,
      total: rows.length,
      errors,
      warnings,
      leads
    };
  } catch (error) {
    console.error('Error importing leads:', error);
    throw error;
  }
}

// Attendance import function
async function importAttendance(buffer: Buffer, companyId: string) {
  try {
    const attendanceRecords: any[] = []
    const errors: any[] = []
    const warnings: any[] = []

    // Parse CSV file (simplified approach)
    const text = buffer.toString('utf-8');
    const rows = text.split('\n').filter(row => row.trim() !== '');

    if (rows.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    // Parse CSV rows (simple implementation - would use papaparse in production)
    const data = rows.map(row => {
      // Split by comma and handle quoted fields
      const result: string[] = [];
      let field = '';
      let inQuotes = false;
      let i = 0;

      while (i < row.length) {
        const char = row[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(field.trim());
          field = '';
        } else {
          field += char;
        }

        i++;
      }

      if (field !== undefined) {
        result.push(field.trim());
      }

      return result;
    });

    if (data.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    const headers = data[0];
    const rowsData = data.slice(1);

    // Map headers to expected field names
    const headerMap: Record<string, string> = {};
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim();

      // Map various email formats
      if (['employee_email', 'employee email', 'email', 'employee'].includes(normalizedHeader)) {
        headerMap[header] = 'employeeEmail';
      }
      // Map various date formats
      else if (['date', 'attendance_date', 'attendance date'].includes(normalizedHeader)) {
        headerMap[header] = 'date';
      }
      // Map various check-in formats
      else if (['check_in', 'check in', 'check_in_time', 'check in time', 'in_time', 'intime'].includes(normalizedHeader)) {
        headerMap[header] = 'checkInTime';
      }
      // Map various check-out formats
      else if (['check_out', 'check out', 'check_out_time', 'check out time', 'out_time', 'outtime'].includes(normalizedHeader)) {
        headerMap[header] = 'checkOutTime';
      }
      // Map various status formats
      else if (['status', 'attendance_status', 'attendance status'].includes(normalizedHeader)) {
        headerMap[header] = 'status';
      }
    }

    // Check if required fields are present
    const hasEmployeeEmail = Object.values(headerMap).includes('employeeEmail');
    const hasDate = Object.values(headerMap).includes('date');

    if (!hasEmployeeEmail || !hasDate) {
      throw new Error('CSV file must contain "employee_email" and "date" columns');
    }

    for (let i = 0; i < rowsData.length; i++) {
      const row = rowsData[i];
      const rowNum = i + 2; // CSV rows start at 1, header is row 1

      try {
        // Create a row object based on header mapping
        const rowData: any = {};
        for (let j = 0; j < headers.length; j++) {
          if (j < row.length) {
            const mappedKey = headerMap[headers[j]];
            if (mappedKey) {
              rowData[mappedKey] = row[j];
            }
          }
        }

        // Validate required fields
        if (!rowData.employeeEmail || !rowData.date) {
          errors.push({
            row: rowNum,
            field: 'required',
            message: 'Missing required fields (Employee Email and Date are required)'
          });
          continue;
        }

        // Find employee by email
        const employee = await db.employee.findFirst({
          where: {
            email: rowData.employeeEmail,
            companyId
          }
        });

        if (!employee) {
          errors.push({
            row: rowNum,
            field: 'employeeEmail',
            message: 'Employee not found'
          });
          continue;
        }

        // Parse dates and times
        const date = new Date(rowData.date);
        const checkInTime = rowData.checkInTime ? new Date(`${rowData.date} ${rowData.checkInTime}`) : new Date(`${rowData.date} 00:00`);
        const checkOutTime = rowData.checkOutTime ? new Date(`${rowData.date} ${rowData.checkOutTime}`) : null;

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
        });

        if (existingRecord) {
          warnings.push({
            row: rowNum,
            message: 'Attendance record already exists for this date'
          });
          continue;
        }

        // Calculate total hours
        let totalHours: number | null = null;
        if (checkOutTime) {
          totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        }

        // Create attendance record
        const attendance = await db.attendance.create({
          data: {
            employeeId: employee.id,
            companyId,
            checkInTime,
            checkOutTime,
            status: rowData.status || 'PRESENT', // Default to PRESENT if not provided
            totalHours,
            isVerified: true // Assume imported data is verified
          }
        });

        attendanceRecords.push(attendance);

      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        errors.push({
          row: rowNum,
          message: `Processing error: ${(error as Error).message}`
        });
      }
    }

    return {
      imported: attendanceRecords.length,
      total: rowsData.length,
      errors,
      warnings,
      attendanceRecords
    };
  } catch (error) {
    console.error('Error importing attendance:', error);
    throw error;
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
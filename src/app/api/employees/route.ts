import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/rbac'
import { cache, createCacheKey, invalidateCache } from '@/lib/cache'
import bcrypt from 'bcrypt'
import { getSessionUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = sessionUser.id
    const companyId = sessionUser.companyId

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = (page - 1) * limit

    // Check cache first (include userId for role-based filtering)
    const cacheKey = createCacheKey('employees', { companyId, userId: userId || 'anon', page, limit })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Check permission to READ employees
    const canRead = await hasPermission(userId, 'employee', 'READ')
    if (!canRead) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view employees' },
        { status: 403 }
      )
    }

    let whereClause: any = {
      companyId,
      status: {
        not: 'TERMINATED'
      }
    };

    // If it's not an admin, only show employees from same department or subordinates
    const requestingUser = await db.employee.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    // If user is not an admin, only return their own record or subordinates
    if (!requestingUser?.role?.name.toLowerCase().includes('admin')) {
      whereClause = {
        ...whereClause,
        OR: [
          { id: userId }, // Own record
          { managerId: userId } // Direct reports
        ]
      }
    }

    // Optimize: Run count and fetch in parallel
    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where: whereClause,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          position: true,
          departmentId: true,
          roleId: true,
          hireDate: true,
          address: true,
          status: true,
          isActive: true,
          autoAssignEnabled: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              name: true
            }
          },
          role: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      db.employee.count({ where: whereClause })
    ])

    // Transform the data to match the expected format
    const transformedEmployees = employees.map(emp => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      phone: emp.phone,
      position: emp.position,
      department: emp.department?.name || 'Unknown',
      departmentId: emp.departmentId,
      status: emp.status,
      hireDate: emp.hireDate,
      address: emp.address || '',
      firstName: emp.firstName,
      lastName: emp.lastName,
      isActive: emp.isActive,
      autoAssignEnabled: emp.autoAssignEnabled,
      roleId: emp.roleId
    }))

    const response = {
      data: transformedEmployees,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    }

    // Cache for 60 seconds
    cache.set(cacheKey, response, 60000)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    const userId = sessionUser?.id
    if (!sessionUser || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = sessionUser.companyId
    const body = await request.json()

    // Check permission to CREATE employees
    if (!(await hasPermission(userId, 'employee', 'CREATE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create employees' },
        { status: 403 }
      )
    }

    // Validate required fields
    if (
      !body.firstName || typeof body.firstName !== 'string' ||
      !body.email || typeof body.email !== 'string' ||
      !body.roleId || !body.departmentId
    ) {
      return NextResponse.json(
        { error: 'First name, email, role and department are required' },
        { status: 400 }
      )
    }

    // Prevent privilege escalation: role and department must belong to the same company
    const [role, department] = await Promise.all([
      db.role.findFirst({ where: { id: body.roleId, companyId } }),
      db.department.findFirst({ where: { id: body.departmentId, companyId } }),
    ])
    if (!role || !department) {
      return NextResponse.json(
        { error: 'Invalid role or department for this company' },
        { status: 400 }
      )
    }

    // Check if employee with this email already exists
    const existingEmployee = await db.employee.findUnique({
      where: { email: body.email }
    });

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'An employee with this email already exists. Please use a different email address.' },
        { status: 409 }
      )
    }

    // Hash the password if provided
    let hashedPassword: any = null;
    if (body.password) {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        )
      }
      hashedPassword = await bcrypt.hash(body.password, 10);
    }

    // Create a new employee
    const employee = await db.employee.create({
      data: {
        employeeId: `EMP${Date.now()}`, // Generate employee ID
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        password: hashedPassword,
        position: body.position,
        departmentId: body.departmentId,
        roleId: body.roleId,
        companyId: sessionUser!.companyId,
        hireDate: new Date(body.hireDate),
        address: body.address,
        status: 'ACTIVE',
        isActive: true,
        autoAssignEnabled: body.autoAssignEnabled ?? true
      },
      include: {
        department: true,
        role: true
      }
    })

    // Transform the created employee to match expected format
    const transformedEmployee = {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department?.name || 'Unknown',
      departmentId: employee.departmentId,
      status: employee.status,
      hireDate: employee.hireDate,
      address: employee.address || '',
      firstName: employee.firstName,
      lastName: employee.lastName,
      isActive: employee.isActive,
      autoAssignEnabled: employee.autoAssignEnabled,
      roleId: employee.roleId
    }

    return NextResponse.json(transformedEmployee)
  } catch (error: any) {
    console.error('Error creating employee:', error)

    // Handle specific database errors
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      return NextResponse.json(
        { error: `An employee with this ${field} already exists. Please use a different ${field}.` },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create employee' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = sessionUser.id
    const companyId = sessionUser.companyId

    const url = new URL(request.url);
    const id = url.pathname.split('/').pop(); // Get the ID from the URL path

    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Check permission to UPDATE employees
    if (!(await hasPermission(userId, 'employee', 'UPDATE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update employees' },
        { status: 403 }
      );
    }

    // Prevent privilege escalation: role and department must belong to the same company
    if (body.roleId || body.departmentId) {
      const [role, department] = await Promise.all([
        body.roleId ? db.role.findFirst({ where: { id: body.roleId, companyId } }) : null,
        body.departmentId ? db.department.findFirst({ where: { id: body.departmentId, companyId } }) : null,
      ])
      if (body.roleId && !role) {
        return NextResponse.json({ error: 'Invalid role for this company' }, { status: 400 })
      }
      if (body.departmentId && !department) {
        return NextResponse.json({ error: 'Invalid department for this company' }, { status: 400 })
      }
    }

    // Hash the password if provided
    let hashedPassword: any = undefined;
    if (body.password) {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        )
      }
      hashedPassword = await bcrypt.hash(body.password, 10);
    }

    // Update the employee (scoped to the caller's company)
    const existing = await db.employee.findFirst({
      where: { id, companyId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const employee = await db.employee.update({
      where: {
        id,
      },
      data: {
        ...(typeof body.firstName === 'string' && { firstName: body.firstName }),
        ...(typeof body.lastName === 'string' && { lastName: body.lastName }),
        ...(typeof body.email === 'string' && { email: body.email }),
        ...(typeof body.phone === 'string' && { phone: body.phone }),
        ...(hashedPassword !== undefined && { password: hashedPassword }), // Only update password if provided
        ...(typeof body.position === 'string' && { position: body.position }),
        ...(body.roleId && { roleId: body.roleId }),
        ...(body.departmentId && { departmentId: body.departmentId }),
        ...(typeof body.status === 'string' && { status: body.status }),
        ...(body.hireDate && !isNaN(Date.parse(body.hireDate)) && { hireDate: new Date(body.hireDate) }),
        ...(typeof body.address === 'string' && { address: body.address }),
        ...(body.autoAssignEnabled !== undefined && { autoAssignEnabled: Boolean(body.autoAssignEnabled) }),
      },
      include: {
        department: true,
        role: true
      }
    });

    // Transform the updated employee to match expected format
    const transformedEmployee = {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department?.name || 'Unknown',
      departmentId: employee.departmentId,
      status: employee.status,
      hireDate: employee.hireDate,
      address: employee.address || '',
      firstName: employee.firstName,
      lastName: employee.lastName,
      isActive: employee.isActive,
      autoAssignEnabled: employee.autoAssignEnabled,
      roleId: employee.roleId
    };

    return NextResponse.json(transformedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);

    // Check if it's a Prisma error for record not found
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = sessionUser.id
    const companyId = sessionUser.companyId

    const url = new URL(request.url);
    const id = url.pathname.split('/').pop(); // Get the ID from the URL path

    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Check if the requesting user has permission to DELETE employees
    if (!(await hasPermission(userId, 'employee', 'DELETE'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete employees' },
        { status: 403 }
      );
    }

    // Check if employee exists (scoped to caller's company)
    const existingEmployee = await db.employee.findFirst({
      where: { id, companyId },
      include: { role: true }
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Prevent non-admin users from deleting admin employees
    if (existingEmployee.role?.name === 'Administrator') {
      const requestingUser = await db.employee.findUnique({
        where: { id: userId },
        include: { role: true }
      });

      if (!requestingUser || requestingUser.role?.name !== 'Administrator') {
        return NextResponse.json(
          { error: 'Only administrators can delete other administrators' },
          { status: 403 }
        );
      }
    }

    // Perform a soft delete by setting isActive to false
    // This preserves the data while removing the employee from active lists
    const employee = await db.employee.update({
      where: { id },
      data: {
        isActive: false,
        status: 'TERMINATED'  // Update status to terminated
      }
    });

    invalidateCache('employees', existingEmployee.companyId)

    return NextResponse.json({
      id: employee.id,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting employee:', error);

    // Check if it's a Prisma error for record not found
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}

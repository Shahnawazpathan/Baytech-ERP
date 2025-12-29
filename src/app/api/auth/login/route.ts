import { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find the employee by email
    const employee = await db.employee.findUnique({
      where: { email },
      include: {
        company: true,
        department: true,
        role: true,
      },
    });

    if (!employee || !employee.password) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, employee.password);

    if (!isPasswordValid) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!employee.isActive || employee.status !== 'ACTIVE') {
      return Response.json(
        { error: 'Your account is inactive. Please contact an administrator.' },
        { status: 403 }
      );
    }

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = employee;

    return Response.json({
      user: {
        id: userWithoutPassword.id,
        employeeId: userWithoutPassword.employeeId,
        firstName: userWithoutPassword.firstName,
        lastName: userWithoutPassword.lastName,
        email: userWithoutPassword.email,
        position: userWithoutPassword.position,
        department: userWithoutPassword.department?.name || '',
        roleId: userWithoutPassword.roleId,
        role: userWithoutPassword.role?.name || '',
        name: `${userWithoutPassword.firstName} ${userWithoutPassword.lastName}`,
        companyId: userWithoutPassword.companyId,
      },
      success: true,
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

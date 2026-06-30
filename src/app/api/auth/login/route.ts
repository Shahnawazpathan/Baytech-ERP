import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

    if (!normalizedEmail || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!checkRateLimit(`${clientIp}:${normalizedEmail}`)) {
      return Response.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Find the employee by email
    const employee = await db.employee.findUnique({
      where: { email: normalizedEmail },
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

    const response = NextResponse.json({
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
    setSessionCookie(response, createSessionToken({
      userId: employee.id,
      companyId: employee.companyId,
      roleId: employee.roleId,
    }));

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

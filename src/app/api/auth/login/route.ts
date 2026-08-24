import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

// Pre-computed hash of a random value - used to equalize response time for
// unknown emails so attackers cannot enumerate users via timing analysis.
const DUMMY_HASH = bcrypt.hashSync('timing-equalization-dummy-password', 10);

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10000;

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  // Periodically purge expired entries to prevent unbounded memory growth
  if (loginAttempts.size > MAX_TRACKED_KEYS) {
    for (const [k, v] of loginAttempts) {
      if (v.resetAt <= now) loginAttempts.delete(k);
    }
    if (loginAttempts.size > MAX_TRACKED_KEYS) loginAttempts.clear();
  }

  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

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

    // Always run a bcrypt comparison so response timing does not reveal
    // whether the email exists.
    const isPasswordValid = await bcrypt.compare(
      password,
      employee?.password || DUMMY_HASH
    );

    if (!employee || !employee.password || !isPasswordValid) {
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

    clearRateLimit(`${clientIp}:${normalizedEmail}`);

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

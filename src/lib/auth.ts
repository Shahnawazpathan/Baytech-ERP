import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const SESSION_COOKIE_NAME = 'baytech_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12

export interface SessionPayload {
  userId: string
  companyId: string
  roleId: string
  exp: number
}

export interface SessionUser {
  id: string
  employeeId: string
  firstName: string
  lastName: string | null
  email: string
  position: string
  department: string
  role: string
  roleId: string
  name: string
  companyId: string
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET

  if (secret && secret.length >= 32) {
    return secret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set to at least 32 characters in production')
  }

  return 'dev-only-baytech-session-secret-change-before-prod'
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sign(value: string) {
  return base64url(createHmac('sha256', getSessionSecret()).update(value).digest())
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>) {
  const body = base64url(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }))
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) return null

  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expected = sign(body)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (!payload.userId || !payload.companyId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function getSessionPayload(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)
}

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const session = getSessionPayload(request)
  if (!session) return null

  const employee = await db.employee.findFirst({
    where: {
      id: session.userId,
      companyId: session.companyId,
      isActive: true,
      status: 'ACTIVE',
    },
    include: {
      department: { select: { name: true } },
      role: { select: { id: true, name: true } },
    },
  })

  if (!employee) return null

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    position: employee.position,
    department: employee.department?.name || '',
    roleId: employee.roleId,
    role: employee.role?.name || '',
    name: `${employee.firstName} ${employee.lastName || ''}`.trim(),
    companyId: employee.companyId,
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

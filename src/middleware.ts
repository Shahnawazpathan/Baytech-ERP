import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'baytech_session'

function getSessionSecret() {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.TURSO_AUTH_TOKEN

  if (secret && secret.length >= 32) {
    return secret
  }

  // Middleware cannot throw at module scope - return null and let route-level
  // verification enforce production requirements.
  if (process.env.NODE_ENV === 'production') {
    return process.env.SESSION_SECRET || null
  }

  return 'dev-only-baytech-session-secret-change-before-prod'
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** Verify the HMAC-SHA256 session token using Edge-compatible Web Crypto. */
async function verifySessionToken(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false

  const secret = getSessionSecret()
  if (!secret) return false

  const [body, signature] = token.split('.')
  if (!body || !signature) return false

  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body))
    const expected = base64urlEncode(mac)

    if (expected.length !== signature.length) return false
    // Constant-time-ish comparison
    let mismatch = 0
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    if (mismatch !== 0) return false

    // Check expiry
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
    return Boolean(payload.userId && payload.companyId && payload.exp > Math.floor(Date.now() / 1000))
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hasValidSession = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
  )

  if (
    !hasValidSession &&
    !pathname.startsWith('/api/auth') &&
    !pathname.startsWith('/api/health') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/forgot-password') &&
    !pathname.startsWith('/reset-password') &&
    !pathname.startsWith('/demo') &&
    !pathname.startsWith('/_next') &&
    pathname !== '/baytechlogo.svg' &&
    pathname !== '/robots.txt'
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'on')

  // Performance optimizations - authenticated responses must never be publicly cacheable
  if (pathname.startsWith('/api/')) {
    const cacheControl = pathname.includes('/reports/')
      ? 'private, max-age=30, stale-while-revalidate=60'
      : 'no-cache, no-store, must-revalidate'

    response.headers.set('Cache-Control', cacheControl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

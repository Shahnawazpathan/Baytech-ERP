import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname
  const hasSessionCookie = Boolean(request.cookies.get('baytech_session')?.value)

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'on')

  // Performance optimizations
  if (pathname.startsWith('/api/')) {
    // Add cache control headers for API routes
    const cacheControl = request.nextUrl.pathname.includes('/reports/')
      ? 'public, max-age=30, stale-while-revalidate=60'
      : 'no-cache, no-store, must-revalidate'

    response.headers.set('Cache-Control', cacheControl)
  }

  if (
    !hasSessionCookie &&
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

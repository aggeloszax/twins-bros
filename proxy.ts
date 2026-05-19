import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidSessionToken } from './lib/admin-auth'

// Next.js 16: Middleware is now "Proxy" (proxy.ts at project root, Node.js
// runtime). This is an optimistic gate that keeps unauthenticated users out
// of the /admin UI; the API routes enforce the same check server-side.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The login page must stay reachable, otherwise the redirect loops.
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (await isValidSessionToken(token)) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/admin/login', request.url))
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}

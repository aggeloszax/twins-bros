import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_SESSION_COOKIE = 'twins_admin_session'

// Next.js 16: Middleware is now "Proxy" (proxy.ts at project root, Node.js
// runtime). This is an optimistic gate that keeps unauthenticated users out
// of the /admin UI; the API routes enforce the same check server-side.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The login page must stay reachable, otherwise the redirect loops.
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  if (request.cookies.has(ADMIN_SESSION_COOKIE)) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/admin/login', request.url)
  const shopSlug = request.nextUrl.searchParams.get('shop')
  if (shopSlug) loginUrl.searchParams.set('shop', shopSlug)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}

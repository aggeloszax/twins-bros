import { NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  computeSessionToken,
  getSessionTokenSecret,
} from '@/lib/admin-auth'
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_STATE_COOKIE,
  exchangeCodeForEmail,
  getGoogleConfig,
} from '@/lib/google-auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Google sends the browser back here. Signs the admin in when the account's
// verified email is in ADMIN_EMAILS; otherwise returns to the login page.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const loginUrl = (error: string) => new URL(`/admin/login?error=${error}`, url.origin)

  const fail = (error: string) => {
    const response = NextResponse.redirect(loginUrl(error))
    response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: '/api/admin/auth/google' })
    return response
  }

  const config = getGoogleConfig()
  if (!config) return fail('google_failed')

  const limited = await rateLimit(`admin-google:${getClientIp(request.headers)}`, {
    limit: 10,
    windowMs: 15 * 60_000,
  })
  if (!limited.allowed) return fail('rate_limited')

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const [expectedState, verifier] = (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${GOOGLE_STATE_COOKIE}=`))
      ?.slice(GOOGLE_STATE_COOKIE.length + 1) ?? ''
  ).split('.')
  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return fail('google_failed')
  }

  let email: string | null
  try {
    email = await exchangeCodeForEmail(config, code, verifier, `${url.origin}${GOOGLE_CALLBACK_PATH}`)
  } catch (error) {
    console.error('Google sign-in failed:', error)
    email = null
  }
  if (!email) return fail('google_failed')

  if (!config.allowedEmails.has(email)) {
    console.warn('Admin Google sign-in rejected', { email })
    return fail('google_denied')
  }

  const secret = await getSessionTokenSecret()
  if (!secret) return fail('google_failed')

  const response = NextResponse.redirect(new URL('/admin', url.origin))
  response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: '/api/admin/auth/google' })
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: await computeSessionToken(secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  })
  return response
}

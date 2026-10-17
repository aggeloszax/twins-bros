import { NextResponse } from 'next/server'
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_STATE_COOKIE,
  getGoogleConfig,
  pkceChallenge,
  randomToken,
} from '@/lib/google-auth'

export const dynamic = 'force-dynamic'

// Starts Google sign-in: remembers a random state and PKCE verifier in a
// short-lived cookie, then sends the browser to Google.
export async function GET(request: Request) {
  const config = getGoogleConfig()
  if (!config) return Response.json({ error: 'Not Found' }, { status: 404 })

  const origin = new URL(request.url).origin
  const state = randomToken()
  const verifier = randomToken()

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${origin}${GOOGLE_CALLBACK_PATH}`,
    response_type: 'code',
    scope: 'openid email',
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()

  const response = NextResponse.redirect(url)
  response.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: `${state}.${verifier}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/admin/auth/google',
    maxAge: 10 * 60,
  })
  return response
}

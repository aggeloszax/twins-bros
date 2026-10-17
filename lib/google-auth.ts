// Admin sign-in with Google (OpenID Connect, authorization code + PKCE).
// Enabled when GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and ADMIN_EMAILS are
// set; only the Google accounts listed in ADMIN_EMAILS may sign in.

export const GOOGLE_STATE_COOKIE = 'twins_google_oauth'
export const GOOGLE_CALLBACK_PATH = '/api/admin/auth/google/callback'

export function getGoogleConfig() {
  // Trimmed: values pasted into the Vercel dashboard often end in a newline,
  // which Google rejects as an unknown client.
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const allowedEmails = new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
  if (!clientId || !clientSecret || allowedEmails.size === 0) return null
  return { clientId, clientSecret, allowedEmails }
}

export function randomToken(bytes = 32) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url')
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return Buffer.from(digest).toString('base64url')
}

type IdTokenClaims = {
  iss?: string
  aud?: string
  exp?: number
  email?: string
  email_verified?: boolean
}

// Exchanges the authorization code for the user's verified email, or null.
// The ID token comes straight from Google's token endpoint over TLS, so its
// claims can be read without checking the signature (OIDC Core 3.1.3.7).
export async function exchangeCodeForEmail(
  config: NonNullable<ReturnType<typeof getGoogleConfig>>,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!res.ok) return null

  const { id_token: idToken } = (await res.json()) as { id_token?: string }
  const payload = idToken?.split('.')[1]
  if (!payload) return null

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as IdTokenClaims
  const validIssuer = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com'
  const notExpired = typeof claims.exp === 'number' && claims.exp * 1000 > Date.now()
  if (!validIssuer || claims.aud !== config.clientId || !notExpired) return null
  if (!claims.email || claims.email_verified !== true) return null
  return claims.email.toLowerCase()
}

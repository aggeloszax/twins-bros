// Shared admin-session logic. Intentionally free of any `next/*` imports so
// it can be imported safely from `proxy.ts`, Route Handlers, and Server
// Actions alike (proxy/route handlers run in the Node.js runtime, where the
// Web Crypto API is available globally).

export const ADMIN_SESSION_COOKIE = 'twins_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days, in seconds

const TOKEN_SALT = 'twins-bros::admin-session::v1'

// The cookie never stores the raw password. It stores an unforgeable token
// derived from ADMIN_PASSWORD, so it cannot be fabricated without knowing the
// secret, and a leaked cookie does not reveal the password.
export async function computeSessionToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${TOKEN_SALT}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getExpectedToken(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return null
  return computeSessionToken(password)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function isValidSessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false
  const expected = await getExpectedToken()
  if (!expected) return false
  return timingSafeEqual(token, expected)
}

// Reads the admin session cookie straight off the standard Request, so the
// route guard needs no `next/headers` dependency.
export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === ADMIN_SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return undefined
}

// Use at the top of every sensitive admin handler:
//   const denied = await requireAdmin(request)
//   if (denied) return denied
export async function requireAdmin(request: Request): Promise<Response | null> {
  const valid = await isValidSessionToken(readSessionCookie(request))
  if (valid) return null
  return Response.json({ error: 'Access Denied' }, { status: 401 })
}

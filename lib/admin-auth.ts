// Shared admin-session logic. Intentionally free of any `next/*` imports so
// it can be imported safely from `proxy.ts`, Route Handlers, and Server
// Actions alike (proxy/route handlers run in the Node.js runtime).

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/admin-password'

export const ADMIN_SESSION_COOKIE = 'twins_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days, in seconds

const TOKEN_SALT = 'twins-bros::admin-session::v1'
const ADMIN_CREDENTIAL_ID = 'admin'

// The cookie stores an unforgeable token derived from the active password hash.
// It cannot be fabricated without the database secret, and a leaked cookie does
// not reveal the password.
export async function computeSessionToken(tokenSecret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${TOKEN_SALT}:${tokenSecret}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getAdminCredentialId() {
  return ADMIN_CREDENTIAL_ID
}

async function getStoredPasswordHash(): Promise<string | null> {
  const credential = await prisma.adminCredential.findUnique({
    where: { id: ADMIN_CREDENTIAL_ID },
    select: { passwordHash: true },
  })
  return credential?.passwordHash ?? null
}

async function getExpectedToken(): Promise<string | null> {
  const storedHash = await getStoredPasswordHash()
  if (storedHash) return computeSessionToken(storedHash)

  const firstRunPassword = process.env.ADMIN_PASSWORD
  if (!firstRunPassword) return null
  return computeSessionToken(firstRunPassword)
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

export async function verifyAdminPassword(password: string): Promise<{
  valid: boolean
  tokenSecret?: string
}> {
  if (!password) return { valid: false }

  const storedHash = await getStoredPasswordHash()
  if (storedHash) {
    const valid = await verifyPassword(password, storedHash)
    return valid ? { valid, tokenSecret: storedHash } : { valid: false }
  }

  const firstRunPassword = process.env.ADMIN_PASSWORD
  if (!firstRunPassword || password !== firstRunPassword) {
    return { valid: false }
  }

  return { valid: true, tokenSecret: firstRunPassword }
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

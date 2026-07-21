// Shared admin-session logic. Intentionally free of any `next/*` imports so
// it can be imported safely from `proxy.ts`, Route Handlers, and Server
// Actions alike (proxy/route handlers run in the Node.js runtime).

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/admin-password'
import {
  DEFAULT_SHOP_SLUG,
  getShopBySlug,
  getShopSlugFromUrl,
  resolveShop,
  type ShopContext,
} from '@/lib/shops'

export const ADMIN_SESSION_COOKIE = 'twins_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days, in seconds

const MAX_PASSWORD_LENGTH = 128

const TOKEN_SALT = 'twins-bros::admin-session::v1'

// The cookie stores an unforgeable token derived from the active password hash.
// It cannot be fabricated without the database secret, and a leaked cookie does
// not reveal the password.
export async function computeSessionToken(
  tokenSecret: string,
  shopSlug = DEFAULT_SHOP_SLUG,
): Promise<string> {
  const bytes = new TextEncoder().encode(`${TOKEN_SALT}:${shopSlug}:${tokenSecret}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function encodeSessionCookieValue(shopSlug: string, token: string) {
  return `${shopSlug}:${token}`
}

function readSessionParts(token: string | undefined | null): {
  shopSlug: string
  token: string
} | null {
  if (!token) return null
  const separator = token.indexOf(':')
  if (separator === -1) {
    return { shopSlug: DEFAULT_SHOP_SLUG, token }
  }
  return {
    shopSlug: token.slice(0, separator),
    token: token.slice(separator + 1),
  }
}

async function getStoredPasswordHash(shopId: string): Promise<string | null> {
  try {
    const credential = await prisma.adminCredential.findUnique({
      where: { shopId },
      select: { passwordHash: true },
    })
    return credential?.passwordHash ?? null
  } catch (error) {
    console.error('Unable to read admin credential; falling back to ADMIN_PASSWORD.', error)
    return null
  }
}

async function getExpectedToken(shop: ShopContext): Promise<string | null> {
  const storedHash = await getStoredPasswordHash(shop.id)
  if (storedHash) return computeSessionToken(storedHash, shop.slug)

  const firstRunPassword = process.env.ADMIN_PASSWORD
  if (!firstRunPassword) return null
  return computeSessionToken(firstRunPassword, shop.slug)
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
  expectedShopSlug = DEFAULT_SHOP_SLUG,
): Promise<boolean> {
  const parts = readSessionParts(token)
  if (!parts || parts.shopSlug !== expectedShopSlug) return false
  const shop = await getShopBySlug(expectedShopSlug)
  if (!shop) return false
  const expected = await getExpectedToken(shop)
  if (!expected) return false
  return timingSafeEqual(parts.token, expected)
}

export async function verifyAdminPassword(password: string, shopSlug = DEFAULT_SHOP_SLUG): Promise<{
  valid: boolean
  shop?: ShopContext
  tokenSecret?: string
}> {
  if (!password || password.length > MAX_PASSWORD_LENGTH) return { valid: false }
  const shop = await getShopBySlug(shopSlug)
  if (!shop) return { valid: false }

  const storedHash = await getStoredPasswordHash(shop.id)
  if (storedHash) {
    const valid = await verifyPassword(password, storedHash)
    return valid ? { valid, shop, tokenSecret: storedHash } : { valid: false }
  }

  const firstRunPassword = process.env.ADMIN_PASSWORD
  if (!firstRunPassword || password !== firstRunPassword) {
    return { valid: false }
  }

  return { valid: true, shop, tokenSecret: firstRunPassword }
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
  const requestUrl = new URL(request.url)
  const shop = await resolveShop({
    explicitSlug: getShopSlugFromUrl(request.url),
    hostname:
      request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      requestUrl.host,
  })
  if (!shop) return Response.json({ error: 'Shop not found' }, { status: 404 })

  const valid = await isValidSessionToken(
    readSessionCookie(request),
    shop.slug,
  )
  if (valid) return null
  return Response.json({ error: 'Access Denied' }, { status: 401 })
}

import { prisma } from '@/lib/prisma'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  computeSessionToken,
  encodeSessionCookieValue,
  requireAdmin,
} from '@/lib/admin-auth'
import { hashPassword } from '@/lib/admin-password'
import { requireShop } from '@/lib/shops'

const MIN_PASSWORD_LENGTH = 8

function sessionCookie(token: string) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${ADMIN_SESSION_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ]

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  const { shop, response } = await requireShop(request)
  if (response) return response

  const body = (await request.json().catch(() => null)) as
    | { password?: unknown }
    | null
  const password = typeof body?.password === 'string' ? body.password : ''

  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' },
      { status: 400 },
    )
  }

  const passwordHash = await hashPassword(password)
  await prisma.adminCredential.upsert({
    where: { shopId: shop.id },
    create: { shopId: shop.id, passwordHash },
    update: { passwordHash },
  })

  const token = await computeSessionToken(passwordHash, shop.slug)
  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': sessionCookie(encodeSessionCookieValue(shop.slug, token)),
      },
    },
  )
}

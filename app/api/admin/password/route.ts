import { prisma } from '@/lib/prisma'
import {
  ADMIN_CREDENTIAL_ID,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  computeSessionToken,
  requireAdmin,
  verifyAdminPassword,
} from '@/lib/admin-auth'
import { hashPassword } from '@/lib/admin-password'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const MIN_PASSWORD_LENGTH = 15
const MAX_PASSWORD_LENGTH = 128

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

  const body = (await request.json().catch(() => null)) as
    | { password?: unknown; currentPassword?: unknown }
    | null
  const password = typeof body?.password === 'string' ? body.password : ''
  const currentPassword =
    typeof body?.currentPassword === 'string' ? body.currentPassword : ''

  // A session left open on someone else's phone must not be enough to take
  // over the account, so the current password is required too.
  const limited = await rateLimit(`admin-password:${getClientIp(request.headers)}`, {
    limit: 5,
    windowMs: 15 * 60_000,
  })
  if (!limited.allowed) {
    return Response.json(
      { error: 'Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγα λεπτά.' },
      { status: 429 },
    )
  }
  if (!(await verifyAdminPassword(currentPassword)).valid) {
    return Response.json({ error: 'Ο τρέχων κωδικός είναι λάθος.' }, { status: 403 })
  }

  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return Response.json(
      {
        error: `Ο νέος κωδικός πρέπει να έχει από ${MIN_PASSWORD_LENGTH} έως ${MAX_PASSWORD_LENGTH} χαρακτήρες.`,
      },
      { status: 400 },
    )
  }

  const passwordHash = await hashPassword(password)
  await prisma.adminCredential.upsert({
    where: { id: ADMIN_CREDENTIAL_ID },
    create: { id: ADMIN_CREDENTIAL_ID, passwordHash },
    update: { passwordHash },
  })

  const token = await computeSessionToken(passwordHash)
  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': sessionCookie(token),
      },
    },
  )
}

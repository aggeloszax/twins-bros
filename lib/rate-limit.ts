import { prisma } from '@/lib/prisma'

type RateLimitOptions = {
  limit: number
  windowMs: number
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown'

  return (
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('fly-client-ip') ??
    'unknown'
  )
}

// Fixed-window counter stored in the database, so the limit holds across all
// serverless instances. A database error lets the request through: rate
// limiting must never block bookings on its own failure.
export async function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  try {
    const resetAt = new Date(Date.now() + windowMs)
    const [bucket] = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"
    `

    // Occasionally clear expired windows so the table stays small.
    if (Math.random() < 0.01) {
      await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" <= now()`
    }

    if (bucket.count > limit) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1000)),
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Rate limit check failed; allowing request.', error)
    return { allowed: true }
  }
}

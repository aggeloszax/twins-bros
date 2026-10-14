import { isValidSessionToken, readSessionCookie } from '@/lib/admin-auth'
import { sendBookingReminderEmail } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { createBookingDateTime, getDateKeyInBookingTimeZone } from '@/lib/schedule'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAY_MS = 24 * 60 * 60_000

// Resend's default rate limit is 2 requests per second.
const SEND_GAP_MS = 600

function dayStart(dateKey: string) {
  return createBookingDateTime(dateKey, '00:00') as Date
}

function nextDateKey(dateKey: string) {
  return getDateKeyInBookingTimeZone(new Date(dayStart(dateKey).getTime() + DAY_MS + 3 * 60 * 60_000))
}

// Called daily by Vercel Cron (see vercel.json), which sends
// "Authorization: Bearer $CRON_SECRET". A logged-in admin may also call it.
// Emails every active booking of tomorrow (Athens time) that has an email
// and no reminder yet; a booking is claimed before sending, so overlapping
// runs never send twice.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authorized =
    (secret && request.headers.get('authorization') === `Bearer ${secret}`) ||
    (await isValidSessionToken(readSessionCookie(request)))
  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = nextDateKey(getDateKeyInBookingTimeZone(new Date()))
  const from = dayStart(tomorrow)
  const to = dayStart(nextDateKey(tomorrow))

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      noShow: false,
      customerEmail: { not: null },
      reminderSentAt: null,
      startTime: { gte: from, lt: to },
    },
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      cancelToken: true,
      startTime: true,
      endTime: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      barber: { select: { name: true } },
      service: { select: { name: true, duration: true } },
    },
  })

  let sent = 0
  let failed = 0
  for (const booking of bookings) {
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    })
    if (claimed.count === 0) continue

    const result = await sendBookingReminderEmail(booking)
    if (result === 'sent') {
      sent += 1
    } else {
      failed += 1
      // Let a later run retry.
      await prisma.booking.update({ where: { id: booking.id }, data: { reminderSentAt: null } })
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS))
  }

  console.info('Booking reminders:', { date: tomorrow, found: bookings.length, sent, failed })
  return Response.json({ date: tomorrow, found: bookings.length, sent, failed })
}

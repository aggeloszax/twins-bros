import { prisma } from '@/lib/prisma'
import {
  BOOKING_WINDOW_DAYS,
  getDateKeyInBookingTimeZone,
} from '@/lib/schedule'

export const dynamic = 'force-dynamic'

// Public, read-only feed of upcoming overrides so the customer calendar can
// reflect FORCE_OPEN / FORCE_CLOSE days. BLOCK_SLOT is additionally enforced
// server-side when computing available slots.
export async function GET() {
  try {
    const now = new Date()
    const windowStart = new Date(now)
    windowStart.setHours(0, 0, 0, 0)
    const windowEnd = new Date(windowStart)
    windowEnd.setDate(windowStart.getDate() + BOOKING_WINDOW_DAYS + 1)

    const exceptions = await prisma.scheduleException.findMany({
      where: { date: { gte: windowStart, lt: windowEnd } },
      orderBy: { date: 'asc' },
    })

    return Response.json(
      exceptions.map((exception) => ({
        dateKey: getDateKeyInBookingTimeZone(exception.date),
        barberName: exception.barberName,
        type: exception.type,
        slotTime: exception.slotTime,
      })),
    )
  } catch (error) {
    console.error('Failed to fetch public schedule exceptions:', error)
    return Response.json([], { status: 200 })
  }
}

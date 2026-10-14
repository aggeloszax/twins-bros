import { prisma } from '@/lib/prisma'
import {
  BOOKING_WINDOW_DAYS,
  getDateKeyInBookingTimeZone,
} from '@/lib/schedule'

export const dynamic = 'force-dynamic'

// Public, read-only feed of upcoming overrides and time off so the customer
// calendar can grey out closed days. Slots are also enforced server-side.
export async function GET() {
  try {
    const now = new Date()
    const windowStart = new Date(now)
    windowStart.setHours(0, 0, 0, 0)
    const windowEnd = new Date(windowStart)
    windowEnd.setDate(windowStart.getDate() + BOOKING_WINDOW_DAYS + 1)

    const fromKey = getDateKeyInBookingTimeZone(windowStart)
    const [exceptions, timeOff] = await Promise.all([
      prisma.scheduleException.findMany({
        where: { date: { gte: windowStart, lt: windowEnd } },
        orderBy: { date: 'asc' },
      }),
      prisma.timeOff.findMany({
        where: { endDate: { gte: fromKey } },
        select: { barberId: true, startDate: true, endDate: true },
      }),
    ])

    return Response.json({
      exceptions: exceptions.map((exception) => ({
        dateKey: getDateKeyInBookingTimeZone(exception.date),
        barberName: exception.barberName,
        type: exception.type,
        slotTime: exception.slotTime,
      })),
      timeOff,
    })
  } catch (error) {
    console.error('Failed to fetch public schedule exceptions:', error)
    return Response.json({ exceptions: [], timeOff: [] })
  }
}

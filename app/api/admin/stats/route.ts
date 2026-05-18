import { prisma } from '@/lib/prisma'
import {
  createBookingDateTime,
  getDateKeyInBookingTimeZone,
  toDateKey,
} from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const todayKey = getDateKeyInBookingTimeZone(new Date())
    const today = new Date(`${todayKey}T00:00:00`)

    const todayStart = createBookingDateTime(todayKey, '00:00')
    if (!todayStart) throw new Error('Failed to resolve today boundary')

    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60_000)

    const weekStartDate = new Date(today)
    const day = weekStartDate.getDay()
    const diff = day === 0 ? -6 : 1 - day
    weekStartDate.setDate(weekStartDate.getDate() + diff)
    const weekStart = createBookingDateTime(toDateKey(weekStartDate), '00:00')
    if (!weekStart) throw new Error('Failed to resolve week boundary')

    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000)

    const [todayBookings, weekBookings] = await Promise.all([
      prisma.booking.findMany({
        where: { startTime: { gte: todayStart, lt: todayEnd } },
        include: { service: { select: { price: true } } },
      }),
      prisma.booking.findMany({
        where: { startTime: { gte: weekStart, lt: weekEnd } },
        include: { service: { select: { price: true } } },
      }),
    ])

    const todayRevenue = todayBookings.reduce((sum, b) => sum + b.service.price, 0)
    const weekRevenue = weekBookings.reduce((sum, b) => sum + b.service.price, 0)

    return Response.json({
      todayBookings: todayBookings.length,
      todayRevenue,
      weekBookings: weekBookings.length,
      weekRevenue,
    })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return Response.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

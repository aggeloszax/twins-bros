import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const weekStart = new Date(now)
    const day = weekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    weekStart.setDate(weekStart.getDate() + diff)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const [todayBookings, weekBookings] = await Promise.all([
      prisma.booking.findMany({
        where: { startTime: { gte: todayStart, lte: todayEnd } },
        include: { service: { select: { price: true } } },
      }),
      prisma.booking.findMany({
        where: { startTime: { gte: weekStart, lte: weekEnd } },
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

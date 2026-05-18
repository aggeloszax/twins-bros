import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { startTime: 'desc' },
      include: {
        barber: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, price: true, duration: true } },
      },
    })
    return Response.json(bookings)
  } catch (error) {
    console.error('Failed to fetch bookings:', error)
    return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

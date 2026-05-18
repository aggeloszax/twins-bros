import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        barber: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, price: true, duration: true } },
      },
    })
    return Response.json(
      bookings.map((booking) => ({ ...booking, status: 'PENDING' })),
    )
  } catch (error) {
    console.error('Failed to fetch bookings:', error)
    return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

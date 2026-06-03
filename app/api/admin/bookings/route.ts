import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '') || phone.trim()
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        noShow: true,
        barber: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, price: true, duration: true } },
      },
    })

    const noShowBookings = await prisma.booking.findMany({
      where: { noShow: true },
      select: { customerPhone: true },
    })
    const noShowCountsByPhone = new Map<string, number>()

    for (const booking of noShowBookings) {
      const phoneKey = normalizePhone(booking.customerPhone)
      noShowCountsByPhone.set(
        phoneKey,
        (noShowCountsByPhone.get(phoneKey) ?? 0) + 1,
      )
    }

    return Response.json(
      bookings.map((booking) => ({
        ...booking,
        noShowCount:
          noShowCountsByPhone.get(normalizePhone(booking.customerPhone)) ?? 0,
      })),
    )
  } catch (error) {
    console.error('Failed to fetch bookings:', error)
    return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

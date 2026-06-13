import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { normalizeGreekMobilePhone } from '@/lib/phone'
import { requireShop } from '@/lib/shops'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  const { shop, response } = await requireShop(request)
  if (response) return response

  try {
    const bookings = await prisma.booking.findMany({
      where: { shopId: shop.id },
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

    const noShowBookings = await prisma.booking.groupBy({
      by: ['customerPhone'],
      where: { shopId: shop.id, noShow: true },
      _count: { _all: true },
    })
    const noShowCountsByPhone = new Map<string, number>()

    for (const booking of noShowBookings) {
      const phoneKey = normalizeGreekMobilePhone(booking.customerPhone)
      if (!phoneKey) continue
      noShowCountsByPhone.set(phoneKey, booking._count._all)
    }

    return Response.json(
      bookings.map((booking) => ({
        ...booking,
        noShowCount:
          noShowCountsByPhone.get(
            normalizeGreekMobilePhone(booking.customerPhone) ?? '',
          ) ?? 0,
      })),
    )
  } catch (error) {
    console.error('Failed to fetch bookings:', error)
    return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

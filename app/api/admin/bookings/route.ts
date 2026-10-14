import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { normalizeGreekMobilePhone } from '@/lib/phone'
import { createBookingDateTime, parseDateKey } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  // Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, Athens days) narrows
  // the list, e.g. to the month shown in the admin calendar.
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  let startTime: { gte: Date; lt: Date } | undefined

  if (from || to) {
    const rangeStart = from && parseDateKey(from) ? createBookingDateTime(from, '00:00') : null
    const rangeEndDay = to && parseDateKey(to) ? createBookingDateTime(to, '00:00') : null
    if (!rangeStart || !rangeEndDay) {
      return Response.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 })
    }
    startTime = { gte: rangeStart, lt: new Date(rangeEndDay.getTime() + 24 * 60 * 60_000) }
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: startTime ? { startTime } : undefined,
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
      where: { noShow: true },
      _count: { _all: true },
    })
    const noShowCountsByPhone = new Map<string, number>()

    for (const booking of noShowBookings) {
      const phoneKey = normalizeGreekMobilePhone(booking.customerPhone)
      if (!phoneKey) continue
      noShowCountsByPhone.set(
        phoneKey,
        (noShowCountsByPhone.get(phoneKey) ?? 0) + booking._count._all,
      )
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

import { prisma } from '@/lib/prisma'
import {
  BARBER_SCHEDULE_SELECT,
  type Slot,
  computeBarberSlots,
  loadScheduleRules,
  toScheduleSource,
} from '@/lib/availability'
import {
  ANY_BARBER,
  createBookingDateTime,
  isWithinBookingWindow,
  parseDateKey,
  SLOT_MINUTES,
} from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const barberId = searchParams.get('barberId')
  const serviceId = searchParams.get('serviceId')
  const date = searchParams.get('date')

  if (!barberId || !date) {
    return Response.json(
      { error: 'barberId and date are required' },
      { status: 400 },
    )
  }

  const selectedDate = parseDateKey(date)

  if (!selectedDate) {
    return Response.json(
      { error: 'date must be in YYYY-MM-DD format' },
      { status: 400 },
    )
  }

  try {
    if (!isWithinBookingWindow(selectedDate)) {
      return Response.json([])
    }

    const dayStart = createBookingDateTime(date, '00:00')
    const dayEnd = createBookingDateTime(date, '23:59')

    if (!dayStart || !dayEnd) {
      return Response.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 },
      )
    }

    dayEnd.setMinutes(dayEnd.getMinutes() + 1)
    // "Any barber" merges every barber's slots: a time is available when at
    // least one barber is free for the whole service.
    const anyBarber = barberId === ANY_BARBER

    const [barbers, service, bookings, rules] = await Promise.all([
      prisma.barber.findMany({
        where: anyBarber ? undefined : { id: barberId },
        select: { id: true, name: true, ...BARBER_SCHEDULE_SELECT },
      }),
      serviceId
        ? prisma.service.findFirst({
            where: { id: serviceId },
            select: { duration: true },
          })
        : Promise.resolve(null),
      prisma.booking.findMany({
        where: {
          ...(anyBarber ? {} : { barberId }),
          status: { not: 'CANCELLED' },
          startTime: { gte: dayStart, lt: dayEnd },
        },
        select: { barberId: true, startTime: true, endTime: true },
      }),
      loadScheduleRules(date, date),
    ])

    if (barbers.length === 0) {
      return Response.json([], { status: 404 })
    }
    if (serviceId && !service) {
      return Response.json([], { status: 404 })
    }

    const now = new Date()
    const durationMinutes = service?.duration ?? SLOT_MINUTES
    const merged = new Map<string, boolean>()

    for (const barber of barbers) {
      const slots = computeBarberSlots({
        barber: { ...toScheduleSource(barber), name: barber.name },
        dateKey: date,
        durationMinutes,
        bookings: bookings.filter((booking) => booking.barberId === barber.id),
        exceptions: rules.exceptions,
        timeOff: rules.timeOff,
        now,
      })
      for (const slot of slots) {
        merged.set(slot.time, (merged.get(slot.time) ?? false) || slot.available)
      }
    }

    const slots: Slot[] = Array.from(merged, ([time, available]) => ({ time, available })).sort(
      (a, b) => a.time.localeCompare(b.time),
    )
    return Response.json(slots)
  } catch (error) {
    console.error('Failed to fetch available slots:', error)
    return Response.json(
      { error: 'Failed to fetch available slots' },
      { status: 500 },
    )
  }
}

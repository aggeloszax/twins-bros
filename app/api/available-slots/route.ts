import { prisma } from '@/lib/prisma'
import { BARBER_SCHEDULE_SELECT, loadScheduleRules, toScheduleSource } from '@/lib/availability'
import {
  buildSlotTimes,
  createBookingDateTime,
  getBarberPeriodsForDate,
  isSlotBlocked,
  isSlotTimeWithinPeriods,
  isWithinBookingWindow,
  parseDateKey,
  SLOT_MINUTES,
} from '@/lib/schedule'

export const dynamic = 'force-dynamic'

type Slot = { time: string; available: boolean }
type BookingWindow = { startTime: Date; endTime: Date }

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

    const [barber, service, bookings, rules] = await Promise.all([
      prisma.barber.findUnique({
        where: { id: barberId },
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
          barberId,
          status: { not: 'CANCELLED' },
          startTime: { gte: dayStart, lt: dayEnd },
        },
        select: { startTime: true, endTime: true },
      }),
      loadScheduleRules(date, date),
    ])

    if (!barber) {
      return Response.json([], { status: 404 })
    }
    if (serviceId && !service) {
      return Response.json([], { status: 404 })
    }

    const { exceptions, timeOff } = rules
    const periods = getBarberPeriodsForDate(toScheduleSource(barber), date, exceptions, timeOff)
    if (periods.length === 0) return Response.json([])

    const now = new Date()
    const slots: Slot[] = []
    const durationMinutes = service?.duration ?? SLOT_MINUTES

    for (const time of buildSlotTimes(date, periods, now)) {
      // Manually blocked slots are removed entirely so they can't be picked.
      if (isSlotBlocked(exceptions, date, time, barber.name)) continue

      const slotStart = createBookingDateTime(date, time)
      if (!slotStart) continue

      if (
        !isSlotTimeWithinPeriods(time, durationMinutes, periods)
      ) {
        continue
      }

      const slotEnd = new Date(
        slotStart.getTime() + durationMinutes * 60_000,
      )

      const overlapsBooking = bookings.some(
        (booking: BookingWindow) =>
          slotStart < booking.endTime && slotEnd > booking.startTime,
      )

      slots.push({ time, available: !overlapsBooking })
    }

    return Response.json(slots)
  } catch (error) {
    console.error('Failed to fetch available slots:', error)
    return Response.json(
      { error: 'Failed to fetch available slots' },
      { status: 500 },
    )
  }
}

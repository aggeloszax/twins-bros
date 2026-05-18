import { prisma } from '@/lib/prisma'
import {
  buildSlotTimes,
  createBookingDateTime,
  isClosedDay,
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
    if (isClosedDay(selectedDate) || !isWithinBookingWindow(selectedDate)) {
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

    const bookings = await prisma.booking.findMany({
      where: {
        barberId,
        startTime: { gte: dayStart, lt: dayEnd },
      },
      select: { startTime: true, endTime: true },
    })

    const now = new Date()
    const slots: Slot[] = []

    for (const time of buildSlotTimes(date, now)) {
      const slotStart = createBookingDateTime(date, time)
      if (!slotStart) continue

      const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000)

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

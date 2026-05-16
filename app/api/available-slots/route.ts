import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const OPEN_HOUR = 9 // 09:00
const CLOSE_HOUR = 21 // 21:00 (last slot starts at 20:30)
const SLOT_MINUTES = 30

type Slot = { time: string; available: boolean }

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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { error: 'date must be in YYYY-MM-DD format' },
      { status: 400 },
    )
  }

  try {
    const dayStart = new Date(`${date}T00:00:00`)
    const dayEnd = new Date(`${date}T00:00:00`)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const bookings = await prisma.booking.findMany({
      where: {
        barberId,
        startTime: { gte: dayStart, lt: dayEnd },
      },
      select: { startTime: true, endTime: true },
    })

    const now = new Date()
    const slots: Slot[] = []

    for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        const slotStart = new Date(`${date}T${time}:00`)
        const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000)

        const isPast = slotStart.getTime() <= now.getTime()
        const overlapsBooking = bookings.some(
          (booking) =>
            slotStart < booking.endTime && slotEnd > booking.startTime,
        )

        slots.push({ time, available: !isPast && !overlapsBooking })
      }
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

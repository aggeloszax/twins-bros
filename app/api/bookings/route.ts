import { sendBookingNotifications } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import {
  createBookingDateTime,
  isClosedDay,
  isSlotTimeWithinWorkingHours,
  isWithinBookingWindow,
  parseDateKey,
} from '@/lib/schedule'

export const dynamic = 'force-dynamic'

type BookingPayload = {
  serviceId?: unknown
  barberId?: unknown
  date?: unknown
  slotTime?: unknown
  customerName?: unknown
  customerPhone?: unknown
  customerEmail?: unknown
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export async function POST(request: Request) {
  let payload: BookingPayload

  try {
    payload = (await request.json()) as BookingPayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const {
    serviceId,
    barberId,
    date,
    slotTime,
    customerName,
    customerPhone,
    customerEmail,
  } = payload

  if (
    !isNonEmptyString(serviceId) ||
    !isNonEmptyString(barberId) ||
    !isNonEmptyString(date) ||
    !isNonEmptyString(slotTime) ||
    !isNonEmptyString(customerName) ||
    !isNonEmptyString(customerPhone)
  ) {
    return Response.json(
      { error: 'Required booking fields are missing' },
      { status: 400 },
    )
  }

  const selectedDate = parseDateKey(date)

  if (!selectedDate || !/^\d{2}:\d{2}$/.test(slotTime)) {
    return Response.json(
      { error: 'Invalid date or slotTime format' },
      { status: 400 },
    )
  }

  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true },
    })

    if (!service) {
      return Response.json({ error: 'Service not found' }, { status: 404 })
    }

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      select: { id: true },
    })

    if (!barber) {
      return Response.json({ error: 'Barber not found' }, { status: 404 })
    }

    const startTime = createBookingDateTime(date, slotTime)
    if (!startTime) {
      return Response.json(
        { error: 'Invalid date or slotTime format' },
        { status: 400 },
      )
    }

    const endTime = new Date(startTime.getTime() + service.duration * 60_000)
    const now = new Date()

    if (
      isClosedDay(selectedDate) ||
      !isWithinBookingWindow(selectedDate, now) ||
      startTime <= now ||
      !isSlotTimeWithinWorkingHours(slotTime, service.duration)
    ) {
      return Response.json(
        { error: 'This time slot is not available' },
        { status: 400 },
      )
    }

    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        barberId,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { id: true },
    })

    if (overlappingBooking) {
      return Response.json(
        { error: 'This time slot is no longer available' },
        { status: 409 },
      )
    }

    const booking = await prisma.booking.create({
      data: {
        serviceId,
        barberId,
        startTime,
        endTime,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: isNonEmptyString(customerEmail)
          ? customerEmail.trim()
          : null,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        barber: {
          select: {
            id: true,
            name: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
          },
        },
      },
    })

    try {
      await sendBookingNotifications(booking)
    } catch (notificationError) {
      console.error('Failed to send booking notifications:', notificationError)
    }

    return Response.json(booking, { status: 201 })
  } catch (error) {
    console.error('Failed to create booking:', error)
    return Response.json(
      { error: 'Failed to create booking' },
      { status: 500 },
    )
  }
}

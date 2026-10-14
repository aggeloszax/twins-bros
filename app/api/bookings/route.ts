import { googleCalendarUrl } from '@/lib/calendar'
import { sendBookingNotifications } from '@/lib/notifications'
import { isValidSessionToken, readSessionCookie } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { normalizeGreekMobilePhone } from '@/lib/phone'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { BARBER_SCHEDULE_SELECT, loadScheduleRules, toScheduleSource } from '@/lib/availability'
import {
  ANY_BARBER,
  createBookingDateTime,
  getBarberPeriodsForDate,
  isSlotBlocked,
  isSlotTimeWithinPeriods,
  isWithinBookingWindow,
  parseDateKey,
} from '@/lib/schedule'
import { createSecureToken } from '@/lib/tokens'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type BookingPayload = {
  serviceId?: unknown
  barberId?: unknown
  date?: unknown
  slotTime?: unknown
  customerName?: unknown
  customerPhone?: unknown
  customerEmail?: unknown
  notes?: unknown
  adminManual?: unknown
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidEmail(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
}

export async function POST(request: Request) {
  const isAdminSession = await isValidSessionToken(readSessionCookie(request))

  if (!isAdminSession) {
    const clientIp = getClientIp(request.headers)
    const limited = await rateLimit(`booking:${clientIp}`, {
      limit: 8,
      windowMs: 15 * 60_000,
    })

    if (!limited.allowed) {
      return Response.json(
        { error: 'Too many booking attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limited.retryAfter) },
        },
      )
    }
  }

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
    notes,
    adminManual,
  } = payload
  const isAdminManualBooking = isAdminSession && adminManual === true

  if (
    !isNonEmptyString(serviceId) ||
    !isNonEmptyString(barberId) ||
    !isNonEmptyString(date) ||
    !isNonEmptyString(slotTime) ||
    !isNonEmptyString(customerName) ||
    !isNonEmptyString(customerPhone) ||
    // Walk-in or phone bookings entered by the admin may have no email.
    !(isValidEmail(customerEmail) || (isAdminManualBooking && !isNonEmptyString(customerEmail)))
  ) {
    return Response.json(
      { error: 'Required booking fields are missing' },
      { status: 400 },
    )
  }

  const selectedDate = parseDateKey(date)
  const normalizedCustomerPhone = normalizeGreekMobilePhone(customerPhone)

  if (!selectedDate || !/^\d{2}:\d{2}$/.test(slotTime)) {
    return Response.json(
      { error: 'Invalid date or slotTime format' },
      { status: 400 },
    )
  }

  if (!normalizedCustomerPhone) {
    return Response.json(
      { error: 'Invalid customer phone format' },
      { status: 400 },
    )
  }

  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 500)) {
    return Response.json({ error: 'Invalid notes' }, { status: 400 })
  }
  const bookingNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : null

  try {
    // Blocked customers cannot book online; the shop can still book them.
    if (!isAdminManualBooking) {
      const customer = await prisma.customer.findUnique({
        where: { phone: normalizedCustomerPhone },
        select: { blocked: true },
      })
      if (customer?.blocked) {
        return Response.json(
          { error: 'Online booking is not available for this customer', code: 'CUSTOMER_BLOCKED' },
          { status: 403 },
        )
      }
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId },
      select: { duration: true },
    })

    if (!service) {
      return Response.json({ error: 'Service not found' }, { status: 404 })
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
    const anyBarber = barberId === ANY_BARBER && !isAdminManualBooking

    const barbers = await prisma.barber.findMany({
      where: anyBarber ? undefined : { id: barberId },
      select: { id: true, name: true, ...BARBER_SCHEDULE_SELECT },
    })

    if (barbers.length === 0) {
      return Response.json({ error: 'Barber not found' }, { status: 404 })
    }

    if (!isAdminManualBooking && (!isWithinBookingWindow(selectedDate, now) || startTime <= now)) {
      return Response.json(
        { error: 'This time slot is not available' },
        { status: 400 },
      )
    }

    // Re-check the barber's hours and the manual overrides server-side: the
    // client cannot be trusted, and the slot feed could be stale. The admin
    // may book outside working hours.
    const { exceptions, timeOff } = await loadScheduleRules(date, date)
    let candidates = barbers.filter((barber) => {
      if (isAdminManualBooking) return true
      const periods = getBarberPeriodsForDate(toScheduleSource(barber), date, exceptions, timeOff)
      return (
        isSlotTimeWithinPeriods(slotTime, service.duration, periods) &&
        !isSlotBlocked(exceptions, date, slotTime, barber.name)
      )
    })

    if (candidates.length === 0) {
      return Response.json(
        { error: 'This time slot is not available' },
        { status: 400 },
      )
    }

    // With no preferred barber, try the least busy barber of the day first.
    if (anyBarber && candidates.length > 1) {
      const dayStart = createBookingDateTime(date, '00:00') as Date
      const counts = await prisma.booking.groupBy({
        by: ['barberId'],
        where: {
          status: { not: 'CANCELLED' },
          startTime: { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60_000) },
        },
        _count: { _all: true },
      })
      const load = new Map(counts.map((row) => [row.barberId, row._count._all]))
      candidates = candidates
        .map((barber) => ({ barber, order: (load.get(barber.id) ?? 0) + Math.random() / 2 }))
        .sort((a, b) => a.order - b.order)
        .map(({ barber }) => barber)
    }

    const createFor = (chosenBarberId: string) =>
      prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            WITH lock AS MATERIALIZED (
              SELECT pg_advisory_xact_lock(hashtext(${chosenBarberId}))
            )
            SELECT 1 AS locked FROM lock
          `

          const overlappingBooking = await tx.booking.findFirst({
            where: {
              barberId: chosenBarberId,
              status: { not: 'CANCELLED' },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
            select: { id: true },
          })

          if (overlappingBooking) {
            return null
          }

          return tx.booking.create({
            data: {
              serviceId,
              barberId: chosenBarberId,
              startTime,
              endTime,
              cancelToken: createSecureToken(),
              customerName: customerName.trim(),
              customerPhone: normalizedCustomerPhone,
              customerEmail: isValidEmail(customerEmail) ? customerEmail.trim() : null,
              notes: bookingNotes,
            },
            select: {
              id: true,
              cancelToken: true,
              startTime: true,
              endTime: true,
              status: true,
              customerName: true,
              customerPhone: true,
              customerEmail: true,
              notes: true,
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

    let bookingWithToken: Awaited<ReturnType<typeof createFor>> = null
    for (const candidate of candidates) {
      bookingWithToken = await createFor(candidate.id)
      if (bookingWithToken) break
    }

    if (!bookingWithToken) {
      return Response.json(
        { error: 'This time slot is no longer available' },
        { status: 409 },
      )
    }

    let notificationDelivery: {
      customerEmail: 'sent' | 'failed' | 'skipped'
      shopEmail: 'sent' | 'failed'
    } = {
      customerEmail: bookingWithToken.customerEmail ? 'failed' : 'skipped',
      shopEmail: 'failed',
    }

    try {
      notificationDelivery = await sendBookingNotifications(bookingWithToken)
    } catch (notificationError) {
      console.error('Failed to send booking notifications:', notificationError)
    }

    const booking = { ...bookingWithToken }
    delete (booking as { cancelToken?: string }).cancelToken

    // The booker already holds the booking through the email links; these
    // power the "add to calendar" buttons on the confirmation screen.
    const calendar = {
      google: googleCalendarUrl({
        uid: booking.id,
        start: booking.startTime,
        end: booking.endTime,
        serviceName: booking.service.name,
        barberName: booking.barber.name,
      }),
      ics: `/api/bookings/${booking.id}/calendar?token=${encodeURIComponent(bookingWithToken.cancelToken)}`,
    }

    return Response.json(
      { ...booking, notificationDelivery, calendar },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create booking:', error)
    return Response.json(
      { error: 'Failed to create booking' },
      { status: 500 },
    )
  }
}

import { sendBookingNotifications } from '@/lib/notifications'
import { isValidSessionToken, readSessionCookie } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { normalizeGreekMobilePhone } from '@/lib/phone'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import {
  createBookingDateTime,
  isClosedDay,
  isDateForceClosed,
  isDateForceOpen,
  isSlotBlocked,
  isSlotTimeWithinWorkingHours,
  isWithinBookingWindow,
  normalizeScheduleExceptions,
  parseDateKey,
} from '@/lib/schedule'
import { createSecureToken } from '@/lib/tokens'
import { requireShop } from '@/lib/shops'
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
  const { shop, response } = await requireShop(request)
  if (response) return response

  const isAdminSession = await isValidSessionToken(
    readSessionCookie(request),
    shop.slug,
  )

  if (!isAdminSession) {
    const clientIp = getClientIp(request.headers)
    const limited = rateLimit(`booking:${shop.slug}:${clientIp}`, {
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
    !isValidEmail(customerEmail)
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

  try {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, shopId: shop.id },
      select: { duration: true },
    })

    if (!service) {
      return Response.json({ error: 'Service not found' }, { status: 404 })
    }

    const barber = await prisma.barber.findFirst({
      where: { id: barberId, shopId: shop.id },
      select: { id: true, name: true },
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

    // Re-enforce manual schedule overrides server-side — the client cannot be
    // trusted, and the slot feed could be stale.
    const rawExceptions = await prisma.scheduleException.findMany({
      where: {
        shopId: shop.id,
        date: {
          gte: createBookingDateTime(date, '00:00') ?? undefined,
          lt: new Date(startTime.getTime() + 24 * 60 * 60_000),
        },
      },
    })
    const exceptions = normalizeScheduleExceptions(rawExceptions)
    const forceClosed = isDateForceClosed(exceptions, date)
    const forceOpen = isDateForceOpen(exceptions, date)

    if (
      !isAdminManualBooking &&
      (forceClosed ||
        (isClosedDay(selectedDate, shop.workingPeriods) && !forceOpen) ||
        !isWithinBookingWindow(selectedDate, now) ||
        startTime <= now ||
        !isSlotTimeWithinWorkingHours(
          slotTime,
          service.duration,
          shop.workingPeriods,
          selectedDate,
        ) ||
        isSlotBlocked(exceptions, date, slotTime, barber.name))
    ) {
      return Response.json(
        { error: 'This time slot is not available' },
        { status: 400 },
      )
    }

    const bookingWithToken = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          WITH lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtext(${`${shop.id}:${barberId}`}))
          )
          SELECT 1 AS locked FROM lock
        `

        const overlappingBooking = await tx.booking.findFirst({
          where: {
            shopId: shop.id,
            barberId,
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
            shopId: shop.id,
            serviceId,
            barberId,
            startTime,
            endTime,
            cancelToken: createSecureToken(),
            customerName: customerName.trim(),
            customerPhone: normalizedCustomerPhone,
            customerEmail: customerEmail.trim(),
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
            shop: {
              select: {
                slug: true,
                name: true,
                logoUrl: true,
                primaryColor: true,
              },
            },
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )

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

    return Response.json(
      { ...booking, notificationDelivery },
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

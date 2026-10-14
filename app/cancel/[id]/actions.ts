'use server'

import { Prisma } from '@prisma/client'
import { BARBER_SCHEDULE_SELECT, computeBarberSlots, loadScheduleRules, toScheduleSource } from '@/lib/availability'
import { sendBookingRescheduledEmail } from '@/lib/notifications'
import { notifyBookingCancelled, notifyBookingMoved } from '@/lib/push'
import { prisma } from '@/lib/prisma'
import {
  canCancelBooking,
  createBookingDateTime,
  isWithinBookingWindow,
  parseDateKey,
} from '@/lib/schedule'

export type CancelResult =
  | { ok: true }
  | {
      ok: false
      reason: 'not-found' | 'already-cancelled' | 'too-late' | 'error'
    }

export async function cancelBooking(
  id: string,
  token: string,
): Promise<CancelResult> {
  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    typeof token !== 'string' ||
    token.trim().length === 0
  ) {
    return { ok: false, reason: 'not-found' }
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        cancelToken: true,
        startTime: true,
        status: true,
        customerName: true,
        barber: { select: { id: true, name: true } },
        service: { select: { name: true } },
      },
    })

    if (!booking || booking.cancelToken !== token) {
      return { ok: false, reason: 'not-found' }
    }

    if (booking.status === 'CANCELLED') {
      return { ok: false, reason: 'already-cancelled' }
    }

    // Re-enforce the 2.5h policy on the server — the client cannot be trusted,
    // and time may have passed since the page was rendered.
    if (!canCancelBooking(booking.startTime, new Date())) {
      return { ok: false, reason: 'too-late' }
    }

    const result = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        cancelToken: token,
        status: { not: 'CANCELLED' },
      },
      data: { status: 'CANCELLED', noShow: false },
    })

    if (result.count === 0) {
      return { ok: false, reason: 'already-cancelled' }
    }

    await notifyBookingCancelled(booking)

    return { ok: true }
  } catch (error) {
    console.error('Failed to cancel booking:', error)
    return { ok: false, reason: 'error' }
  }
}

export type RescheduleResult =
  | { ok: true; date: string; time: string }
  | {
      ok: false
      reason: 'not-found' | 'already-cancelled' | 'too-late' | 'unavailable' | 'error'
    }

// The customer moves their own booking to another free time with the same
// barber and service. Same rules as a new booking, plus the 2.5h policy on
// the current time.
export async function rescheduleBooking(
  id: string,
  token: string,
  date: string,
  slotTime: string,
): Promise<RescheduleResult> {
  if (
    typeof id !== 'string' ||
    typeof token !== 'string' ||
    !token ||
    typeof date !== 'string' ||
    typeof slotTime !== 'string' ||
    !/^\d{2}:\d{2}$/.test(slotTime)
  ) {
    return { ok: false, reason: 'not-found' }
  }

  const selectedDate = parseDateKey(date)
  const newStart = createBookingDateTime(date, slotTime)
  if (!selectedDate || !newStart) return { ok: false, reason: 'unavailable' }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        cancelToken: true,
        status: true,
        startTime: true,
        barber: { select: { id: true, name: true, ...BARBER_SCHEDULE_SELECT } },
        service: { select: { duration: true } },
      },
    })

    if (!booking || booking.cancelToken !== token) return { ok: false, reason: 'not-found' }
    if (booking.status === 'CANCELLED') return { ok: false, reason: 'already-cancelled' }
    if (booking.status !== 'PENDING' || !canCancelBooking(booking.startTime, new Date())) {
      return { ok: false, reason: 'too-late' }
    }

    const now = new Date()
    if (!isWithinBookingWindow(selectedDate, now) || newStart <= now) {
      return { ok: false, reason: 'unavailable' }
    }

    const duration = booking.service.duration
    const newEnd = new Date(newStart.getTime() + duration * 60_000)
    const dayStart = createBookingDateTime(date, '00:00') as Date
    const [dayBookings, rules] = await Promise.all([
      prisma.booking.findMany({
        where: {
          barberId: booking.barber.id,
          id: { not: booking.id },
          status: { not: 'CANCELLED' },
          startTime: { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60_000) },
        },
        select: { startTime: true, endTime: true },
      }),
      loadScheduleRules(date, date),
    ])

    const slot = computeBarberSlots({
      barber: { ...toScheduleSource(booking.barber), name: booking.barber.name },
      dateKey: date,
      durationMinutes: duration,
      bookings: dayBookings,
      exceptions: rules.exceptions,
      timeOff: rules.timeOff,
      now,
    }).find((item) => item.time === slotTime)
    if (!slot?.available) return { ok: false, reason: 'unavailable' }

    const updated = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          WITH lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtext(${booking.barber.id}))
          )
          SELECT 1 AS locked FROM lock
        `
        const overlapping = await tx.booking.findFirst({
          where: {
            id: { not: booking.id },
            barberId: booking.barber.id,
            status: { not: 'CANCELLED' },
            startTime: { lt: newEnd },
            endTime: { gt: newStart },
          },
          select: { id: true },
        })
        if (overlapping) return null

        return tx.booking.update({
          where: { id: booking.id },
          data: { startTime: newStart, endTime: newEnd, reminderSentAt: null },
          select: {
            id: true,
            cancelToken: true,
            startTime: true,
            endTime: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            barber: { select: { id: true, name: true } },
            service: { select: { name: true, duration: true } },
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )

    if (!updated) return { ok: false, reason: 'unavailable' }

    await Promise.allSettled([
      sendBookingRescheduledEmail(updated),
      notifyBookingMoved(updated, booking.startTime),
    ])

    return { ok: true, date, time: slotTime }
  } catch (error) {
    console.error('Failed to reschedule booking:', error)
    return { ok: false, reason: 'error' }
  }
}

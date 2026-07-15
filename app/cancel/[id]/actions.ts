'use server'

import { prisma } from '@/lib/prisma'
import { canCancelBooking } from '@/lib/schedule'

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
      select: { id: true, cancelToken: true, startTime: true, status: true },
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

    return { ok: true }
  } catch (error) {
    console.error('Failed to cancel booking:', error)
    return { ok: false, reason: 'error' }
  }
}

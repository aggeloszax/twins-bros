'use server'

import { prisma } from '@/lib/prisma'
import { canCancelBooking } from '@/lib/schedule'

export type CancelResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'too-late' | 'error' }

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
      select: { id: true, cancelToken: true, startTime: true },
    })

    if (!booking || booking.cancelToken !== token) {
      return { ok: false, reason: 'not-found' }
    }

    // Re-enforce the 2.5h policy on the server — the client cannot be trusted,
    // and time may have passed since the page was rendered.
    if (!canCancelBooking(booking.startTime, new Date())) {
      return { ok: false, reason: 'too-late' }
    }

    // deleteMany is idempotent: if the record was already removed (e.g. by an
    // admin) the end state still matches the customer's intent.
    await prisma.booking.deleteMany({ where: { id: booking.id } })
    return { ok: true }
  } catch (error) {
    console.error('Failed to cancel booking:', error)
    return { ok: false, reason: 'error' }
  }
}

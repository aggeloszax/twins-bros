import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { normalizeGreekMobilePhone } from '@/lib/phone'
import type { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

type UpdateBookingPayload = {
  status?: unknown
  noShow?: unknown
}

const STATUSES = new Set<BookingStatus>(['PENDING', 'COMPLETED', 'CANCELLED'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: UpdateBookingPayload

  try {
    payload = (await request.json()) as UpdateBookingPayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const hasStatus = payload.status !== undefined
  const hasNoShow = payload.noShow !== undefined

  if (!hasStatus && !hasNoShow) {
    return Response.json({ error: 'No booking updates provided' }, { status: 400 })
  }

  if (
    hasStatus &&
    (typeof payload.status !== 'string' || !STATUSES.has(payload.status as BookingStatus))
  ) {
    return Response.json({ error: 'Invalid booking status' }, { status: 400 })
  }

  if (hasNoShow && typeof payload.noShow !== 'boolean') {
    return Response.json({ error: 'Invalid no-show value' }, { status: 400 })
  }

  try {
    const { id } = await params
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(hasStatus ? { status: payload.status as BookingStatus } : {}),
        ...(hasNoShow ? { noShow: payload.noShow as boolean } : {}),
      },
      include: {
        barber: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, price: true, duration: true } },
      },
    })

    const phoneKey = normalizeGreekMobilePhone(booking.customerPhone)
    const noShowCount = phoneKey
      ? await prisma.booking.count({
          where: { noShow: true, customerPhone: phoneKey },
        })
      : 0

    return Response.json({ ...booking, noShowCount })
  } catch (error) {
    console.error('Failed to update booking:', error)
    return Response.json({ error: 'Booking not found' }, { status: 404 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const { id } = await params
    await prisma.booking.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete booking:', error)
    return Response.json({ error: 'Booking not found' }, { status: 404 })
  }
}

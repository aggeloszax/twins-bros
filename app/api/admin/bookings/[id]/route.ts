import { prisma } from '@/lib/prisma'
import type { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

type UpdateBookingPayload = {
  status?: unknown
}

const STATUSES = new Set<BookingStatus>(['PENDING', 'COMPLETED', 'CANCELLED'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let payload: UpdateBookingPayload

  try {
    payload = (await request.json()) as UpdateBookingPayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (typeof payload.status !== 'string' || !STATUSES.has(payload.status as BookingStatus)) {
    return Response.json({ error: 'Invalid booking status' }, { status: 400 })
  }

  try {
    const { id } = await params
    const booking = await prisma.booking.update({
      where: { id },
      data: { status: payload.status as BookingStatus },
      include: {
        barber: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, price: true, duration: true } },
      },
    })

    return Response.json(booking)
  } catch (error) {
    console.error('Failed to update booking:', error)
    return Response.json({ error: 'Booking not found' }, { status: 404 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.booking.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete booking:', error)
    return Response.json({ error: 'Booking not found' }, { status: 404 })
  }
}

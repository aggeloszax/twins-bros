import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type CreateBarberPayload = {
  name?: unknown
  image?: unknown
}

export async function GET() {
  try {
    const barbers = await prisma.barber.findMany({
      orderBy: { name: 'asc' },
    })
    return Response.json(barbers)
  } catch (error) {
    console.error('Failed to fetch barbers:', error)
    return Response.json(
      { error: 'Failed to fetch barbers' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let payload: CreateBarberPayload
  try {
    payload = (await request.json()) as CreateBarberPayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { name, image } = payload

  if (typeof name !== 'string' || name.trim().length === 0) {
    return Response.json({ error: 'Το όνομα είναι υποχρεωτικό.' }, { status: 400 })
  }

  try {
    const barber = await prisma.barber.create({
      data: {
        name: name.trim(),
        image:
          typeof image === 'string' && image.trim().length > 0
            ? image.trim()
            : null,
      },
    })
    return Response.json(barber, { status: 201 })
  } catch (error) {
    console.error('Failed to create barber:', error)
    return Response.json(
      { error: 'Failed to create barber' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    // Safety: never break historic bookings. Refuse deletion while any
    // booking still references this barber.
    const linkedBookings = await prisma.booking.count({
      where: { barberId: id },
    })
    if (linkedBookings > 0) {
      return Response.json(
        {
          error: `Δεν είναι δυνατή η διαγραφή: υπάρχουν ${linkedBookings} ραντεβού συνδεδεμένα με αυτόν τον κουρέα.`,
        },
        { status: 409 },
      )
    }

    await prisma.barber.deleteMany({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete barber:', error)
    return Response.json(
      { error: 'Failed to delete barber' },
      { status: 500 },
    )
  }
}

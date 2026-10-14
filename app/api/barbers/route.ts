import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import {
  barberImageUrl,
  parseBarberImage,
  PUBLIC_BARBER_SELECT,
  type BarberImageInput,
} from '@/lib/barber-images'

export const dynamic = 'force-dynamic'

type CreateBarberPayload = {
  name?: unknown
  image?: unknown
}

type UpdateBarberPayload = {
  id?: unknown
  image?: unknown
}

// Prisma data for a barber's photo columns, given the parsed upload.
function imageData(input: BarberImageInput, barberId: string) {
  switch (input.kind) {
    case 'upload':
      return {
        image: barberImageUrl(barberId),
        imageData: input.bytes,
        imageType: input.type,
      }
    case 'path':
      return { image: input.path, imageData: null, imageType: null }
    default:
      return { image: null, imageData: null, imageType: null }
  }
}

export async function GET() {
  try {
    const barbers = await prisma.barber.findMany({
      select: PUBLIC_BARBER_SELECT,
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
  const denied = await requireAdmin(request)
  if (denied) return denied

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
    const parsedImage = parseBarberImage(image)
    if (parsedImage.kind === 'invalid') {
      return Response.json(
        { error: 'Η φωτογραφία δεν είναι έγκυρη ή είναι πολύ μεγάλη.' },
        { status: 400 },
      )
    }

    const id = crypto.randomUUID()
    const barber = await prisma.barber.create({
      data: {
        id,
        name: name.trim(),
        ...imageData(parsedImage, id),
      },
      select: PUBLIC_BARBER_SELECT,
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

export async function PATCH(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: UpdateBarberPayload
  try {
    payload = (await request.json()) as UpdateBarberPayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { id, image } = payload
  if (typeof id !== 'string' || !id.trim()) {
    return Response.json({ error: 'id is required' }, { status: 400 })
  }

  const parsedImage = parseBarberImage(image)
  if (parsedImage.kind === 'none' || parsedImage.kind === 'invalid') {
    return Response.json(
      { error: 'Η νέα φωτογραφία δεν είναι έγκυρη ή είναι πολύ μεγάλη.' },
      { status: 400 },
    )
  }

  try {
    const existingBarber = await prisma.barber.findFirst({
      where: { id: id.trim() },
      select: { id: true },
    })

    if (!existingBarber) {
      return Response.json({ error: 'Ο κουρέας δεν βρέθηκε.' }, { status: 404 })
    }

    const barber = await prisma.barber.update({
      where: { id: existingBarber.id },
      data: imageData(parsedImage, existingBarber.id),
      select: PUBLIC_BARBER_SELECT,
    })

    return Response.json(barber)
  } catch (error) {
    console.error('Failed to update barber:', error)
    return Response.json(
      { error: 'Failed to update barber' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

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

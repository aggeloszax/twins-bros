import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

type CreateBarberPayload = {
  name?: unknown
  image?: unknown
}

const MAX_IMAGE_DATA_URL_LENGTH = 1_500_000

function normalizeImage(image: unknown) {
  if (typeof image !== 'string') return null

  const value = image.trim()
  if (!value) return null

  const isStoredPath = value.startsWith('/barbers/')
  const isUploadedDataUrl = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)
  if (!isStoredPath && !isUploadedDataUrl) return undefined
  if (value.length > MAX_IMAGE_DATA_URL_LENGTH) return undefined

  return value
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
    const normalizedImage = normalizeImage(image)
    if (normalizedImage === undefined) {
      return Response.json(
        { error: 'Η φωτογραφία δεν είναι έγκυρη ή είναι πολύ μεγάλη.' },
        { status: 400 },
      )
    }

    const barber = await prisma.barber.create({
      data: {
        name: name.trim(),
        image: normalizedImage,
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

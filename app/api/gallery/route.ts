import { requireAdmin } from '@/lib/admin-auth'
import { parseBarberImage } from '@/lib/barber-images'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_PHOTOS = 12

const PHOTO_SELECT = { id: true, caption: true, position: true } as const

function toPublic(photo: { id: string; caption: string | null }) {
  return { id: photo.id, caption: photo.caption, url: `/api/gallery/${photo.id}/image` }
}

function ordered() {
  return prisma.galleryPhoto.findMany({
    select: PHOTO_SELECT,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })
}

// Shop photos for the booking page, in display order.
export async function GET() {
  try {
    return Response.json((await ordered()).map(toPublic))
  } catch (error) {
    console.error('Failed to fetch gallery:', error)
    return Response.json({ error: 'Failed to fetch gallery' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: { image?: unknown; caption?: unknown }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  // Same upload format and size limit as barber photos.
  const parsed = parseBarberImage(payload.image)
  if (parsed.kind !== 'upload') {
    return Response.json({ error: 'Η φωτογραφία δεν είναι έγκυρη ή είναι πολύ μεγάλη.' }, { status: 400 })
  }

  const count = await prisma.galleryPhoto.count()
  if (count >= MAX_PHOTOS) {
    return Response.json({ error: `Μπορείς να έχεις έως ${MAX_PHOTOS} φωτογραφίες.` }, { status: 400 })
  }

  const caption = typeof payload.caption === 'string' ? payload.caption.trim().slice(0, 80) || null : null
  const photo = await prisma.galleryPhoto.create({
    data: { data: parsed.bytes, type: parsed.type, caption, position: count },
    select: PHOTO_SELECT,
  })
  return Response.json(toPublic(photo), { status: 201 })
}

// Saves a new display order: { order: [id, id, ...] }.
export async function PATCH(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: { order?: unknown }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }
  if (!Array.isArray(payload.order) || !payload.order.every((id) => typeof id === 'string')) {
    return Response.json({ error: 'order must be a list of ids' }, { status: 400 })
  }

  const order = payload.order as string[]
  await prisma.$transaction(
    order.map((id, position) => prisma.galleryPhoto.updateMany({ where: { id }, data: { position } })),
  )
  return Response.json((await ordered()).map(toPublic))
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })
  await prisma.galleryPhoto.deleteMany({ where: { id } })
  return Response.json({ success: true })
}

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type ServicePayload = {
  id?: unknown
  name?: unknown
  duration?: unknown
  price?: unknown
}

function parseService(payload: ServicePayload):
  | { ok: true; data: { name: string; duration: number; price: number } }
  | { ok: false; error: string } {
  const durationNum = Number(payload.duration)
  const priceNum = Number(payload.price)

  if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    return { ok: false, error: 'Το όνομα είναι υποχρεωτικό.' }
  }
  if (!Number.isInteger(durationNum) || durationNum <= 0) {
    return { ok: false, error: 'Η διάρκεια πρέπει να είναι θετικός ακέραιος (λεπτά).' }
  }
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return { ok: false, error: 'Το κόστος πρέπει να είναι μη αρνητικός αριθμός.' }
  }
  return { ok: true, data: { name: payload.name.trim(), duration: durationNum, price: priceNum } }
}

function isDuplicateName(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

const DUPLICATE_NAME_ERROR = 'Υπάρχει ήδη υπηρεσία με αυτό το όνομα.'

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: { price: 'asc' },
    })
    return Response.json(services)
  } catch (error) {
    console.error('Failed to fetch services:', error)
    return Response.json(
      { error: 'Failed to fetch services' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: ServicePayload
  try {
    payload = (await request.json()) as ServicePayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = parseService(payload)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  try {
    const service = await prisma.service.create({ data: parsed.data })
    return Response.json(service, { status: 201 })
  } catch (error) {
    if (isDuplicateName(error)) {
      return Response.json({ error: DUPLICATE_NAME_ERROR }, { status: 409 })
    }
    console.error('Failed to create service:', error)
    return Response.json(
      { error: 'Failed to create service' },
      { status: 500 },
    )
  }
}

// Changing a service's duration or price affects new bookings only; existing
// bookings keep their stored start and end times.
export async function PATCH(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: ServicePayload
  try {
    payload = (await request.json()) as ServicePayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (typeof payload.id !== 'string' || !payload.id) {
    return Response.json({ error: 'id is required' }, { status: 400 })
  }
  const parsed = parseService(payload)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  try {
    const service = await prisma.service.update({
      where: { id: payload.id },
      data: parsed.data,
    })
    return Response.json(service)
  } catch (error) {
    if (isDuplicateName(error)) {
      return Response.json({ error: DUPLICATE_NAME_ERROR }, { status: 409 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return Response.json({ error: 'Η υπηρεσία δεν βρέθηκε.' }, { status: 404 })
    }
    console.error('Failed to update service:', error)
    return Response.json({ error: 'Failed to update service' }, { status: 500 })
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
    // booking still references this service.
    const linkedBookings = await prisma.booking.count({
      where: { serviceId: id },
    })
    if (linkedBookings > 0) {
      return Response.json(
        {
          error: `Δεν είναι δυνατή η διαγραφή: υπάρχουν ${linkedBookings} ραντεβού συνδεδεμένα με αυτή την υπηρεσία.`,
        },
        { status: 409 },
      )
    }

    await prisma.service.deleteMany({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete service:', error)
    return Response.json(
      { error: 'Failed to delete service' },
      { status: 500 },
    )
  }
}

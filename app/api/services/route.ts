import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { requireShop } from '@/lib/shops'

export const dynamic = 'force-dynamic'

type CreateServicePayload = {
  name?: unknown
  duration?: unknown
  price?: unknown
}

export async function GET(request: Request) {
  const { shop, response } = await requireShop(request)
  if (response) return response

  try {
    const services = await prisma.service.findMany({
      where: { shopId: shop.id },
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
  const { shop, response } = await requireShop(request)
  if (response) return response

  let payload: CreateServicePayload
  try {
    payload = (await request.json()) as CreateServicePayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { name, duration, price } = payload
  const durationNum = Number(duration)
  const priceNum = Number(price)

  if (typeof name !== 'string' || name.trim().length === 0) {
    return Response.json({ error: 'Το όνομα είναι υποχρεωτικό.' }, { status: 400 })
  }
  if (!Number.isInteger(durationNum) || durationNum <= 0) {
    return Response.json(
      { error: 'Η διάρκεια πρέπει να είναι θετικός ακέραιος (λεπτά).' },
      { status: 400 },
    )
  }
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return Response.json(
      { error: 'Το κόστος πρέπει να είναι μη αρνητικός αριθμός.' },
      { status: 400 },
    )
  }

  try {
    const service = await prisma.service.create({
      data: {
        shopId: shop.id,
        name: name.trim(),
        duration: durationNum,
        price: priceNum,
      },
    })
    return Response.json(service, { status: 201 })
  } catch (error) {
    console.error('Failed to create service:', error)
    return Response.json(
      { error: 'Failed to create service' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  const { shop, response } = await requireShop(request)
  if (response) return response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    // Safety: never break historic bookings. Refuse deletion while any
    // booking still references this service.
    const linkedBookings = await prisma.booking.count({
      where: { shopId: shop.id, serviceId: id },
    })
    if (linkedBookings > 0) {
      return Response.json(
        {
          error: `Δεν είναι δυνατή η διαγραφή: υπάρχουν ${linkedBookings} ραντεβού συνδεδεμένα με αυτή την υπηρεσία.`,
        },
        { status: 409 },
      )
    }

    await prisma.service.deleteMany({ where: { id, shopId: shop.id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete service:', error)
    return Response.json(
      { error: 'Failed to delete service' },
      { status: 500 },
    )
  }
}

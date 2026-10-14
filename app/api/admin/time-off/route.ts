import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { parseDateKey } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

const MAX_RANGE_DAYS = 366

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const timeOff = await prisma.timeOff.findMany({
      orderBy: [{ startDate: 'asc' }],
      select: { id: true, barberId: true, startDate: true, endDate: true, reason: true },
    })
    return Response.json(timeOff)
  } catch (error) {
    console.error('Failed to fetch time off:', error)
    return Response.json({ error: 'Failed to fetch time off' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as {
    barberId?: unknown
    startDate?: unknown
    endDate?: unknown
    reason?: unknown
  } | null

  const startDate = typeof body?.startDate === 'string' ? body.startDate : ''
  const endDate = typeof body?.endDate === 'string' ? body.endDate : ''
  const start = parseDateKey(startDate)
  const end = parseDateKey(endDate)
  if (!start || !end) {
    return Response.json({ error: 'Συμπλήρωσε έγκυρες ημερομηνίες.' }, { status: 400 })
  }
  if (endDate < startDate) {
    return Response.json({ error: 'Η λήξη πρέπει να είναι μετά την έναρξη.' }, { status: 400 })
  }
  if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    return Response.json({ error: 'Το διάστημα είναι μεγαλύτερο από έναν χρόνο.' }, { status: 400 })
  }

  const barberId = typeof body?.barberId === 'string' && body.barberId ? body.barberId : null
  const reason =
    typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 120) : null

  try {
    if (barberId) {
      const barber = await prisma.barber.findUnique({ where: { id: barberId }, select: { id: true } })
      if (!barber) return Response.json({ error: 'Ο κουρέας δεν βρέθηκε.' }, { status: 404 })
    }
    const created = await prisma.timeOff.create({
      data: { barberId, startDate, endDate, reason },
      select: { id: true, barberId: true, startDate: true, endDate: true, reason: true },
    })
    return Response.json(created, { status: 201 })
  } catch (error) {
    console.error('Failed to create time off:', error)
    return Response.json({ error: 'Failed to create time off' }, { status: 500 })
  }
}

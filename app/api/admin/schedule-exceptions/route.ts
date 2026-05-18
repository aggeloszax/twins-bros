import { prisma } from '@/lib/prisma'
import {
  getDateKeyInBookingTimeZone,
  isScheduleExceptionType,
  parseDateKey,
  scheduleExceptionDate,
} from '@/lib/schedule'

export const dynamic = 'force-dynamic'

type CreatePayload = {
  date?: unknown
  barberName?: unknown
  type?: unknown
  slotTime?: unknown
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export async function GET() {
  try {
    const exceptions = await prisma.scheduleException.findMany({
      orderBy: [{ date: 'asc' }, { slotTime: 'asc' }],
    })

    return Response.json(
      exceptions.map((exception) => ({
        id: exception.id,
        date: exception.date,
        dateKey: getDateKeyInBookingTimeZone(exception.date),
        barberName: exception.barberName,
        type: exception.type,
        slotTime: exception.slotTime,
        createdAt: exception.createdAt,
      })),
    )
  } catch (error) {
    console.error('Failed to fetch schedule exceptions:', error)
    return Response.json(
      { error: 'Failed to fetch schedule exceptions' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let payload: CreatePayload
  try {
    payload = (await request.json()) as CreatePayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { date, barberName, type, slotTime } = payload

  if (!isScheduleExceptionType(type)) {
    return Response.json(
      { error: 'type must be BLOCK_SLOT, FORCE_OPEN or FORCE_CLOSE' },
      { status: 400 },
    )
  }

  if (!isNonEmptyString(date) || !parseDateKey(date)) {
    return Response.json(
      { error: 'date must be in YYYY-MM-DD format' },
      { status: 400 },
    )
  }

  let normalizedSlotTime: string | null = null
  if (type === 'BLOCK_SLOT') {
    if (!isNonEmptyString(slotTime) || !/^\d{2}:\d{2}$/.test(slotTime)) {
      return Response.json(
        { error: 'slotTime (HH:MM) is required for BLOCK_SLOT' },
        { status: 400 },
      )
    }
    normalizedSlotTime = slotTime
  }

  const exceptionDate = scheduleExceptionDate(date)
  if (!exceptionDate) {
    return Response.json({ error: 'Invalid date' }, { status: 400 })
  }

  try {
    const created = await prisma.scheduleException.create({
      data: {
        date: exceptionDate,
        barberName: isNonEmptyString(barberName) ? barberName.trim() : null,
        type,
        slotTime: normalizedSlotTime,
      },
    })

    return Response.json(
      {
        id: created.id,
        date: created.date,
        dateKey: getDateKeyInBookingTimeZone(created.date),
        barberName: created.barberName,
        type: created.type,
        slotTime: created.slotTime,
        createdAt: created.createdAt,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create schedule exception:', error)
    return Response.json(
      { error: 'Failed to create schedule exception' },
      { status: 500 },
    )
  }
}

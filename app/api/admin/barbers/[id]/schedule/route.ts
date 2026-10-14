import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { timeToMinutes, type WorkingPeriod } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

const MAX_PERIODS = 42

function parseSchedule(value: unknown): WorkingPeriod[] | string {
  if (!Array.isArray(value)) return 'Μη έγκυρο ωράριο.'
  if (value.length > MAX_PERIODS) return 'Πάρα πολλά διαστήματα.'

  const periods: WorkingPeriod[] = []
  for (const item of value as Record<string, unknown>[]) {
    const { dayOfWeek, startTime, endTime } = item ?? {}
    if (!Number.isInteger(dayOfWeek) || (dayOfWeek as number) < 0 || (dayOfWeek as number) > 6) {
      return 'Μη έγκυρη ημέρα.'
    }
    if (typeof startTime !== 'string' || typeof endTime !== 'string') return 'Μη έγκυρη ώρα.'
    const start = timeToMinutes(startTime)
    const end = timeToMinutes(endTime)
    if (start === null || end === null) return 'Οι ώρες πρέπει να είναι της μορφής ΩΩ:ΛΛ.'
    if (start >= end) return 'Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.'
    periods.push({ dayOfWeek: dayOfWeek as number, startTime, endTime })
  }

  // Intervals of the same day must not overlap.
  for (let day = 0; day <= 6; day++) {
    const sorted = periods
      .filter((period) => period.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        return 'Τα διαστήματα μιας ημέρας επικαλύπτονται.'
      }
    }
  }
  return periods
}

// Replaces a barber's weekly schedule. `schedule: null` returns the barber to
// the default weekly hours.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const { id } = await params
  const body = (await request.json().catch(() => null)) as { schedule?: unknown } | null
  if (!body || !('schedule' in body)) {
    return Response.json({ error: 'schedule is required' }, { status: 400 })
  }

  const schedule = body.schedule === null ? null : parseSchedule(body.schedule)
  if (typeof schedule === 'string') return Response.json({ error: schedule }, { status: 400 })

  try {
    const barber = await prisma.barber.findUnique({ where: { id }, select: { id: true } })
    if (!barber) return Response.json({ error: 'Ο κουρέας δεν βρέθηκε.' }, { status: 404 })

    await prisma.$transaction([
      prisma.barberWorkingPeriod.deleteMany({ where: { barberId: id } }),
      prisma.barberWorkingPeriod.createMany({
        data: (schedule ?? []).map((period) => ({ ...period, barberId: id })),
      }),
      prisma.barber.update({ where: { id }, data: { customSchedule: schedule !== null } }),
    ])

    return Response.json({ id, schedule })
  } catch (error) {
    console.error('Failed to save barber schedule:', error)
    return Response.json({ error: 'Failed to save schedule' }, { status: 500 })
  }
}

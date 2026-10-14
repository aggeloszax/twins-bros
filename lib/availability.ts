// Server-side loading of the data that decides when a barber works.
// The rules themselves live in lib/schedule.ts so the browser can share them.

import { prisma } from '@/lib/prisma'
import {
  type BarberScheduleSource,
  type NormalizedScheduleException,
  type TimeOffRange,
  type WorkingPeriod,
  createBookingDateTime,
  normalizeScheduleExceptions,
} from '@/lib/schedule'

export const BARBER_SCHEDULE_SELECT = {
  customSchedule: true as const,
  workingPeriods: {
    select: { dayOfWeek: true as const, startTime: true as const, endTime: true as const },
    orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }],
  },
}

export function toScheduleSource(barber: {
  id: string
  customSchedule: boolean
  workingPeriods: WorkingPeriod[]
}): BarberScheduleSource {
  return { id: barber.id, schedule: barber.customSchedule ? barber.workingPeriods : null }
}

// Schedule exceptions and time off touching the days fromKey..toKey.
export async function loadScheduleRules(
  fromKey: string,
  toKey: string,
): Promise<{ exceptions: NormalizedScheduleException[]; timeOff: TimeOffRange[] }> {
  const rangeStart = createBookingDateTime(fromKey, '00:00')
  const lastDay = createBookingDateTime(toKey, '00:00')
  if (!rangeStart || !lastDay) return { exceptions: [], timeOff: [] }

  const [rawExceptions, timeOff] = await Promise.all([
    prisma.scheduleException.findMany({
      where: { date: { gte: rangeStart, lt: new Date(lastDay.getTime() + 24 * 60 * 60_000) } },
    }),
    prisma.timeOff.findMany({
      where: { startDate: { lte: toKey }, endDate: { gte: fromKey } },
      select: { barberId: true, startDate: true, endDate: true },
    }),
  ])

  return { exceptions: normalizeScheduleExceptions(rawExceptions), timeOff }
}

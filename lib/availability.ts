// Server-side loading of the data that decides when a barber works.
// The rules themselves live in lib/schedule.ts so the browser can share them.

import { prisma } from '@/lib/prisma'
import {
  type BarberScheduleSource,
  type NormalizedScheduleException,
  type TimeOffRange,
  type WorkingPeriod,
  buildSlotTimes,
  createBookingDateTime,
  getBarberPeriodsForDate,
  isSlotBlocked,
  isSlotTimeWithinPeriods,
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

export type Slot = { time: string; available: boolean }

// Bookable start times of one barber on one day, given that day's active
// bookings and the schedule rules. Manually blocked slots are left out.
export function computeBarberSlots({
  barber,
  dateKey,
  durationMinutes,
  bookings,
  exceptions,
  timeOff,
  now = new Date(),
}: {
  barber: BarberScheduleSource & { name: string }
  dateKey: string
  durationMinutes: number
  bookings: { startTime: Date; endTime: Date }[]
  exceptions: NormalizedScheduleException[]
  timeOff: TimeOffRange[]
  now?: Date
}): Slot[] {
  const periods = getBarberPeriodsForDate(barber, dateKey, exceptions, timeOff)
  const slots: Slot[] = []

  for (const time of buildSlotTimes(dateKey, periods, now)) {
    if (isSlotBlocked(exceptions, dateKey, time, barber.name)) continue
    if (!isSlotTimeWithinPeriods(time, durationMinutes, periods)) continue

    const slotStart = createBookingDateTime(dateKey, time)
    if (!slotStart) continue
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000)

    const overlaps = bookings.some(
      (booking) => slotStart < booking.endTime && slotEnd > booking.startTime,
    )
    slots.push({ time, available: !overlaps })
  }

  return slots
}

import { SLOT_MINUTES, getBarberPeriodsForDate } from '@/lib/schedule'
import {
  type Barber,
  type Booking,
  type ScheduleException,
  type TimeOff,
  bookingDateKey,
  minutesOfDay,
  minutesToTime,
  timeToMinutes,
} from '../../_lib/admin-data'

const TIME_STEP = SLOT_MINUTES
const FIRST_TIME = 7 * 60
const LAST_TIME = 22 * 60

// Every half hour of the day, for days the barber does not work.
export const ADMIN_TIME_OPTIONS = Array.from(
  { length: (LAST_TIME - FIRST_TIME) / TIME_STEP },
  (_, index) => minutesToTime(FIRST_TIME + index * TIME_STEP),
)

// Start times within the barber's working hours that day where the service
// still ends before the period does. On a day off the admin can still book by
// hand, so it falls back to the whole day.
export function workingTimeOptions(
  barber: Barber | undefined,
  dateKey: string,
  exceptions: ScheduleException[],
  timeOff: TimeOff[],
  duration: number,
) {
  if (!barber) return ADMIN_TIME_OPTIONS
  const periods = getBarberPeriodsForDate(
    barber,
    dateKey,
    exceptions.filter((item) => item.dateKey === dateKey),
    timeOff,
  )
  const options = new Set<string>()
  for (const period of periods) {
    const end = timeToMinutes(period.endTime)
    for (let m = timeToMinutes(period.startTime); m + duration <= end; m += TIME_STEP) {
      options.add(minutesToTime(m))
    }
  }
  return options.size ? [...options].sort() : ADMIN_TIME_OPTIONS
}

// Start times that would overlap another active booking of the barber that
// day, given the duration. `excludeId` skips the booking being moved.
export function takenTimes(
  bookings: Booking[],
  barberId: string,
  dateKey: string,
  duration: number,
  excludeId?: string,
) {
  const busy = bookings
    .filter(
      (b) =>
        b.id !== excludeId &&
        b.barber.id === barberId &&
        b.status !== 'CANCELLED' &&
        bookingDateKey(b) === dateKey,
    )
    .map((b) => {
      const start = minutesOfDay(b.startTime)
      return [start, start + b.service.duration] as const
    })

  const taken = new Set<string>()
  for (let m = FIRST_TIME; m < LAST_TIME; m += TIME_STEP) {
    if (busy.some(([start, end]) => m < end && m + duration > start)) {
      taken.add(minutesToTime(m))
    }
  }
  return taken
}

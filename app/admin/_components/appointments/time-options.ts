import { type Booking, bookingDateKey, minutesOfDay, minutesToTime } from '../../_lib/admin-data'

const TIME_STEP = 15
const FIRST_TIME = 7 * 60
const LAST_TIME = 22 * 60

// Every quarter hour the admin can pick when booking by hand.
export const ADMIN_TIME_OPTIONS = Array.from(
  { length: (LAST_TIME - FIRST_TIME) / TIME_STEP },
  (_, index) => minutesToTime(FIRST_TIME + index * TIME_STEP),
)

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

export const OPEN_HOUR = 9
export const CLOSE_HOUR = 21
export const SLOT_MINUTES = 30
export const BOOKING_WINDOW_DAYS = 28

export type Slot = { time: string; available: boolean }

export function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateKey(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null

  const date = new Date(`${key}T00:00:00`)
  if (Number.isNaN(date.getTime()) || toDateKey(date) !== key) return null

  return date
}

export function isClosedDay(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 1
}

export function buildBookingDates(today = new Date()) {
  const base = new Date(today)
  base.setHours(0, 0, 0, 0)

  return Array.from({ length: BOOKING_WINDOW_DAYS + 1 }, (_, i) => {
    const date = new Date(base)
    date.setDate(base.getDate() + i)
    return date
  }).filter((date) => !isClosedDay(date))
}

export function isWithinBookingWindow(date: Date, today = new Date()) {
  const windowStart = new Date(today)
  windowStart.setHours(0, 0, 0, 0)

  const windowEnd = new Date(windowStart)
  windowEnd.setDate(windowStart.getDate() + BOOKING_WINDOW_DAYS + 1)

  return date >= windowStart && date < windowEnd
}

export function buildSlotTimes(dateKey: string, now = new Date()) {
  const slots: string[] = []

  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      const slotStart = new Date(`${dateKey}T${time}:00`)

      if (slotStart.getTime() > now.getTime()) {
        slots.push(time)
      }
    }
  }

  return slots
}

export function isSlotWithinWorkingHours(startTime: Date, durationMinutes: number) {
  const dayStart = new Date(startTime)
  dayStart.setHours(OPEN_HOUR, 0, 0, 0)

  const dayEnd = new Date(startTime)
  dayEnd.setHours(CLOSE_HOUR, 0, 0, 0)

  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000)

  return startTime >= dayStart && endTime <= dayEnd
}

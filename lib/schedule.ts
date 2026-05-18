export const OPEN_HOUR = 9
export const CLOSE_HOUR = 21
export const SLOT_MINUTES = 30
export const BOOKING_WINDOW_DAYS = 28
export const BOOKING_TIME_ZONE = 'Europe/Athens'
export const BOOKING_LOCALE = 'el-GR'

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

function parseDateKeyParts(key: string) {
  const date = parseDateKey(key)
  if (!date) return null

  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

function parseTimeParts(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return null

  const [hour, minute] = time.split(':').map(Number)
  if (hour > 23 || minute > 59) return null

  return { hour, minute }
}

function getTimeZoneOffsetMs(date: Date, timeZone = BOOKING_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )

  const zonedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  )

  return zonedAsUtc - date.getTime()
}

export function createBookingDateTime(dateKey: string, time: string) {
  const dateParts = parseDateKeyParts(dateKey)
  const timeParts = parseTimeParts(time)
  if (!dateParts || !timeParts) return null

  const wallTimeAsUtc = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
  )
  const firstPass = new Date(
    wallTimeAsUtc - getTimeZoneOffsetMs(new Date(wallTimeAsUtc)),
  )

  return new Date(wallTimeAsUtc - getTimeZoneOffsetMs(firstPass))
}

export function getDateKeyInBookingTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

export function isSlotTimeWithinWorkingHours(
  time: string,
  durationMinutes: number,
) {
  const timeParts = parseTimeParts(time)
  if (!timeParts) return false

  const startMinutes = timeParts.hour * 60 + timeParts.minute
  const endMinutes = startMinutes + durationMinutes

  return startMinutes >= OPEN_HOUR * 60 && endMinutes <= CLOSE_HOUR * 60
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
      const slotStart = createBookingDateTime(dateKey, time)

      if (slotStart && slotStart.getTime() > now.getTime()) {
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

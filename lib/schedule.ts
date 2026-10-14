export const OPEN_HOUR = 9
export const CLOSE_HOUR = 21
export const SLOT_MINUTES = 30

// Booking with no preferred barber: the server assigns a free one.
export const ANY_BARBER = 'any'

export const BOOKING_WINDOW_DAYS = 28
export const BOOKING_TIME_ZONE = 'Europe/Athens'
export const BOOKING_LOCALE = 'el-GR'

// A booking can be self-cancelled up to 2.5 hours (150 minutes) before it starts.
export const CANCELLATION_WINDOW_MINUTES = 150

export function getCancellationLeadMinutes(startTime: Date, now = new Date()) {
  return (startTime.getTime() - now.getTime()) / 60_000
}

export function canCancelBooking(startTime: Date, now = new Date()) {
  return (
    getCancellationLeadMinutes(startTime, now) >= CANCELLATION_WINDOW_MINUTES
  )
}

export type Slot = { time: string; available: boolean }
export type WorkingPeriod = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

// Default weekly hours for barbers without their own schedule: Tuesday to
// Saturday, 09:00-21:00 (JavaScript dayOfWeek: Sunday=0).
export const WORKING_PERIODS: WorkingPeriod[] = [2, 3, 4, 5, 6].map(
  (dayOfWeek) => ({
    dayOfWeek,
    startTime: `${String(OPEN_HOUR).padStart(2, '0')}:00`,
    endTime: `${String(CLOSE_HOUR).padStart(2, '0')}:00`,
  }),
)

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

export function timeToMinutes(time: string) {
  const parts = parseTimeParts(time)
  return parts ? parts.hour * 60 + parts.minute : null
}

export function minutesToTime(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
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

// True when [time, time + duration) fits inside one of the periods.
export function isSlotTimeWithinPeriods(
  time: string,
  durationMinutes: number,
  periods: WorkingPeriod[],
) {
  const startMinutes = timeToMinutes(time)
  if (startMinutes === null) return false
  const endMinutes = startMinutes + durationMinutes

  return periods.some((period) => {
    const periodStart = timeToMinutes(period.startTime)
    const periodEnd = timeToMinutes(period.endTime)
    if (periodStart === null || periodEnd === null) return false
    return startMinutes >= periodStart && endMinutes <= periodEnd
  })
}

export function isWithinBookingWindow(date: Date, today = new Date()) {
  const windowStart = new Date(today)
  windowStart.setHours(0, 0, 0, 0)

  const windowEnd = new Date(windowStart)
  windowEnd.setDate(windowStart.getDate() + BOOKING_WINDOW_DAYS + 1)

  return date >= windowStart && date < windowEnd
}

// Start times every SLOT_MINUTES inside the periods, skipping times already
// in the past.
export function buildSlotTimes(
  dateKey: string,
  periods: WorkingPeriod[],
  now = new Date(),
) {
  const slots: string[] = []
  if (!parseDateKey(dateKey)) return slots

  for (const period of periods) {
    const periodStart = timeToMinutes(period.startTime)
    const periodEnd = timeToMinutes(period.endTime)
    if (periodStart === null || periodEnd === null) continue

    for (
      let minutes = periodStart;
      minutes + SLOT_MINUTES <= periodEnd;
      minutes += SLOT_MINUTES
    ) {
      const time = minutesToTime(minutes)
      const slotStart = createBookingDateTime(dateKey, time)

      if (slotStart && slotStart.getTime() > now.getTime()) {
        slots.push(time)
      }
    }
  }

  return slots
}

/* -------------------------------------------------------------------------- */
/*  Schedule exceptions (manual overrides)                                     */
/* -------------------------------------------------------------------------- */

export const SCHEDULE_EXCEPTION_TYPES = [
  'BLOCK_SLOT',
  'FORCE_OPEN',
  'FORCE_CLOSE',
] as const

export type ScheduleExceptionType = (typeof SCHEDULE_EXCEPTION_TYPES)[number]

export function isScheduleExceptionType(
  value: unknown,
): value is ScheduleExceptionType {
  return (
    typeof value === 'string' &&
    (SCHEDULE_EXCEPTION_TYPES as readonly string[]).includes(value)
  )
}

export type RawScheduleException = {
  id?: string
  date: string | Date
  barberName: string | null
  type: string
  slotTime: string | null
}

export type NormalizedScheduleException = {
  id?: string
  dateKey: string
  barberName: string | null
  type: ScheduleExceptionType
  slotTime: string | null
}

// Stores the affected day as an Athens-midnight instant so it round-trips
// consistently regardless of where the server runs.
export function scheduleExceptionDate(dateKey: string) {
  return createBookingDateTime(dateKey, '00:00')
}

export function normalizeScheduleException(
  raw: RawScheduleException,
): NormalizedScheduleException | null {
  if (!isScheduleExceptionType(raw.type)) return null

  return {
    id: raw.id,
    dateKey: getDateKeyInBookingTimeZone(new Date(raw.date)),
    barberName: raw.barberName ?? null,
    type: raw.type,
    slotTime: raw.slotTime ?? null,
  }
}

export function normalizeScheduleExceptions(
  raws: RawScheduleException[],
): NormalizedScheduleException[] {
  return raws.flatMap((raw) => {
    const normalized = normalizeScheduleException(raw)
    return normalized ? [normalized] : []
  })
}

export function isDateForceClosed(
  exceptions: NormalizedScheduleException[],
  dateKey: string,
) {
  return exceptions.some(
    (exception) =>
      exception.type === 'FORCE_CLOSE' && exception.dateKey === dateKey,
  )
}

export function isDateForceOpen(
  exceptions: NormalizedScheduleException[],
  dateKey: string,
) {
  return exceptions.some(
    (exception) =>
      exception.type === 'FORCE_OPEN' && exception.dateKey === dateKey,
  )
}

/* -------------------------------------------------------------------------- */
/*  Per-barber working hours                                                  */
/* -------------------------------------------------------------------------- */

// A day range (inclusive, YYYY-MM-DD) when a barber, or the whole shop when
// barberId is null, does not work.
export type TimeOffRange = {
  barberId: string | null
  startDate: string
  endDate: string
}

// A barber's weekly schedule; null means the default WORKING_PERIODS.
export type BarberScheduleSource = {
  id: string
  schedule: WorkingPeriod[] | null
}

// Hours used on a FORCE_OPEN day for a barber who normally does not work then.
const FORCE_OPEN_START = `${String(OPEN_HOUR).padStart(2, '0')}:00`
const FORCE_OPEN_END = `${String(CLOSE_HOUR).padStart(2, '0')}:00`

export function isOnTimeOff(barberId: string, dateKey: string, timeOff: TimeOffRange[]) {
  return timeOff.some(
    (range) =>
      (range.barberId === null || range.barberId === barberId) &&
      dateKey >= range.startDate &&
      dateKey <= range.endDate,
  )
}

// The single source of truth for when a barber works on a given day:
// FORCE_CLOSE and time off close the day, the barber's weekly schedule sets
// the hours, and FORCE_OPEN opens a day the barber normally has off.
export function getBarberPeriodsForDate(
  barber: BarberScheduleSource,
  dateKey: string,
  exceptions: NormalizedScheduleException[],
  timeOff: TimeOffRange[],
): WorkingPeriod[] {
  const date = parseDateKey(dateKey)
  if (!date) return []
  if (isDateForceClosed(exceptions, dateKey)) return []
  if (isOnTimeOff(barber.id, dateKey, timeOff)) return []

  const dayOfWeek = date.getDay()
  const weekly = (barber.schedule ?? WORKING_PERIODS)
    .filter((period) => period.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  if (weekly.length === 0 && isDateForceOpen(exceptions, dateKey)) {
    return [{ dayOfWeek, startTime: FORCE_OPEN_START, endTime: FORCE_OPEN_END }]
  }
  return weekly
}

// Whether customers can pick this day for the barber in the booking form.
export function isDayBookable(
  date: Date,
  periods: WorkingPeriod[],
  today = new Date(),
) {
  return isWithinBookingWindow(date, today) && periods.length > 0
}

// A slot is blocked when a BLOCK_SLOT exception matches the date + time and
// either targets the whole shop (barberName === null) or this specific barber.
export function isSlotBlocked(
  exceptions: NormalizedScheduleException[],
  dateKey: string,
  time: string,
  barberName: string | null,
) {
  return exceptions.some(
    (exception) =>
      exception.type === 'BLOCK_SLOT' &&
      exception.dateKey === dateKey &&
      exception.slotTime === time &&
      (exception.barberName === null ||
        exception.barberName === barberName),
  )
}

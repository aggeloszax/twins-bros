export const OPEN_HOUR = 9
export const CLOSE_HOUR = 21
export const SLOT_MINUTES = 30
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

const DEFAULT_WORKING_PERIODS: WorkingPeriod[] = [2, 3, 4, 5, 6].map(
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

function timeToMinutes(time: string) {
  const parts = parseTimeParts(time)
  return parts ? parts.hour * 60 + parts.minute : null
}

function minutesToTime(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function normalizeWorkingPeriods(periods?: WorkingPeriod[] | null) {
  return periods?.length ? periods : DEFAULT_WORKING_PERIODS
}

export function getWorkingPeriodsForDate(
  date: Date,
  periods?: WorkingPeriod[] | null,
) {
  const dayOfWeek = date.getDay()
  return normalizeWorkingPeriods(periods)
    .filter((period) => period.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
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
  periods?: WorkingPeriod[] | null,
  date?: Date,
) {
  const startMinutes = timeToMinutes(time)
  if (startMinutes === null) return false
  const endMinutes = startMinutes + durationMinutes

  const relevantPeriods = date
    ? getWorkingPeriodsForDate(date, periods)
    : normalizeWorkingPeriods(periods)

  return relevantPeriods.some((period) => {
    const periodStart = timeToMinutes(period.startTime)
    const periodEnd = timeToMinutes(period.endTime)
    if (periodStart === null || periodEnd === null) return false
    return startMinutes >= periodStart && endMinutes <= periodEnd
  })
}

export function isClosedDay(date: Date, periods?: WorkingPeriod[] | null) {
  return getWorkingPeriodsForDate(date, periods).length === 0
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

export function buildSlotTimes(
  dateKey: string,
  now = new Date(),
  periods?: WorkingPeriod[] | null,
) {
  const slots: string[] = []
  const date = parseDateKey(dateKey)
  if (!date) return slots

  for (const period of getWorkingPeriodsForDate(date, periods)) {
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

export function isSlotWithinWorkingHours(startTime: Date, durationMinutes: number) {
  const dayStart = new Date(startTime)
  dayStart.setHours(OPEN_HOUR, 0, 0, 0)

  const dayEnd = new Date(startTime)
  dayEnd.setHours(CLOSE_HOUR, 0, 0, 0)

  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000)

  return startTime >= dayStart && endTime <= dayEnd
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

// Resolve whether a calendar day accepts bookings, accounting for manual
// overrides. FORCE_CLOSE always wins; FORCE_OPEN re-opens an otherwise closed
// weekday (e.g. a Monday).
export function isDayBookable(
  date: Date,
  dateKey: string,
  exceptions: NormalizedScheduleException[],
  today = new Date(),
  periods?: WorkingPeriod[] | null,
) {
  if (!isWithinBookingWindow(date, today)) return false
  if (isDateForceClosed(exceptions, dateKey)) return false
  if (isDateForceOpen(exceptions, dateKey)) return true
  return !isClosedDay(date, periods)
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

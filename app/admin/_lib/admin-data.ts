import {
  BOOKING_LOCALE,
  BOOKING_TIME_ZONE,
  getDateKeyInBookingTimeZone,
} from '@/lib/schedule'

export type BookingStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

export type Booking = {
  id: string
  startTime: string
  endTime: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  barber: { id: string; name: string }
  service: { id: string; name: string; price: number; duration: number }
  status: BookingStatus
  noShow: boolean
  noShowCount: number
}

export type Barber = { id: string; name: string; image: string | null }
export type Service = { id: string; name: string; price: number; duration: number }

export type ExceptionType = 'BLOCK_SLOT' | 'FORCE_OPEN' | 'FORCE_CLOSE'
export type ScheduleException = {
  id: string
  date: string
  dateKey: string
  barberName: string | null
  type: ExceptionType
  slotTime: string | null
}

// What the admin sees for a booking, derived from status, no-show and time.
export type BookingState = 'upcoming' | 'completed' | 'noShow' | 'cancelled'

export function getBookingState(booking: Booking, now = new Date()): BookingState {
  if (booking.status === 'CANCELLED') return 'cancelled'
  if (booking.noShow) return 'noShow'
  if (booking.status === 'COMPLETED') return 'completed'
  return new Date(booking.endTime) <= now ? 'completed' : 'upcoming'
}

export const BOOKING_STATE_LABELS: Record<BookingState, string> = {
  upcoming: 'Επιβεβαιωμένο',
  completed: 'Ολοκληρώθηκε',
  noShow: 'Δεν ήρθε',
  cancelled: 'Ακυρώθηκε',
}

// Revenue counts bookings that were (or will be) served: not cancelled and
// not marked as no-show.
export function isBillable(booking: Booking) {
  return booking.status !== 'CANCELLED' && !booking.noShow
}

/* --------------------------------- Format -------------------------------- */

export function formatPrice(price: number) {
  const value = Number.isFinite(price) ? price : 0
  return `${value.toLocaleString(BOOKING_LOCALE, { maximumFractionDigits: 2 })}€`
}

// "+306912345678" -> "691 234 5678"; other numbers are shown as stored.
export function formatPhone(phone: string) {
  const national = phone.replace(/^\+30/, '')
  return /^\d{10}$/.test(national)
    ? `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
    : phone
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDateKeyLong(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(BOOKING_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function bookingDateKey(booking: Pick<Booking, 'startTime'>) {
  return getDateKeyInBookingTimeZone(new Date(booking.startTime))
}

export function todayKey() {
  return getDateKeyInBookingTimeZone(new Date())
}

// Minutes since midnight in the booking time zone, e.g. "10:30" -> 630.
export function minutesOfDay(iso: string) {
  const [hour, minute] = formatTime(iso).split(':').map(Number)
  return hour * 60 + minute
}

export function minutesToTime(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function timeToMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

/* ---------------------------------- Dates --------------------------------- */

export function addDaysToKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`)
}

// Monday-first 6-week grid covering the month that contains `monthKey`.
export function buildMonthGrid(monthKey: string) {
  const first = new Date(`${monthKey.slice(0, 7)}-01T12:00:00`)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return localDateKey(day)
  })
}

export function monthTitle(monthKey: string) {
  return new Date(`${monthKey.slice(0, 7)}-01T12:00:00`).toLocaleDateString(
    BOOKING_LOCALE,
    { month: 'long', year: 'numeric' },
  )
}

export function shiftMonth(monthKey: string, months: number) {
  const date = new Date(`${monthKey.slice(0, 7)}-01T12:00:00`)
  date.setMonth(date.getMonth() + months)
  return localDateKey(date)
}

/* ----------------------------------- API ---------------------------------- */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

// JSON fetch for admin endpoints. A 401 means the session expired, so the
// browser is sent back to the login page.
export async function adminFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...init.headers }
      : init?.headers,
  })

  if (res.status === 401) {
    window.location.assign('/admin/login')
    throw new ApiError('Η σύνδεση έληξε.', 401)
  }

  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Κάτι πήγε στραβά. Δοκίμασε ξανά.', res.status)
  }
  return data as T
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.'
}

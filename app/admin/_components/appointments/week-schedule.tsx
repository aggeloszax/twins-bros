'use client'

import { getBarberPeriodsForDate } from '@/lib/schedule'
import {
  type Barber,
  type Booking,
  type ScheduleException,
  type TimeOff,
  BOOKING_STATE_LABELS,
  addDaysToKey,
  bookingDateKey,
  dateFromKey,
  formatTime,
  getBookingState,
  minutesOfDay,
  minutesToTime,
  timeToMinutes,
  todayKey,
} from '../../_lib/admin-data'
import { layoutColumn } from './day-schedule'

const PX_PER_MINUTE = 1.1
const DEFAULT_OPEN = 9 * 60
const DEFAULT_CLOSE = 21 * 60

// One colour per barber, in the order the barbers are listed.
const BARBER_COLORS = [
  { bg: '#fbe9ec', border: '#a3203a' },
  { bg: '#e7f0fa', border: '#2f6db5' },
  { bg: '#e8f5ea', border: '#2f8a4c' },
  { bg: '#fcf0de', border: '#c0791b' },
  { bg: '#efe9fb', border: '#6b4bb8' },
  { bg: '#e3f4f4', border: '#24838a' },
]

// Monday of the week that contains dateKey.
export function weekStartKey(dateKey: string) {
  const weekday = (dateFromKey(dateKey).getDay() + 6) % 7
  return addDaysToKey(dateKey, -weekday)
}

export function WeekSchedule({
  dateKey,
  barbers,
  bookings,
  exceptions,
  timeOff,
  onDayClick,
  onSlotClick,
  onBookingClick,
}: {
  dateKey: string
  barbers: Barber[]
  bookings: Booking[]
  exceptions: ScheduleException[]
  timeOff: TimeOff[]
  onDayClick: (dateKey: string) => void
  onSlotClick: (dateKey: string, time: string) => void
  onBookingClick: (booking: Booking) => void
}) {
  const start = weekStartKey(dateKey)
  const days = Array.from({ length: 7 }, (_, index) => addDaysToKey(start, index))
  const today = todayKey()
  const colorOf = new Map(barbers.map((barber, index) => [barber.id, BARBER_COLORS[index % BARBER_COLORS.length]]))
  const visibleIds = new Set(barbers.map((barber) => barber.id))

  const byDay = new Map(
    days.map((day) => [
      day,
      bookings.filter((booking) => bookingDateKey(booking) === day && visibleIds.has(booking.barber.id)),
    ]),
  )
  const openByDay = new Map(
    days.map((day) => [
      day,
      barbers.flatMap((barber) =>
        getBarberPeriodsForDate(barber, day, exceptions, timeOff).map(
          (period) => [timeToMinutes(period.startTime), timeToMinutes(period.endTime)] as const,
        ),
      ),
    ]),
  )

  const allRanges = [...openByDay.values()].flat()
  let firstMinute = allRanges.length ? Math.min(...allRanges.map((range) => range[0])) : DEFAULT_OPEN
  let lastMinute = allRanges.length ? Math.max(...allRanges.map((range) => range[1])) : DEFAULT_CLOSE
  for (const list of byDay.values()) {
    for (const booking of list) {
      const bookingStart = minutesOfDay(booking.startTime)
      firstMinute = Math.min(firstMinute, bookingStart)
      lastMinute = Math.max(lastMinute, bookingStart + booking.service.duration)
    }
  }
  const rangeStart = Math.floor(firstMinute / 60) * 60
  const rangeEnd = Math.ceil(lastMinute / 60) * 60
  const height = (rangeEnd - rangeStart) * PX_PER_MINUTE
  const hours = Array.from({ length: (rangeEnd - rangeStart) / 60 }, (_, index) => rangeStart + index * 60)

  return (
    <div>
      {barbers.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[var(--admin-border)] px-4 py-2.5 text-xs text-[var(--admin-muted)]">
          {barbers.map((barber) => (
            <span key={barber.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf.get(barber.id)?.border }} />
              {barber.name}
            </span>
          ))}
        </div>
      )}

      <div className="max-h-[calc(100vh-250px)] min-h-[420px] overflow-auto">
        <div className="grid min-w-[760px]" style={{ gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}>
          <div className="sticky top-0 z-20 border-b border-[var(--admin-border)] bg-white" />
          {days.map((day) => {
            const date = dateFromKey(day)
            const count = (byDay.get(day) ?? []).filter((booking) => booking.status !== 'CANCELLED').length
            const selected = day === dateKey
            return (
              <button
                key={day}
                type="button"
                onClick={() => onDayClick(day)}
                title="Άνοιγμα ημέρας"
                className={`sticky top-0 z-20 border-b border-l border-[var(--admin-border)] bg-white px-2 py-2 text-center transition-colors hover:bg-[var(--admin-surface-2)] ${
                  selected ? 'shadow-[inset_0_-2px_0_var(--admin-accent)]' : ''
                }`}
              >
                <span className="block text-[11px] uppercase text-[var(--admin-muted)]">
                  {date.toLocaleDateString('el-GR', { weekday: 'short' })}
                </span>
                <span
                  className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    day === today ? 'bg-[var(--admin-accent)] text-white' : ''
                  }`}
                >
                  {date.getDate()}
                </span>
                <span className="block text-[11px] text-[var(--admin-muted)]">
                  {count === 1 ? '1 ραντεβού' : `${count} ραντεβού`}
                </span>
              </button>
            )
          })}

          <div className="relative" style={{ height }}>
            {hours.map((minute) => (
              <div
                key={minute}
                className={`absolute right-1.5 text-[11px] tabular-nums text-[var(--admin-muted)] ${
                  minute === rangeStart ? 'translate-y-1' : '-translate-y-1/2'
                }`}
                style={{ top: (minute - rangeStart) * PX_PER_MINUTE }}
              >
                {minutesToTime(minute)}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const open = openByDay.get(day) ?? []
            const positioned = layoutColumn(byDay.get(day) ?? [])
            return (
              <div
                key={day}
                className={`relative border-l border-[var(--admin-border)] ${
                  open.length === 0
                    ? 'bg-[repeating-linear-gradient(135deg,#f6f1ea_0,#f6f1ea_6px,#f1ebe2_6px,#f1ebe2_12px)]'
                    : 'bg-white'
                }`}
                style={{ height }}
              >
                {hours.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => onSlotClick(day, minutesToTime(minute))}
                    aria-label={`Νέο ραντεβού ${day} στις ${minutesToTime(minute)}`}
                    className="absolute inset-x-0 border-t border-[var(--admin-border)] hover:bg-[var(--admin-accent-soft)]/50"
                    style={{ top: (minute - rangeStart) * PX_PER_MINUTE, height: 60 * PX_PER_MINUTE }}
                  />
                ))}

                {positioned.map(({ booking, lane, lanes }) => {
                  const state = getBookingState(booking)
                  const color = colorOf.get(booking.barber.id) ?? BARBER_COLORS[0]
                  const blockHeight = Math.max(booking.service.duration * PX_PER_MINUTE - 2, 18)
                  const cancelled = state === 'cancelled'
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onBookingClick(booking)}
                      title={`${formatTime(booking.startTime)} ${booking.customerName}, ${booking.service.name}, ${booking.barber.name} (${BOOKING_STATE_LABELS[state]})`}
                      className={`absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-[0_1px_2px_rgba(60,40,20,0.08)] hover:brightness-[0.97] ${
                        cancelled ? 'line-through opacity-50' : ''
                      }`}
                      style={{
                        top: (minutesOfDay(booking.startTime) - rangeStart) * PX_PER_MINUTE + 1,
                        height: blockHeight,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                        backgroundColor: color.bg,
                        borderLeftColor: color.border,
                        zIndex: cancelled ? 1 : 2,
                      }}
                    >
                      <span className="font-semibold tabular-nums">{formatTime(booking.startTime)}</span>{' '}
                      <span className="truncate">{booking.customerName}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

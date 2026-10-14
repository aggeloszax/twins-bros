'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getBarberPeriodsForDate, isOnTimeOff } from '@/lib/schedule'
import {
  type Barber,
  type Booking,
  type BookingState,
  type ScheduleException,
  type TimeOff,
  formatTime,
  getBookingState,
  minutesOfDay,
  minutesToTime,
  timeToMinutes,
  todayKey,
} from '../../_lib/admin-data'
import { AlertIcon, Avatar, BanIcon, NoteIcon } from '../ui'

const PX_PER_MINUTE = 1.8
const CELL_MINUTES = 15
const COLUMN_MIN_WIDTH = 190
const DEFAULT_OPEN = 9 * 60
const DEFAULT_CLOSE = 21 * 60

const BLOCK_STYLES: Record<BookingState, string> = {
  upcoming:
    'border-l-[var(--admin-accent)] bg-[var(--admin-accent-soft)] text-[var(--admin-text)] hover:brightness-[0.98]',
  completed: 'border-l-emerald-600 bg-emerald-50 text-emerald-950 hover:bg-emerald-100/70',
  noShow: 'border-l-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100/70',
  cancelled:
    'border-l-stone-300 bg-stone-50 text-stone-400 line-through decoration-stone-300 hover:bg-stone-100',
}

type PositionedBooking = { booking: Booking; lane: number; lanes: number }

// Splits overlapping bookings of one barber into side-by-side lanes.
function layoutColumn(bookings: Booking[]): PositionedBooking[] {
  const sorted = [...bookings].sort(
    (a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime),
  )
  const result: PositionedBooking[] = []
  let cluster: PositionedBooking[] = []
  let clusterEnd = -1
  let laneEnds: number[] = []

  const closeCluster = () => {
    const lanes = Math.max(1, laneEnds.length)
    for (const item of cluster) item.lanes = lanes
    result.push(...cluster)
    cluster = []
    laneEnds = []
  }

  for (const booking of sorted) {
    const start = minutesOfDay(booking.startTime)
    const end = start + booking.service.duration
    if (cluster.length && start >= clusterEnd) closeCluster()

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    cluster.push({ booking, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, end)
  }
  closeCluster()
  return result
}

function useNowMinutes() {
  const [now, setNow] = useState(() => minutesOfDay(new Date().toISOString()))
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(minutesOfDay(new Date().toISOString())),
      60_000,
    )
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export function DaySchedule({
  dateKey,
  barbers,
  bookings,
  exceptions,
  timeOff,
  onSlotClick,
  onBookingClick,
}: {
  dateKey: string
  barbers: Barber[]
  bookings: Booking[]
  exceptions: ScheduleException[]
  timeOff: TimeOff[]
  onSlotClick: (barber: Barber, time: string) => void
  onBookingClick: (booking: Booking) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const nowMinutes = useNowMinutes()
  const isToday = dateKey === todayKey()

  const dayExceptions = exceptions.filter((item) => item.dateKey === dateKey)
  const forceClosed = dayExceptions.some((item) => item.type === 'FORCE_CLOSE')
  const shopTimeOff = timeOff.find(
    (range) => range.barberId === null && dateKey >= range.startDate && dateKey <= range.endDate,
  )

  // Each barber's working hours that day, as minute ranges.
  const openRangesByBarber = new Map(
    barbers.map((barber) => [
      barber.id,
      getBarberPeriodsForDate(barber, dateKey, dayExceptions, timeOff).map(
        (p) => [timeToMinutes(p.startTime), timeToMinutes(p.endTime)] as const,
      ),
    ]),
  )
  const allRanges = [...openRangesByBarber.values()].flat()
  const closed = allRanges.length === 0

  // Visible hours: everyone's working hours, widened to fit any booking.
  let firstMinute = allRanges.length ? Math.min(...allRanges.map((r) => r[0])) : DEFAULT_OPEN
  let lastMinute = allRanges.length ? Math.max(...allRanges.map((r) => r[1])) : DEFAULT_CLOSE
  for (const booking of bookings) {
    const bookingStart = minutesOfDay(booking.startTime)
    firstMinute = Math.min(firstMinute, bookingStart)
    lastMinute = Math.max(lastMinute, bookingStart + booking.service.duration)
  }
  const rangeStart = Math.floor(firstMinute / 60) * 60
  const rangeEnd = Math.ceil(lastMinute / 60) * 60

  const cellTimes = useMemo(() => {
    const times: number[] = []
    for (let m = rangeStart; m < rangeEnd; m += CELL_MINUTES) times.push(m)
    return times
  }, [rangeStart, rangeEnd])

  const isOpenAt = (barberId: string, minute: number) =>
    (openRangesByBarber.get(barberId) ?? []).some(([start, end]) => minute >= start && minute < end)

  const blockedFor = (barber: Barber) =>
    dayExceptions.filter(
      (item) =>
        item.type === 'BLOCK_SLOT' &&
        item.slotTime &&
        (item.barberName === null || item.barberName === barber.name),
    )

  const height = (rangeEnd - rangeStart) * PX_PER_MINUTE
  const showNowLine = isToday && nowMinutes >= rangeStart && nowMinutes <= rangeEnd

  // Bring the current time (or the opening hour) into view on each new day.
  useEffect(() => {
    const target = isToday ? nowMinutes - 60 : firstMinute
    scrollRef.current?.scrollTo({ top: Math.max(0, (target - rangeStart) * PX_PER_MINUTE) })
    // Only on day change; ignore minute ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey])

  if (barbers.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--admin-muted)]">
        Πρόσθεσε κουρείς για να δεις το πρόγραμμα.
      </div>
    )
  }

  return (
    <div>
      {closed && (
        <div className="border-b border-[var(--admin-border)] bg-[#f3ede4] px-4 py-2 text-center text-[13px] text-[var(--admin-muted)]">
          {forceClosed
            ? 'Το μαγαζί είναι κλειστό αυτή την ημέρα (εξαίρεση ωραρίου).'
            : shopTimeOff
              ? `Το μαγαζί είναι κλειστό${shopTimeOff.reason ? `: ${shopTimeOff.reason}` : '.'}`
              : 'Κανείς δεν δουλεύει αυτή την ημέρα. Μπορείς να καταχωρήσεις ραντεβού χειροκίνητα.'}
        </div>
      )}

      <div ref={scrollRef} className="max-h-[calc(100vh-250px)] min-h-[420px] overflow-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `56px repeat(${barbers.length}, minmax(${COLUMN_MIN_WIDTH}px, 1fr))`,
          }}
        >
          {/* Header row */}
          <div className="sticky left-0 top-0 z-30 border-b border-[var(--admin-border)] bg-white" />
          {barbers.map((barber) => {
            const count = bookings.filter(
              (b) => b.barber.id === barber.id && b.status !== 'CANCELLED',
            ).length
            const off = (openRangesByBarber.get(barber.id) ?? []).length === 0
            const onLeave = isOnTimeOff(barber.id, dateKey, timeOff)
            return (
              <div
                key={barber.id}
                className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-l border-[var(--admin-border)] bg-white px-3 py-2.5"
              >
                <Avatar name={barber.name} image={barber.image} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{barber.name}</p>
                  <p className="text-xs text-[var(--admin-muted)]">
                    {off && !closed ? (onLeave ? 'Άδεια · ' : 'Ρεπό · ') : ''}
                    {count === 1 ? '1 ραντεβού' : `${count} ραντεβού`}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Time axis */}
          <div className="sticky left-0 z-10 bg-white" style={{ height }}>
            {cellTimes
              .filter((minute) => minute % 60 === 0)
              .map((minute) => (
                <div
                  key={minute}
                  className={`absolute right-2 text-[11px] tabular-nums text-[var(--admin-muted)] ${
                    minute === rangeStart ? 'translate-y-1' : '-translate-y-1/2'
                  }`}
                  style={{ top: (minute - rangeStart) * PX_PER_MINUTE }}
                >
                  {minutesToTime(minute)}
                </div>
              ))}
          </div>

          {/* Barber columns */}
          {barbers.map((barber) => {
            const positioned = layoutColumn(bookings.filter((b) => b.barber.id === barber.id))
            return (
              <div
                key={barber.id}
                className="relative border-l border-[var(--admin-border)]"
                style={{ height }}
              >
                {cellTimes.map((minute) => {
                  const open = isOpenAt(barber.id, minute)
                  return (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => onSlotClick(barber, minutesToTime(minute))}
                      aria-label={`Νέο ραντεβού με ${barber.name} στις ${minutesToTime(minute)}`}
                      className={`group absolute inset-x-0 flex items-start px-2 pt-0.5 text-left ${
                        minute % 60 === 0
                          ? 'border-t border-[var(--admin-border)]'
                          : minute % 30 === 0
                            ? 'border-t border-dashed border-[#efe7dc]'
                            : ''
                      } ${open ? 'bg-white hover:bg-[var(--admin-accent-soft)]/60' : 'bg-[repeating-linear-gradient(135deg,#f6f1ea_0,#f6f1ea_6px,#f1ebe2_6px,#f1ebe2_12px)] hover:bg-[#efe7dc]'}`}
                      style={{
                        top: (minute - rangeStart) * PX_PER_MINUTE,
                        height: CELL_MINUTES * PX_PER_MINUTE,
                      }}
                    >
                      <span className="hidden text-[11px] font-medium text-[var(--admin-accent)] group-hover:inline">
                        + {minutesToTime(minute)}
                      </span>
                    </button>
                  )
                })}

                {blockedFor(barber).map((item) => {
                  const start = timeToMinutes(item.slotTime as string)
                  return (
                    <div
                      key={item.id}
                      className="pointer-events-none absolute inset-x-1 flex items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-100/90 text-[11px] font-medium text-stone-500"
                      style={{
                        top: (start - rangeStart) * PX_PER_MINUTE + 1,
                        height: 30 * PX_PER_MINUTE - 2,
                      }}
                    >
                      Μπλοκαρισμένη ώρα
                    </div>
                  )
                })}

                {positioned.map(({ booking, lane, lanes }) => {
                  const start = minutesOfDay(booking.startTime)
                  const blockHeight = Math.max(booking.service.duration * PX_PER_MINUTE - 2, 22)
                  const state = getBookingState(booking)
                  const compact = blockHeight < 44
                  const warn = state === 'upcoming' && booking.noShowCount > 0
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onBookingClick(booking)}
                      className={`absolute overflow-hidden rounded-lg border border-l-[3px] border-black/[0.04] px-2 py-1 text-left shadow-[0_1px_2px_rgba(60,40,20,0.08)] transition ${BLOCK_STYLES[state]}`}
                      style={{
                        top: (start - rangeStart) * PX_PER_MINUTE + 1,
                        height: blockHeight,
                        left: `calc(${(lane / lanes) * 100}% + 3px)`,
                        width: `calc(${100 / lanes}% - 6px)`,
                        zIndex: state === 'cancelled' ? 1 : 2,
                      }}
                    >
                      <div className="flex items-center gap-1 text-[11px] font-medium tabular-nums opacity-75">
                        {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
                        {warn && <AlertIcon className="h-3 w-3 text-amber-600" />}
                        {booking.customer?.blocked && <BanIcon className="h-3 w-3 text-red-600" />}
                        {(booking.notes || booking.customer?.notes) && <NoteIcon className="h-3 w-3" />}
                      </div>
                      {!compact && (
                        <>
                          <p className="truncate text-[13px] font-semibold leading-tight">
                            {booking.customerName}
                          </p>
                          <p className="truncate text-xs opacity-75">{booking.service.name}</p>
                        </>
                      )}
                      {compact && (
                        <p className="sr-only">
                          {booking.customerName}, {booking.service.name}
                        </p>
                      )}
                    </button>
                  )
                })}

                {showNowLine && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 h-0.5 -translate-y-1/2 bg-[#e5484d]"
                    style={{ top: (nowMinutes - rangeStart) * PX_PER_MINUTE }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

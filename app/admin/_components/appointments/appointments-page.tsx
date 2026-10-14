'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeGreekMobilePhone } from '@/lib/phone'
import {
  type Barber,
  type Booking,
  type ScheduleException,
  type Service,
  addDaysToKey,
  adminFetch,
  bookingDateKey,
  buildMonthGrid,
  errorMessage,
  formatDateKeyLong,
  formatPhone,
  formatPrice,
  formatTime,
  getBookingState,
  isBillable,
  shiftMonth,
  todayKey,
} from '../../_lib/admin-data'
import {
  Avatar,
  Button,
  Card,
  ChevronLeftIcon,
  ChevronRightIcon,
  EmptyState,
  ErrorNotice,
  IconButton,
  PlusIcon,
  Skeleton,
  StateBadge,
} from '../ui'
import { BookingDrawer } from './booking-drawer'
import { DaySchedule } from './day-schedule'
import { MiniCalendar } from './mini-calendar'
import { type NewBookingPrefill, NewBookingModal } from './new-booking-modal'

type View = 'schedule' | 'list'

export function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [monthKey, setMonthKey] = useState(todayKey)
  const [view, setView] = useState<View>('schedule')
  const [showCancelled, setShowCancelled] = useState(false)
  const [hiddenBarbers, setHiddenBarbers] = useState<Set<string>>(new Set())

  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [openBookingId, setOpenBookingId] = useState<string | null>(null)
  const [newBooking, setNewBooking] = useState<NewBookingPrefill | null>(null)

  const grid = useMemo(() => buildMonthGrid(monthKey), [monthKey])
  const rangeFrom = grid[0]
  const rangeTo = grid[grid.length - 1]

  useEffect(() => {
    void Promise.all([
      adminFetch<Barber[]>('/api/barbers').then(setBarbers),
      adminFetch<Service[]>('/api/services').then(setServices),
      adminFetch<ScheduleException[]>('/api/admin/schedule-exceptions').then(setExceptions),
    ]).catch((loadError) => setError(errorMessage(loadError)))
  }, [])

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBookings(
        await adminFetch<Booking[]>(`/api/admin/bookings?from=${rangeFrom}&to=${rangeTo}`),
      )
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [rangeFrom, rangeTo])

  useEffect(() => {
    queueMicrotask(() => void loadBookings())
  }, [loadBookings])

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey)
    if (dateKey.slice(0, 7) !== monthKey.slice(0, 7)) setMonthKey(dateKey)
  }

  const bookingCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const booking of bookings) {
      if (booking.status === 'CANCELLED') continue
      const key = bookingDateKey(booking)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [bookings])

  const dayBookings = useMemo(
    () =>
      bookings
        .filter((booking) => bookingDateKey(booking) === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [bookings, selectedDate],
  )
  const activeDayBookings = dayBookings.filter((b) => b.status !== 'CANCELLED')
  const cancelledCount = dayBookings.length - activeDayBookings.length
  const dayRevenue = activeDayBookings
    .filter(isBillable)
    .reduce((sum, booking) => sum + booking.service.price, 0)

  const visibleBarbers = barbers.filter((barber) => !hiddenBarbers.has(barber.id))
  const scheduleBookings = dayBookings.filter(
    (booking) =>
      !hiddenBarbers.has(booking.barber.id) &&
      (showCancelled || booking.status !== 'CANCELLED'),
  )
  const openBooking = bookings.find((booking) => booking.id === openBookingId) ?? null

  function handleUpdated(updated: Booking) {
    const phone = normalizeGreekMobilePhone(updated.customerPhone)
    setBookings((current) =>
      current.map((booking) => {
        if (booking.id === updated.id) return { ...booking, ...updated }
        // Keep every booking of the same customer in sync with the new count.
        if (phone && normalizeGreekMobilePhone(booking.customerPhone) === phone) {
          return { ...booking, noShowCount: updated.noShowCount }
        }
        return booking
      }),
    )
  }

  function toggleBarber(id: string) {
    setHiddenBarbers((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Left: calendar, day summary, barber filter */}
      <aside className="space-y-4">
        <Card className="p-4">
          <MiniCalendar
            monthKey={monthKey}
            selectedKey={selectedDate}
            bookingCounts={bookingCounts}
            onSelect={selectDate}
            onMonthChange={(direction) => setMonthKey((key) => shiftMonth(key, direction))}
          />
        </Card>

        <Card className="grid grid-cols-2 divide-x divide-[var(--admin-border)]">
          <div className="px-4 py-3.5">
            <p className="text-xs text-[var(--admin-muted)]">Ραντεβού ημέρας</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{activeDayBookings.length}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-xs text-[var(--admin-muted)]">Έσοδα ημέρας</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatPrice(dayRevenue)}</p>
          </div>
        </Card>

        {barbers.length > 0 && (
          <Card className="hidden p-4 lg:block">
            <p className="mb-2 text-[13px] font-medium text-[var(--admin-muted)]">Κουρείς</p>
            <div className="space-y-1">
              {barbers.map((barber) => {
                const visible = !hiddenBarbers.has(barber.id)
                const count = activeDayBookings.filter((b) => b.barber.id === barber.id).length
                return (
                  <label
                    key={barber.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-[var(--admin-surface-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleBarber(barber.id)}
                      className="h-4 w-4 accent-[var(--admin-accent)]"
                    />
                    <Avatar name={barber.name} image={barber.image} size={26} />
                    <span className="flex-1 truncate text-sm">{barber.name}</span>
                    <span className="text-xs tabular-nums text-[var(--admin-muted)]">{count}</span>
                  </label>
                )
              })}
            </div>
          </Card>
        )}
      </aside>

      {/* Right: day schedule or list */}
      <section className="min-w-0">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => selectDate(todayKey())}>
              Σήμερα
            </Button>
            <IconButton label="Προηγούμενη ημέρα" onClick={() => selectDate(addDaysToKey(selectedDate, -1))}>
              <ChevronLeftIcon className="h-4 w-4" />
            </IconButton>
            <IconButton label="Επόμενη ημέρα" onClick={() => selectDate(addDaysToKey(selectedDate, 1))}>
              <ChevronRightIcon className="h-4 w-4" />
            </IconButton>
            <h1 className="ml-1 text-base font-semibold capitalize tracking-tight sm:text-xl">
              {formatDateKeyLong(selectedDate)}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-[var(--admin-border)] bg-white p-0.5">
              {(
                [
                  ['schedule', 'Πρόγραμμα'],
                  ['list', 'Λίστα'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                  className={`h-8 rounded-[10px] px-3 text-[13px] font-medium transition-colors ${
                    view === key
                      ? 'bg-[var(--admin-text)] text-white'
                      : 'text-[var(--admin-muted)] hover:text-[var(--admin-text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-2 text-[13px] text-[var(--admin-muted)]">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(event) => setShowCancelled(event.target.checked)}
                className="h-4 w-4 accent-[var(--admin-accent)]"
              />
              Ακυρωμένα{cancelledCount ? ` (${cancelledCount})` : ''}
            </label>
            <Button
              variant="primary"
              onClick={() => setNewBooking({ date: selectedDate, barberId: visibleBarbers[0]?.id })}
            >
              <PlusIcon className="h-4 w-4" />
              Νέο ραντεβού
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorNotice message={error} onRetry={() => void loadBookings()} />
          </div>
        )}

        <Card className="overflow-hidden">
          {loading && bookings.length === 0 ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : view === 'schedule' ? (
            <DaySchedule
              dateKey={selectedDate}
              barbers={visibleBarbers}
              bookings={scheduleBookings}
              exceptions={exceptions}
              onSlotClick={(barber, time) =>
                setNewBooking({ date: selectedDate, barberId: barber.id, time })
              }
              onBookingClick={(booking) => setOpenBookingId(booking.id)}
            />
          ) : scheduleBookings.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Δεν υπάρχουν ραντεβού αυτή την ημέρα." />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {scheduleBookings.map((booking) => (
                <li key={booking.id}>
                  <button
                    type="button"
                    onClick={() => setOpenBookingId(booking.id)}
                    className="grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[var(--admin-surface-2)]"
                  >
                    <span className="text-sm font-semibold tabular-nums">
                      {formatTime(booking.startTime)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{booking.customerName}</span>
                      <span className="block truncate text-[13px] text-[var(--admin-muted)]">
                        {booking.service.name} · {booking.barber.name} · {formatPhone(booking.customerPhone)}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-sm tabular-nums text-[var(--admin-muted)] sm:inline">
                        {formatPrice(booking.service.price)}
                      </span>
                      <StateBadge state={getBookingState(booking)} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {openBooking && (
        <BookingDrawer
          key={openBooking.id}
          booking={openBooking}
          allBookings={bookings}
          onClose={() => setOpenBookingId(null)}
          onUpdated={handleUpdated}
          onDeleted={(id) => {
            setBookings((current) => current.filter((booking) => booking.id !== id))
            setOpenBookingId(null)
          }}
          onBookAgain={(booking) => {
            setOpenBookingId(null)
            setNewBooking({
              date: selectedDate,
              barberId: booking.barber.id,
              customerName: booking.customerName,
              customerPhone: booking.customerPhone,
              customerEmail: booking.customerEmail,
            })
          }}
        />
      )}

      {newBooking && (
        <NewBookingModal
          prefill={newBooking}
          barbers={barbers}
          services={services}
          knownBookings={bookings}
          onClose={() => setNewBooking(null)}
          onCreated={(created) => {
            setBookings((current) => [...current, created])
            selectDate(bookingDateKey(created))
          }}
        />
      )}
    </div>
  )
}

"use client";

import Image from 'next/image'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  BOOKING_LOCALE,
  BOOKING_TIME_ZONE,
  getDateKeyInBookingTimeZone,
} from '@/lib/schedule'

type Booking = {
  id: string
  startTime: string
  endTime: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  barber: { id: string; name: string }
  service: { id: string; name: string; price: number; duration: number }
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED'
}

type Stats = {
  todayBookings: number
  todayRevenue: number
  weekBookings: number
  weekRevenue: number
}

type ServiceItem = { id: string; name: string; price: number; duration: number }
type BarberItem = { id: string; name: string; image: string | null }

type ExceptionType = 'BLOCK_SLOT' | 'FORCE_OPEN' | 'FORCE_CLOSE'
type ScheduleException = {
  id: string
  date: string
  dateKey: string
  barberName: string | null
  type: ExceptionType
  slotTime: string | null
}

const TABS = [
  { key: 'appointments', label: 'Ραντεβού' },
  { key: 'customers', label: 'Πελάτες' },
  { key: 'barbers', label: 'Κουρείς' },
  { key: 'services', label: 'Υπηρεσίες' },
  { key: 'schedule', label: 'Ωράριο' },
  { key: 'revenue', label: 'Έσοδα' },
] as const
type TabKey = (typeof TABS)[number]['key']

const BARBERS = ['Όλοι', 'Redi', 'Donaldo', 'Kleidi'] as const
type BarberFilter = (typeof BARBERS)[number]
const WEEKDAYS = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ']

const SLOT_OPTIONS = (() => {
  const out: string[] = []
  for (let hour = 9; hour <= 20; hour++) {
    out.push(`${String(hour).padStart(2, '0')}:00`)
    out.push(`${String(hour).padStart(2, '0')}:30`)
  }
  return out
})()

function formatPrice(price: number) {
  return `${Number.isInteger(price) ? price : price.toFixed(2)}€`
}

function formatDateKeyLong(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function toDateKey(dateStr: string) {
  return getDateKeyInBookingTimeZone(new Date(dateStr))
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function buildCalendarDays(monthDate: Date) {
  const firstOfMonth = startOfMonth(monthDate)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })
}

function monthTitle(date: Date) {
  return date.toLocaleDateString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  })
}

function getBookingStatus(booking: Booking) {
  if (booking.status === 'CANCELLED') return 'cancelled'
  if (booking.status === 'COMPLETED') return 'completed'
  if (booking.status === 'PENDING') return 'pending'
  return new Date(booking.endTime) <= new Date() ? 'completed' : 'pending'
}

function StatusBadge({ status }: { status: ReturnType<typeof getBookingStatus> }) {
  const styles = {
    completed: 'border-emerald-400/45 bg-emerald-400/15 text-emerald-300',
    pending: 'border-yellow-300/45 bg-yellow-300/15 text-yellow-200',
    cancelled: 'border-[#ff1f2d]/50 bg-[#ff1f2d]/15 text-[#ff6b75]',
  }
  const labels = {
    completed: 'Ολοκληρωμένο',
    pending: 'Επιβεβαιωμένο',
    cancelled: 'Ακυρωμένο',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7l1-3h4l1 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  )
}

const cardClass =
  'rounded-2xl border border-white/10 bg-black/30 p-5 shadow-2xl shadow-black/25'
const fieldClass =
  'mt-2 w-full rounded-xl border border-[#4b0710] bg-black/70 px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff1f2d] focus:ring-2 focus:ring-[#ff1f2d]/25'
const labelClass =
  'text-xs font-bold uppercase tracking-[0.16em] text-zinc-500'
const primaryButtonClass =
  'rounded-xl bg-[#ff1f2d] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#ff1f2d]/20 transition hover:bg-[#d80d19] disabled:cursor-not-allowed disabled:opacity-50'

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff1f2d]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{title}</h2>
    </div>
  )
}

/* ----------------------------- Customers tab ----------------------------- */

function CustomersView({ bookings }: { bookings: Booking[] }) {
  const customers = useMemo(() => {
    const byPhone = new Map<
      string,
      { name: string; phone: string; email: string | null; visits: number }
    >()
    for (const booking of bookings) {
      const key = booking.customerPhone || booking.customerName
      const existing = byPhone.get(key)
      if (existing) {
        existing.visits += 1
        if (!existing.email && booking.customerEmail) {
          existing.email = booking.customerEmail
        }
      } else {
        byPhone.set(key, {
          name: booking.customerName,
          phone: booking.customerPhone,
          email: booking.customerEmail,
          visits: 1,
        })
      }
    }
    return Array.from(byPhone.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'el'),
    )
  }, [bookings])

  return (
    <section className={cardClass}>
      <SectionHeader eyebrow="Πελάτες" title={`${customers.length} πελάτες`} />
      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-12 text-center text-sm text-zinc-400">
          Δεν υπάρχουν καταχωρημένοι πελάτες ακόμη.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="bg-[#3a050c]/60 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
                <th className="px-4 py-3">Όνομα</th>
                <th className="px-4 py-3">Τηλέφωνο</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Επισκέψεις</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.phone + customer.name}
                  className="border-t border-white/5 text-zinc-200 odd:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-semibold text-white">{customer.name}</td>
                  <td className="px-4 py-3">{customer.phone}</td>
                  <td className="px-4 py-3 text-zinc-400">{customer.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-black text-[#ff6b75]">{customer.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ------------------------------ Barbers tab ------------------------------ */

function BarbersView({ barbers }: { barbers: BarberItem[] }) {
  return (
    <section className={cardClass}>
      <SectionHeader eyebrow="Κουρείς" title="Η ομάδα μας" />
      {barbers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-12 text-center text-sm text-zinc-400">
          Δεν υπάρχουν καταχωρημένοι κουρείς.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((barber) => (
            <div
              key={barber.id}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#180307]/80 p-4"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#ff1f2d]/30 bg-black">
                {barber.image ? (
                  <Image src={barber.image} alt={barber.name} fill unoptimized sizes="64px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-black text-zinc-500">
                    {barber.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-white">{barber.name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#ff6b75]">Barber</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ------------------------------ Services tab ----------------------------- */

function ServicesView({ services }: { services: ServiceItem[] }) {
  return (
    <section className={cardClass}>
      <SectionHeader eyebrow="Υπηρεσίες" title="Τιμοκατάλογος" />
      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-12 text-center text-sm text-zinc-400">
          Δεν υπάρχουν καταχωρημένες υπηρεσίες.
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#080607] p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-black text-white">{service.name}</p>
                <p className="mt-1 text-sm text-zinc-400">{service.duration} λεπτά</p>
              </div>
              <p className="shrink-0 text-lg font-black tabular-nums text-[#ff6b75]">
                {formatPrice(service.price)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ------------------------------ Revenue tab ------------------------------ */

function RevenueView({ bookings }: { bookings: Booking[] }) {
  const summary = useMemo(() => {
    const acc = {
      completed: { count: 0, revenue: 0 },
      pending: { count: 0, revenue: 0 },
      cancelled: { count: 0, revenue: 0 },
    }
    for (const booking of bookings) {
      const status = getBookingStatus(booking)
      acc[status].count += 1
      acc[status].revenue += booking.service.price
    }
    return acc
  }, [bookings])

  const collected = summary.completed.revenue
  const projected = summary.completed.revenue + summary.pending.revenue

  const cards = [
    {
      key: 'completed',
      label: 'Ολοκληρωμένα',
      tone: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
      data: summary.completed,
    },
    {
      key: 'pending',
      label: 'Σε εκκρεμότητα',
      tone: 'border-yellow-300/40 bg-yellow-300/10 text-yellow-200',
      data: summary.pending,
    },
    {
      key: 'cancelled',
      label: 'Ακυρωμένα',
      tone: 'border-[#ff1f2d]/40 bg-[#ff1f2d]/10 text-[#ff6b75]',
      data: summary.cancelled,
    },
  ] as const

  return (
    <section className={cardClass}>
      <SectionHeader eyebrow="Έσοδα" title="Σύνοψη εσόδων" />
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.key} className={`rounded-2xl border p-5 ${card.tone}`}>
            <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-white">{formatPrice(card.data.revenue)}</p>
            <p className="mt-1 text-sm opacity-80">{card.data.count} ραντεβού</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#180307]/80 p-5">
          <p className={labelClass}>Εισπραγμένα (ολοκληρωμένα)</p>
          <p className="mt-2 text-2xl font-black text-white">{formatPrice(collected)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#180307]/80 p-5">
          <p className={labelClass}>Προβλεπόμενο σύνολο</p>
          <p className="mt-2 text-2xl font-black text-white">{formatPrice(projected)}</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-zinc-500">
        Η κατάσταση προκύπτει από το πεδίο «status» του ραντεβού. Οι ακυρωμένες
        κρατήσεις που διαγράφονται οριστικά δεν προσμετρώνται εδώ.
      </p>
    </section>
  )
}

/* -------------------------- Schedule Manager tab ------------------------- */

function exceptionTypeLabel(type: ExceptionType) {
  if (type === 'BLOCK_SLOT') return 'Κλείδωμα ώρας'
  if (type === 'FORCE_OPEN') return 'Άνοιγμα ημέρας'
  return 'Κλείσιμο ημέρας'
}

function ScheduleManagerView({ barbers }: { barbers: BarberItem[] }) {
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const todayKey = useMemo(() => getDateKeyInBookingTimeZone(new Date()), [])

  // Form A — block a specific slot
  const [blockDate, setBlockDate] = useState(todayKey)
  const [blockBarber, setBlockBarber] = useState('')
  const [blockSlot, setBlockSlot] = useState(SLOT_OPTIONS[0])
  const [blockSubmitting, setBlockSubmitting] = useState(false)
  const [blockError, setBlockError] = useState<string | null>(null)

  // Form B — force open / close a day
  const [overrideDate, setOverrideDate] = useState(todayKey)
  const [overrideMode, setOverrideMode] = useState<'FORCE_OPEN' | 'FORCE_CLOSE'>(
    'FORCE_OPEN',
  )
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)

  const loadExceptions = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/admin/schedule-exceptions')
      if (!res.ok) throw new Error('Request failed')
      setExceptions((await res.json()) as ScheduleException[])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadExceptions()
  }, [loadExceptions])

  async function createException(
    body: Record<string, unknown>,
    onError: (message: string) => void,
  ) {
    const res = await fetch('/api/admin/schedule-exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null
      onError(data?.error ?? 'Η καταχώρηση απέτυχε.')
      return false
    }
    await loadExceptions()
    return true
  }

  async function handleBlockSubmit() {
    setBlockSubmitting(true)
    setBlockError(null)
    try {
      await createException(
        {
          type: 'BLOCK_SLOT',
          date: blockDate,
          slotTime: blockSlot,
          barberName: blockBarber || null,
        },
        setBlockError,
      )
    } finally {
      setBlockSubmitting(false)
    }
  }

  async function handleOverrideSubmit() {
    setOverrideSubmitting(true)
    setOverrideError(null)
    try {
      await createException(
        { type: overrideMode, date: overrideDate },
        setOverrideError,
      )
    } finally {
      setOverrideSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setExceptions((prev) => prev.filter((item) => item.id !== id))
    try {
      await fetch(`/api/admin/schedule-exceptions/${id}`, { method: 'DELETE' })
    } finally {
      await loadExceptions()
    }
  }

  const blockedSlots = exceptions.filter((item) => item.type === 'BLOCK_SLOT')
  const dayOverrides = exceptions.filter((item) => item.type !== 'BLOCK_SLOT')

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Form A */}
        <section className={cardClass}>
          <SectionHeader eyebrow="Ωράριο · Form A" title="Κλείδωμα ώρας (Άδεια)" />
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Ημερομηνία</span>
              <input
                type="date"
                value={blockDate}
                min={todayKey}
                onChange={(event) => setBlockDate(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Κουρέας</span>
              <select
                value={blockBarber}
                onChange={(event) => setBlockBarber(event.target.value)}
                className={fieldClass}
              >
                <option value="" className="bg-[#120306]">Όλο το μαγαζί</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.name} className="bg-[#120306]">
                    {barber.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Ώρα</span>
              <select
                value={blockSlot}
                onChange={(event) => setBlockSlot(event.target.value)}
                className={fieldClass}
              >
                {SLOT_OPTIONS.map((slot) => (
                  <option key={slot} value={slot} className="bg-[#120306]">
                    {slot}
                  </option>
                ))}
              </select>
            </label>
            {blockError && (
              <p className="text-sm text-[#ff6b75]">{blockError}</p>
            )}
            <button
              type="button"
              onClick={() => void handleBlockSubmit()}
              disabled={blockSubmitting}
              className={`w-full ${primaryButtonClass}`}
            >
              {blockSubmitting ? 'Καταχώρηση...' : 'Κλείδωμα ώρας'}
            </button>
          </div>

          <div className="mt-6">
            <p className={labelClass}>Κλειδωμένες ώρες</p>
            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="h-16 animate-pulse rounded-xl bg-[#180307]" />
              ) : blockedSlots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 bg-black/25 p-4 text-center text-sm text-zinc-500">
                  Καμία κλειδωμένη ώρα.
                </p>
              ) : (
                blockedSlots.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#080607] p-3"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-black text-white">
                        {formatDateKeyLong(item.dateKey)} · {item.slotTime}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {item.barberName ?? 'Όλο το μαγαζί'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-[#ff1f2d]/40 hover:text-[#ff6b75]"
                      aria-label="Διαγραφή"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Form B */}
        <section className={cardClass}>
          <SectionHeader eyebrow="Ωράριο · Form B" title="Υπερισχύσεις ημερολογίου" />
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Ημερομηνία</span>
              <input
                type="date"
                value={overrideDate}
                min={todayKey}
                onChange={(event) => setOverrideDate(event.target.value)}
                className={fieldClass}
              />
            </label>
            <div>
              <span className={labelClass}>Κατάσταση</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideMode('FORCE_OPEN')}
                  className={`rounded-xl border px-4 py-3 text-sm font-black transition ${
                    overrideMode === 'FORCE_OPEN'
                      ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                      : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white'
                  }`}
                >
                  ΑΝΟΙΧΤΟ
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideMode('FORCE_CLOSE')}
                  className={`rounded-xl border px-4 py-3 text-sm font-black transition ${
                    overrideMode === 'FORCE_CLOSE'
                      ? 'border-[#ff1f2d]/50 bg-[#ff1f2d]/15 text-[#ff6b75]'
                      : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white'
                  }`}
                >
                  ΚΛΕΙΣΤΟ
                </button>
              </div>
            </div>
            {overrideError && (
              <p className="text-sm text-[#ff6b75]">{overrideError}</p>
            )}
            <button
              type="button"
              onClick={() => void handleOverrideSubmit()}
              disabled={overrideSubmitting}
              className={`w-full ${primaryButtonClass}`}
            >
              {overrideSubmitting ? 'Καταχώρηση...' : 'Αποθήκευση υπερίσχυσης'}
            </button>
          </div>

          <div className="mt-6">
            <p className={labelClass}>Ενεργές υπερισχύσεις</p>
            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="h-16 animate-pulse rounded-xl bg-[#180307]" />
              ) : dayOverrides.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 bg-black/25 p-4 text-center text-sm text-zinc-500">
                  Καμία υπερίσχυση ημέρας.
                </p>
              ) : (
                dayOverrides.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#080607] p-3"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-black text-white">
                        {formatDateKeyLong(item.dateKey)}
                      </p>
                      <p
                        className={`mt-0.5 text-xs font-black ${
                          item.type === 'FORCE_OPEN'
                            ? 'text-emerald-300'
                            : 'text-[#ff6b75]'
                        }`}
                      >
                        {item.type === 'FORCE_OPEN' ? 'ΑΝΟΙΧΤΟ' : 'ΚΛΕΙΣΤΟ'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-[#ff1f2d]/40 hover:text-[#ff6b75]"
                      aria-label="Διαγραφή"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#ff1f2d]/35 bg-[#ff1f2d]/10 p-4 text-center text-sm text-[#ffb3b8]">
          Δεν ήταν δυνατή η φόρτωση των εξαιρέσεων.
        </div>
      )}
    </div>
  )
}

/* --------------------------- New booking modal --------------------------- */

function NewBookingModal({
  services,
  barbers,
  defaultBarberName,
  defaultDate,
  onClose,
  onCreated,
}: {
  services: ServiceItem[]
  barbers: BarberItem[]
  defaultBarberName: string
  defaultDate: string
  onClose: () => void
  onCreated: (booking: Booking) => void
}) {
  const initialBarberId =
    barbers.find((barber) => barber.name === defaultBarberName)?.id ??
    barbers[0]?.id ??
    ''

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [barberId, setBarberId] = useState(initialBarberId)
  const [date, setDate] = useState(defaultDate)
  const [slotTime, setSlotTime] = useState(SLOT_OPTIONS[0])
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = services.length > 0 && barbers.length > 0

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Συμπλήρωσε όνομα και τηλέφωνο πελάτη.')
      return
    }
    if (!serviceId || !barberId) {
      setError('Επίλεξε υπηρεσία και κουρέα.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          barberId,
          date,
          slotTime,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || 'manual@twins-bros.gr',
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null
        setError(data?.error ?? 'Η δημιουργία του ραντεβού απέτυχε.')
        return
      }

      const created = (await res.json()) as Booking
      onCreated(created)
      onClose()
    } catch {
      setError('Σφάλμα σύνδεσης. Δοκίμασε ξανά.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#4b0710] bg-[#120306] p-6 shadow-2xl shadow-[#ff1f2d]/15"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Κλείσιμο"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[#ff1f2d]/30 bg-[#ff1f2d]/10 text-[#ff6b75] transition hover:bg-[#ff1f2d]/20 hover:text-white"
        >
          <XIcon className="h-4 w-4" />
        </button>

        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff1f2d]">
          Twins Bros
        </p>
        <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
          Νέο ραντεβού
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Καταχώρηση για walk-in ή τηλεφωνικό πελάτη.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>Όνομα Πελάτη</span>
            <input
              type="text"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="π.χ. Γιώργος Παπαδόπουλος"
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Τηλέφωνο</span>
            <input
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="69XXXXXXXX"
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Email (προαιρετικό)</span>
            <input
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="manual@twins-bros.gr"
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Κουρέας</span>
            <select
              value={barberId}
              onChange={(event) => setBarberId(event.target.value)}
              className={fieldClass}
            >
              {barbers.map((barber) => (
                <option
                  key={barber.id}
                  value={barber.id}
                  className="bg-[#120306]"
                >
                  {barber.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Ημερομηνία</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Ώρα</span>
            <select
              value={slotTime}
              onChange={(event) => setSlotTime(event.target.value)}
              className={fieldClass}
            >
              {SLOT_OPTIONS.map((slot) => (
                <option key={slot} value={slot} className="bg-[#120306]">
                  {slot}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className={labelClass}>Υπηρεσία</span>
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className={fieldClass}
            >
              {services.map((service) => (
                <option
                  key={service.id}
                  value={service.id}
                  className="bg-[#120306]"
                >
                  {service.name} — {formatPrice(service.price)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-[#ff1f2d]/40 bg-[#ff1f2d]/10 p-3 text-sm text-[#ffb3b8]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !ready}
          className={`mt-6 w-full ${primaryButtonClass}`}
        >
          {submitting
            ? 'Καταχώρηση...'
            : ready
              ? 'Καταχώρηση ραντεβού'
              : 'Φόρτωση δεδομένων...'}
        </button>
      </form>
    </div>
  )
}

/* --------------------------------- Page ---------------------------------- */

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('appointments')

  const [stats, setStats] = useState<Stats | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [barbers, setBarbers] = useState<BarberItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [selectedDate, setSelectedDate] = useState(() => getDateKeyInBookingTimeZone(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedBarber, setSelectedBarber] = useState<BarberFilter>('Όλοι')
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
      queueMicrotask(() => setAuthed(true))
    }
  }, [])

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(false)

    fetch('/api/admin/stats', { signal })
      .then((res) => (res.ok ? (res.json() as Promise<Stats>) : null))
      .then((statsData) => {
        if (!signal?.aborted) setStats(statsData)
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error fetching stats:', err)
          setStats(null)
        }
      })

    fetch('/api/services', { signal })
      .then((res) => (res.ok ? (res.json() as Promise<ServiceItem[]>) : []))
      .then((data) => {
        if (!signal?.aborted) setServices(Array.isArray(data) ? data : [])
      })
      .catch(() => {})

    fetch('/api/barbers', { signal })
      .then((res) => (res.ok ? (res.json() as Promise<BarberItem[]>) : []))
      .then((data) => {
        if (!signal?.aborted) setBarbers(Array.isArray(data) ? data : [])
      })
      .catch(() => {})

    try {
      const bookingsRes = await fetch('/api/admin/bookings', { signal })
      if (!bookingsRes.ok) throw new Error('Bookings request failed')
      const bookingsData = (await bookingsRes.json()) as Booking[] | null
      if (signal?.aborted) return
      setBookings(Array.isArray(bookingsData) ? bookingsData : [])
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('Error fetching bookings:', err)
      setBookings([])
      setError(true)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadData(controller.signal)
    })
    return () => controller.abort()
  }, [authed, loadData])

  async function handleLogin() {
    setAuthLoading(true)
    setAuthError(false)
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        sessionStorage.setItem('admin_auth', 'true')
        setAuthed(true)
      } else {
        setAuthError(true)
      }
    } catch {
      setAuthError(true)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleCancel(id: string) {
    setCancelling(true)
    try {
      await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' })
      setBookings((prev) => prev.filter((booking) => booking.id !== id))
      void loadData()
    } catch {
      // Keep the current list visible if the action fails.
    } finally {
      setCancelling(false)
      setCancelId(null)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_auth')
    setAuthed(false)
  }

  const calendarDays = buildCalendarDays(calendarMonth)
  const selectedDateLabel = formatDateKeyLong(selectedDate)

  const filteredBookings = (bookings?.filter((booking) => {
    const matchesDate = toDateKey(booking.startTime) === selectedDate
    const matchesBarber =
      selectedBarber === 'Όλοι' || booking.barber.name === selectedBarber
    return matchesDate && matchesBarber
  }) ?? [])
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const selectedRevenue = filteredBookings.reduce((sum, booking) => {
    const status = getBookingStatus(booking)
    return status === 'cancelled' ? sum : sum + booking.service.price
  }, 0)
  const todayRevenue = stats?.todayRevenue ?? 0

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#4b0710_0%,#120306_42%,#050505_100%)] px-6 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/45 p-8 shadow-2xl shadow-[#ff1f2d]/10 backdrop-blur">
          <div className="mb-7 flex flex-col items-center gap-4">
            <Image src="/logo.webp" alt="Twins Bros" width={86} height={86} className="rounded-full border border-white/15 bg-black object-cover" priority />
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ff1f2d]">Twins Bros</p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">Admin Dashboard</p>
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Κωδικός</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void handleLogin()}
              className="mt-2 w-full rounded-xl border border-[#4b0710] bg-black/70 px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff1f2d] focus:ring-2 focus:ring-[#ff1f2d]/25"
              placeholder="••••••••"
            />
          </label>
          {authError && <p className="mt-2 text-sm text-[#ff6b75]">Λάθος κωδικός</p>}
          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={authLoading}
            className="mt-5 w-full rounded-xl bg-[#ff1f2d] py-3 text-sm font-black text-white shadow-lg shadow-[#ff1f2d]/20 transition hover:bg-[#d80d19] disabled:opacity-50"
          >
            {authLoading ? 'Σύνδεση...' : 'Είσοδος'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#3a050c_0%,#120306_35%,#050505_100%)] px-4 pb-16 pt-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/35 p-5 shadow-2xl shadow-black/30 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo.webp" alt="Twins Bros" width={58} height={58} className="rounded-full border border-white/15 bg-black object-cover shadow-lg shadow-[#ff1f2d]/10" priority />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-[#ff1f2d]">Twins Bros</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Πίνακας ελέγχου</h1>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-300">
              <span className="text-zinc-500">Συνδεδεμένος:</span> admin@twins-bros.gr
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-[#ff1f2d]/50 hover:bg-[#ff1f2d]/10"
            >
              Αποσύνδεση
            </button>
          </div>
        </header>

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,#4b0710,#ff1f2d)] text-white shadow-lg shadow-[#ff1f2d]/20'
                    : 'bg-white/[0.04] text-zinc-400 hover:bg-[#4b0710]/70 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        {activeTab === 'appointments' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.95fr)_minmax(0,2fr)]">
            <aside className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-xl shadow-black/20">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-[#4b0710]"
                    aria-label="Προηγούμενος μήνας"
                  >
                    ‹
                  </button>
                  <h2 className="text-center text-base font-black capitalize text-white">{monthTitle(calendarMonth)}</h2>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-[#4b0710]"
                    aria-label="Επόμενος μήνας"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="pb-2 text-center text-[11px] font-black uppercase text-zinc-500">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const key = localDateKey(day)
                    const selected = selectedDate === key
                    const currentMonth = day.getMonth() === calendarMonth.getMonth()

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedDate(key)
                          setCalendarMonth(startOfMonth(day))
                        }}
                        className={`flex aspect-square min-h-9 items-center justify-center rounded-full text-sm font-black transition ${
                          selected
                            ? 'bg-[#ff1f2d] text-white shadow-[0_12px_30px_rgba(255,31,45,0.28)]'
                            : currentMonth
                              ? 'text-zinc-200 hover:bg-[#4b0710] hover:text-white'
                              : 'text-zinc-700 hover:bg-white/[0.03]'
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-[#180307]/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Σήμερα</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatPrice(todayRevenue)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#180307]/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Επιλεγμένη μέρα</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatPrice(selectedRevenue)}</p>
                </div>
              </section>
            </aside>

            <section className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4 shadow-2xl shadow-black/25 sm:p-5">
              <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff1f2d]">Ραντεβού</p>
                  <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Ραντεβού για {selectedDateLabel}</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Κουρέας</span>
                    <select
                      value={selectedBarber}
                      onChange={(event) => setSelectedBarber(event.target.value as BarberFilter)}
                      className="bg-transparent text-sm font-semibold text-white outline-none"
                    >
                      {BARBERS.map((barber) => (
                        <option key={barber} value={barber} className="bg-[#120306] text-white">
                          {barber}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNewBookingOpen(true)}
                    className="rounded-xl bg-[#ff1f2d] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#ff1f2d]/20 transition hover:bg-[#d80d19]"
                  >
                    + Νέο ραντεβού
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <p className="rounded-2xl border border-white/10 bg-black/25 p-5 text-sm font-semibold text-zinc-300">
                    Φόρτωση ραντεβού...
                  </p>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-2xl bg-[#180307]" />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-[#ff1f2d]/35 bg-[#ff1f2d]/10 p-8 text-center">
                  <p className="text-sm text-[#ffb3b8]">Κάτι πήγε στραβά.</p>
                  <button type="button" onClick={() => void loadData()} className="mt-4 rounded-xl border border-[#ff1f2d]/50 px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff1f2d]/15">
                    Δοκίμασε ξανά
                  </button>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-12 text-center text-sm text-zinc-400">
                  Δεν υπάρχουν ραντεβού για αυτή την ημέρα.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((booking) => {
                    const status = getBookingStatus(booking)
                    const pending = status === 'pending'

                    return (
                      <article key={booking.id} className="grid gap-4 rounded-2xl border border-white/10 bg-[#080607] p-4 shadow-xl shadow-black/20 md:grid-cols-[96px_minmax(0,1fr)_auto] md:items-center">
                        <div className="flex h-20 items-center justify-center rounded-2xl border border-[#ff1f2d]/30 bg-[#3a050c] font-mono text-2xl font-black text-white shadow-inner shadow-black/30">
                          {formatTime(booking.startTime)}
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div>
                            <h3 className="truncate text-lg font-black text-white">{booking.customerName}</h3>
                            <p className="mt-1 text-sm text-zinc-400">{formatDate(booking.startTime)} · {booking.barber.name}</p>
                          </div>
                          <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                            <p className="truncate"><span className="text-zinc-500">Email:</span> {booking.customerEmail ?? '—'}</p>
                            <p className="truncate"><span className="text-zinc-500">Τηλέφωνο:</span> {booking.customerPhone}</p>
                            <p className="truncate"><span className="text-zinc-500">Πληρωμή:</span> POS - {formatPrice(booking.service.price)}</p>
                            <p className="truncate"><span className="text-zinc-500">Υπηρεσία:</span> {booking.service.name}</p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 md:items-end">
                          <StatusBadge status={status} />
                          <div className="flex flex-wrap gap-2 md:justify-end">
                            <button
                              type="button"
                              onClick={() => setCancelId(booking.id)}
                              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ff1f2d]/25 bg-[#4b0710] px-3 text-xs font-black text-[#ffb3b8] transition hover:bg-[#6d0a14]"
                            >
                              <XIcon className="h-4 w-4" />
                              ΑΚΥΡΩΣΗ
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCancel(booking.id)}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-[#ff1f2d]/40 hover:text-[#ff6b75]"
                              aria-label="Διαγραφή ραντεβού"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'customers' && <CustomersView bookings={bookings} />}
        {activeTab === 'barbers' && <BarbersView barbers={barbers} />}
        {activeTab === 'services' && <ServicesView services={services} />}
        {activeTab === 'schedule' && <ScheduleManagerView barbers={barbers} />}
        {activeTab === 'revenue' && <RevenueView bookings={bookings} />}
      </div>

      {isNewBookingOpen && (
        <NewBookingModal
          services={services}
          barbers={barbers}
          defaultBarberName={selectedBarber}
          defaultDate={selectedDate}
          onClose={() => setIsNewBookingOpen(false)}
          onCreated={(booking) =>
            setBookings((prev) => [...prev, booking])
          }
        />
      )}

      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#120306] p-6 text-center shadow-2xl shadow-[#ff1f2d]/10">
            <p className="text-lg font-black text-white">Ακύρωση ραντεβού;</p>
            <p className="mt-2 text-sm text-zinc-400">Η ενέργεια αφαιρεί το ραντεβού από το πρόγραμμα.</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setCancelId(null)}
                className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/5"
              >
                Πίσω
              </button>
              <button
                type="button"
                onClick={() => void handleCancel(cancelId)}
                disabled={cancelling}
                className="flex-1 rounded-xl bg-[#ff1f2d] py-3 text-sm font-black text-white hover:bg-[#d80d19] disabled:opacity-50"
              >
                {cancelling ? 'Ακύρωση...' : 'Επιβεβαίωση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

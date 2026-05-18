'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  status?: 'pending' | 'completed' | 'cancelled'
}

type Stats = {
  todayBookings: number
  todayRevenue: number
  weekBookings: number
  weekRevenue: number
}

const BARBER_TABS = ['all', 'Redi', 'Donaldo', 'Kleidi'] as const

function formatPrice(price: number) {
  return `${Number.isInteger(price) ? price : price.toFixed(2)}€`
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

function getBookingStatus(booking: Booking) {
  if (booking.status === 'cancelled') return 'cancelled'
  return new Date(booking.endTime) <= new Date() ? 'completed' : 'pending'
}

function StatusBadge({ status }: { status: ReturnType<typeof getBookingStatus> }) {
  const styles = {
    completed: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
    pending: 'border-yellow-300/40 bg-yellow-300/15 text-yellow-200',
    cancelled: 'border-[#ff1f2d]/50 bg-[#ff1f2d]/15 text-[#ff6b75]',
  }
  const labels = {
    completed: 'ΟΛΟΚΛΗΡΩΘΗΚΕ',
    pending: 'ΕΚΚΡΕΜΕΙ',
    cancelled: 'ΑΚΥΡΩΘΗΚΕ',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.12em] ${styles[status]}`}>
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

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)

  const [stats, setStats] = useState<Stats | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [filterBarber, setFilterBarber] = useState<(typeof BARBER_TABS)[number]>('all')
  const [filterDate, setFilterDate] = useState('')
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
      queueMicrotask(() => setAuthed(true))
    }
  }, [])

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        fetch('/api/admin/stats', { signal }),
        fetch('/api/admin/bookings', { signal }),
      ])
      if (!statsRes.ok || !bookingsRes.ok) throw new Error()
      const [statsData, bookingsData] = await Promise.all([
        statsRes.json() as Promise<Stats>,
        bookingsRes.json() as Promise<Booking[]>,
      ])
      if (signal?.aborted) return
      setStats(statsData)
      setBookings(bookingsData)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
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
      setBookings((prev) => prev.filter((b) => b.id !== id))
      void loadData()
    } catch {
      // Keep the dashboard stable if the network drops during an admin action.
    } finally {
      setCancelling(false)
      setCancelId(null)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_auth')
    setAuthed(false)
  }

  const todayKey = getDateKeyInBookingTimeZone(new Date())

  const todayBookings = useMemo(
    () => bookings.filter((booking) => toDateKey(booking.startTime) === todayKey),
    [bookings, todayKey],
  )

  const popularService = useMemo(() => {
    const counts = new Map<string, number>()
    for (const booking of todayBookings) {
      counts.set(booking.service.name, (counts.get(booking.service.name) ?? 0) + 1)
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  }, [todayBookings])

  const filtered = bookings.filter((booking) => {
    if (filterBarber !== 'all' && booking.barber.name !== filterBarber) return false
    if (filterDate && toDateKey(booking.startTime) !== filterDate) return false
    return true
  })

  const todayRevenue = stats?.todayRevenue ?? todayBookings.reduce((sum, booking) => sum + booking.service.price, 0)
  const todayCount = stats?.todayBookings ?? todayBookings.length

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#4b0710_0%,#120306_42%,#050505_100%)] px-6 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/45 p-8 shadow-2xl shadow-[#ff1f2d]/10 backdrop-blur">
          <div className="mb-7 flex flex-col items-center gap-4">
            <Image src="/logo.webp" alt="Twins Bros" width={86} height={86} className="rounded-full border border-white/15 bg-black object-cover" priority />
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ff1f2d]">Twins Bros</p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">Admin Intelligence</p>
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Κωδικός</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
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
        <header className="mb-8 flex flex-col gap-5 rounded-2xl border border-white/10 bg-black/35 p-5 shadow-2xl shadow-black/30 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo.webp" alt="Twins Bros" width={76} height={76} className="rounded-full border border-white/15 bg-black object-cover shadow-lg shadow-[#ff1f2d]/10" priority />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ff1f2d]">Twins Bros</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Business Intelligence</h1>
              <p className="mt-1 text-sm text-zinc-400">Europe/Athens live operations dashboard</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-[#ff1f2d]/50 hover:bg-[#ff1f2d]/10"
          >
            Αποσύνδεση
          </button>
        </header>

        <section className="mb-7 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Σημερινά Έσοδα', value: formatPrice(todayRevenue), detail: 'Athens day boundary' },
            { label: 'Σύνολο Ραντεβού', value: todayCount, detail: 'Σήμερα' },
            { label: 'Δημοφιλής Υπηρεσία', value: popularService, detail: 'Most booked today' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#4b0710_0%,#8f0f1a_54%,#ff1f2d_130%)] p-5 shadow-xl shadow-black/25">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-300">{card.label}</p>
              <p className="mt-4 min-h-10 text-3xl font-black tracking-tight text-white">{card.value}</p>
              <p className="mt-2 text-xs text-zinc-300">{card.detail}</p>
            </div>
          ))}
        </section>

        <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {BARBER_TABS.map((tab) => {
              const active = filterBarber === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterBarber(tab)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black transition ${
                    active
                      ? 'bg-[#ff1f2d] text-white shadow-lg shadow-[#ff1f2d]/20'
                      : 'bg-[#4b0710] text-zinc-300 hover:bg-[#6d0a14] hover:text-white'
                  }`}
                >
                  {tab === 'all' ? 'Όλοι' : tab}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="min-w-0 rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-[#ff1f2d]"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5"
              >
                Όλες
              </button>
            )}
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mb-3 h-14 animate-pulse rounded-xl bg-[#2a0509] last:mb-0" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#ff1f2d]/35 bg-[#ff1f2d]/10 p-8 text-center">
            <p className="text-sm text-[#ffb3b8]">Κάτι πήγε στραβά.</p>
            <button type="button" onClick={() => void loadData()} className="mt-4 rounded-xl border border-[#ff1f2d]/50 px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff1f2d]/15">
              Δοκίμασε ξανά
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-12 text-center text-sm text-zinc-400">
            Δεν βρέθηκαν ραντεβού.
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-2xl shadow-black/30">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left">
                <thead className="bg-black/65 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  <tr>
                    <th className="px-5 py-4">Πελάτης</th>
                    <th className="px-5 py-4">Ημερομηνία</th>
                    <th className="px-5 py-4">Time</th>
                    <th className="px-5 py-4">Barber</th>
                    <th className="px-5 py-4">Υπηρεσία</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((booking, index) => {
                    const status = getBookingStatus(booking)
                    const pending = status === 'pending'
                    return (
                      <tr key={booking.id} className={`border-t border-white/5 ${index % 2 === 0 ? 'bg-[#180307]/80' : 'bg-[#27050b]/80'}`}>
                        <td className="px-5 py-4">
                          <p className="font-bold text-white">{booking.customerName}</p>
                          <p className="mt-1 text-xs text-zinc-400">{booking.customerPhone}</p>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-zinc-200">{formatDate(booking.startTime)}</td>
                        <td className="px-5 py-4 font-mono text-base font-black text-white">{formatTime(booking.startTime)}</td>
                        <td className="px-5 py-4 text-sm text-zinc-300">{booking.barber.name}</td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-zinc-100">{booking.service.name}</p>
                          <p className="mt-1 text-xs font-bold text-[#ff6b75]">{formatPrice(booking.service.price)}</p>
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={status} /></td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled
                              title={pending ? 'Ολοκληρώνεται αυτόματα μετά την ώρα λήξης' : 'Ολοκληρωμένο'}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 opacity-60"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={!pending}
                              onClick={() => setCancelId(booking.id)}
                              title="Ακύρωση"
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ff1f2d]/40 bg-[#ff1f2d]/10 text-[#ff6b75] transition hover:bg-[#ff1f2d]/20 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <XIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

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

'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type Booking = {
  id: string
  startTime: string
  endTime: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  barber: { id: string; name: string }
  service: { id: string; name: string; price: number; duration: number }
}

type Stats = {
  todayBookings: number
  todayRevenue: number
  weekBookings: number
  weekRevenue: number
}

const GR_DAYS = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ']
const GR_MONTHS = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']

function formatPrice(price: number) {
  return `${Number.isInteger(price) ? price : price.toFixed(2)}€`
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${GR_DAYS[d.getDay()]} ${d.getDate()} ${GR_MONTHS[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function toDateKey(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10)
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

  const [filterBarber, setFilterBarber] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
      setAuthed(true)
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    void loadData()
  }, [authed])

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/bookings'),
      ])
      if (!statsRes.ok || !bookingsRes.ok) throw new Error()
      const [statsData, bookingsData] = await Promise.all([
        statsRes.json() as Promise<Stats>,
        bookingsRes.json() as Promise<Booking[]>,
      ])
      setStats(statsData)
      setBookings(bookingsData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

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
      // ignore
    } finally {
      setCancelling(false)
      setCancelId(null)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_auth')
    setAuthed(false)
  }

  const barbers = Array.from(new Set(bookings.map((b) => b.barber.name)))

  const filtered = bookings.filter((b) => {
    if (filterBarber !== 'all' && b.barber.name !== filterBarber) return false
    if (filterDate && toDateKey(b.startTime) !== filterDate) return false
    return true
  })

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8">
          <div className="mb-6 flex flex-col items-center gap-3">
            <Image src="/logo.jpg" alt="Twins Bros" width={64} height={64} className="rounded-full" />
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Admin Panel</p>
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Κωδικός</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20"
              placeholder="••••••••"
            />
          </label>
          {authError && <p className="mt-2 text-sm text-red-400">Λάθος κωδικός</p>}
          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={authLoading}
            className="mt-4 w-full rounded-full bg-amber-400 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
          >
            {authLoading ? 'Σύνδεση...' : 'Είσοδος'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 pb-16 pt-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="Twins Bros" width={40} height={40} className="rounded-full" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Twins Bros</p>
              <p className="text-lg font-semibold">Admin Panel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800"
          >
            Αποσύνδεση
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Ραντεβού Σήμερα', value: stats.todayBookings },
              { label: 'Έσοδα Σήμερα', value: formatPrice(stats.todayRevenue) },
              { label: 'Ραντεβού Εβδομάδας', value: stats.weekBookings },
              { label: 'Έσοδα Εβδομάδας', value: formatPrice(stats.weekRevenue) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className="mt-2 text-2xl font-bold text-amber-400">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <select
            value={filterBarber}
            onChange={(e) => setFilterBarber(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/70"
          >
            <option value="all">Όλοι οι Barbers</option>
            {barbers.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/70"
          />
          {filterDate && (
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Όλες οι Ημέρες
            </button>
          )}
        </div>

        {/* Bookings */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-900" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-300">Κάτι πήγε στραβά.</p>
            <button type="button" onClick={() => void loadData()} className="mt-3 rounded-full border border-red-500/40 px-4 py-1.5 text-sm text-red-200 hover:bg-red-500/10">
              Δοκίμασε ξανά
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
            Δεν βρέθηκαν ραντεβού.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => {
              const upcoming = new Date(b.startTime) > new Date()
              return (
                <div key={b.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold">{b.customerName} <span className="text-zinc-400 font-normal text-sm">· {b.customerPhone}</span></p>
                      <p className="text-sm text-zinc-400">{formatDateTime(b.startTime)}</p>
                      <p className="text-sm text-zinc-400">{b.service.name} · {b.barber.name} · <span className="text-amber-400 font-semibold">{formatPrice(b.service.price)}</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${upcoming ? 'bg-amber-400/15 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                        {upcoming ? 'Upcoming' : 'Completed'}
                      </span>
                      {upcoming && (
                        <button
                          type="button"
                          onClick={() => setCancelId(b.id)}
                          className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                        >
                          Ακύρωση
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <p className="text-lg font-semibold">Ακύρωση ραντεβού;</p>
            <p className="mt-2 text-sm text-zinc-400">Αυτή η ενέργεια δεν αναιρείται.</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setCancelId(null)}
                className="flex-1 rounded-full border border-zinc-700 py-3 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Πίσω
              </button>
              <button
                type="button"
                onClick={() => void handleCancel(cancelId)}
                disabled={cancelling}
                className="flex-1 rounded-full bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
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

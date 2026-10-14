'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  type Booking,
  adminFetch,
  bookingDateKey,
  errorMessage,
  formatPrice,
  isBillable,
  shiftMonth,
  todayKey,
} from '../_lib/admin-data'
import { Card, CardHeader, EmptyState, ErrorNotice, PageHeader, Skeleton, StatCard } from './ui'

type Period = 'thisMonth' | 'lastMonth' | 'thisYear' | 'all'

const PERIODS: [Period, string][] = [
  ['thisMonth', 'Αυτός ο μήνας'],
  ['lastMonth', 'Προηγούμενος μήνας'],
  ['thisYear', 'Φέτος'],
  ['all', 'Από την αρχή'],
]

function inPeriod(dateKey: string, period: Period) {
  const today = todayKey()
  if (period === 'thisMonth') return dateKey.startsWith(today.slice(0, 7))
  if (period === 'lastMonth') return dateKey.startsWith(shiftMonth(today, -1).slice(0, 7))
  if (period === 'thisYear') return dateKey.startsWith(today.slice(0, 4))
  return true
}

function percent(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : '0%'
}

type Row = { key: string; name: string; count: number; revenue: number }

function BreakdownTable({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--admin-muted)]">Δεν υπάρχουν δεδομένα για την περίοδο.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--admin-muted)]">
              <th className="px-5 py-2.5 font-medium">Όνομα</th>
              <th className="px-5 py-2.5 text-right font-medium">Ραντεβού</th>
              <th className="px-5 py-2.5 text-right font-medium">Έσοδα</th>
              <th className="px-5 py-2.5 text-right font-medium">Μερίδιο</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-5 py-3 font-medium">{row.name}</td>
                <td className="px-5 py-3 text-right tabular-nums">{row.count}</td>
                <td className="px-5 py-3 text-right tabular-nums">{formatPrice(row.revenue)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-[var(--admin-muted)]">
                  {percent(row.revenue, total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

export function RevenuePage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('thisMonth')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setBookings(await adminFetch<Booking[]>('/api/admin/bookings'))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  const report = useMemo(() => {
    const now = new Date()
    const inRange = bookings.filter((b) => inPeriod(bookingDateKey(b), period))
    const billable = inRange.filter(isBillable)
    const earned = billable.filter((b) => new Date(b.startTime) <= now)
    const upcoming = billable.filter((b) => new Date(b.startTime) > now)
    const pastAll = inRange.filter((b) => new Date(b.startTime) <= now)
    const earnedTotal = earned.reduce((sum, b) => sum + b.service.price, 0)

    const group = (key: (b: Booking) => [string, string]) => {
      const map = new Map<string, Row>()
      for (const booking of earned) {
        const [id, name] = key(booking)
        const row = map.get(id) ?? { key: id, name, count: 0, revenue: 0 }
        row.count += 1
        row.revenue += booking.service.price
        map.set(id, row)
      }
      return [...map.values()].sort((a, b) => b.revenue - a.revenue)
    }

    return {
      earnedTotal,
      upcomingTotal: upcoming.reduce((sum, b) => sum + b.service.price, 0),
      earnedCount: earned.length,
      upcomingCount: upcoming.length,
      average: earned.length ? earnedTotal / earned.length : 0,
      cancelled: inRange.filter((b) => b.status === 'CANCELLED').length,
      noShows: pastAll.filter((b) => b.noShow).length,
      pastCount: pastAll.length,
      total: inRange.length,
      byBarber: group((b) => [b.barber.id, b.barber.name]),
      byService: group((b) => [b.service.id, b.service.name]),
    }
  }, [bookings, period])

  return (
    <>
      <PageHeader
        title="Έσοδα"
        description="Μετράνε τα ραντεβού που έγιναν: όχι οι ακυρώσεις και όσοι δεν ήρθαν."
        actions={
          <div className="inline-flex flex-wrap rounded-xl border border-[var(--admin-border)] bg-white p-0.5">
            {PERIODS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                aria-pressed={period === key}
                className={`h-8 rounded-[10px] px-3 text-[13px] font-medium transition-colors ${
                  period === key
                    ? 'bg-[var(--admin-text)] text-white'
                    : 'text-[var(--admin-muted)] hover:text-[var(--admin-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNotice message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : report.total === 0 ? (
        <EmptyState title="Δεν υπάρχουν ραντεβού σε αυτή την περίοδο." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Έσοδα"
              value={formatPrice(report.earnedTotal)}
              hint={`${report.earnedCount} ραντεβού που έγιναν`}
            />
            <StatCard
              label="Αναμενόμενα"
              value={formatPrice(report.upcomingTotal)}
              hint={`${report.upcomingCount} επερχόμενα ραντεβού`}
            />
            <StatCard label="Μέση αξία ραντεβού" value={formatPrice(Math.round(report.average * 100) / 100)} />
            <StatCard
              label="Ακυρώσεις / δεν ήρθαν"
              value={`${report.cancelled} / ${report.noShows}`}
              hint={`${percent(report.cancelled, report.total)} ακυρώσεις, ${percent(report.noShows, report.pastCount)} δεν ήρθαν`}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <BreakdownTable title="Ανά κουρέα" rows={report.byBarber} total={report.earnedTotal} />
            <BreakdownTable title="Ανά υπηρεσία" rows={report.byService} total={report.earnedTotal} />
          </div>
        </>
      )}
    </>
  )
}

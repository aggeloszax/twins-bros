'use client'

import { useEffect, useMemo, useState } from 'react'
import { normalizeGreekMobilePhone } from '@/lib/phone'
import {
  type Booking,
  adminFetch,
  bookingDateKey,
  errorMessage,
  formatDateKeyLong,
  formatDateShort,
  formatPhone,
  formatPrice,
  formatTime,
  getBookingState,
  isBillable,
} from '../_lib/admin-data'
import {
  AlertIcon,
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorNotice,
  MailIcon,
  PageHeader,
  PhoneIcon,
  SearchIcon,
  SelectInput,
  Skeleton,
  StatCard,
  StateBadge,
} from './ui'

type Customer = {
  key: string
  name: string
  phone: string
  email: string | null
  bookings: Booking[]
  visits: number
  noShows: number
  cancellations: number
  spent: number
  lastVisit: string | null
  nextBooking: string | null
}

type SortKey = 'recent' | 'name' | 'visits' | 'spent'

function buildCustomers(bookings: Booking[]): Customer[] {
  const now = new Date()
  const byKey = new Map<string, Booking[]>()
  for (const booking of bookings) {
    const phone = normalizeGreekMobilePhone(booking.customerPhone)
    const key = phone ?? `name:${booking.customerName.trim().toLocaleLowerCase('el')}`
    byKey.set(key, [...(byKey.get(key) ?? []), booking])
  }

  return Array.from(byKey, ([key, list]) => {
    const sorted = [...list].sort((a, b) => b.startTime.localeCompare(a.startTime))
    const past = sorted.filter((b) => new Date(b.startTime) <= now)
    const served = past.filter(isBillable)
    const upcoming = sorted
      .filter((b) => new Date(b.startTime) > now && b.status !== 'CANCELLED')
      .at(-1)
    return {
      key,
      name: sorted[0].customerName,
      phone: normalizeGreekMobilePhone(sorted[0].customerPhone) ?? sorted[0].customerPhone,
      email: sorted.find((b) => b.customerEmail)?.customerEmail ?? null,
      bookings: sorted,
      visits: served.length,
      noShows: sorted.filter((b) => b.noShow).length,
      cancellations: sorted.filter((b) => b.status === 'CANCELLED').length,
      spent: served.reduce((sum, b) => sum + b.service.price, 0),
      lastVisit: served[0]?.startTime ?? null,
      nextBooking: upcoming?.startTime ?? null,
    }
  })
}

function downloadCsv(customers: Customer[]) {
  const escape = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const rows = [
    ['Όνομα', 'Κινητό', 'Email', 'Επισκέψεις', 'Δεν ήρθε', 'Ακυρώσεις', 'Σύνολο €', 'Τελευταία επίσκεψη'],
    ...customers.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.visits,
      c.noShows,
      c.cancellations,
      c.spent,
      c.lastVisit ? bookingDateKey({ startTime: c.lastVisit }) : '',
    ]),
  ]
  // The BOM makes Excel read the Greek text as UTF-8.
  const csv = '﻿' + rows.map((row) => row.map(escape).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `pelates-${bookingDateKey({ startTime: new Date().toISOString() })}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function CustomersPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [openKey, setOpenKey] = useState<string | null>(null)

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

  const customers = useMemo(() => buildCustomers(bookings), [bookings])

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('el')
    const digits = term.replace(/\D/g, '')
    const list = customers.filter(
      (c) =>
        !term ||
        c.name.toLocaleLowerCase('el').includes(term) ||
        (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)) ||
        c.email?.toLowerCase().includes(term),
    )
    const sorters: Record<SortKey, (a: Customer, b: Customer) => number> = {
      recent: (a, b) => (b.bookings[0]?.startTime ?? '').localeCompare(a.bookings[0]?.startTime ?? ''),
      name: (a, b) => a.name.localeCompare(b.name, 'el'),
      visits: (a, b) => b.visits - a.visits,
      spent: (a, b) => b.spent - a.spent,
    }
    return [...list].sort(sorters[sort])
  }, [customers, query, sort])

  const openCustomer = customers.find((c) => c.key === openKey) ?? null
  const returning = customers.filter((c) => c.visits >= 2).length

  return (
    <>
      <PageHeader
        title="Πελάτες"
        description="Όλοι όσοι έχουν κλείσει ραντεβού, με το ιστορικό τους."
        actions={
          <Button onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
            Εξαγωγή CSV
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Πελάτες" value={String(customers.length)} />
        <StatCard
          label="Επαναλαμβανόμενοι"
          value={String(returning)}
          hint={customers.length ? `${Math.round((returning / customers.length) * 100)}% των πελατών` : undefined}
        />
        <StatCard
          label="Με «δεν ήρθε»"
          value={String(customers.filter((c) => c.noShows > 0).length)}
        />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNotice message={error} onRetry={() => void load()} />
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Αναζήτηση με όνομα, κινητό ή email"
              className="h-10 w-full rounded-xl border border-[var(--admin-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent-soft)]"
            />
          </div>
          <SelectInput
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="!mt-0 sm:w-56"
            aria-label="Ταξινόμηση"
          >
            <option value="recent">Πιο πρόσφατοι</option>
            <option value="name">Αλφαβητικά</option>
            <option value="visits">Περισσότερες επισκέψεις</option>
            <option value="spent">Μεγαλύτερη αξία</option>
          </SelectInput>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={query ? 'Κανένας πελάτης δεν ταιριάζει με την αναζήτηση.' : 'Δεν υπάρχουν πελάτες ακόμα.'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs text-[var(--admin-muted)]">
                  <th className="px-5 py-3 font-medium">Πελάτης</th>
                  <th className="px-5 py-3 font-medium">Κινητό</th>
                  <th className="px-5 py-3 text-right font-medium">Επισκέψεις</th>
                  <th className="px-5 py-3 text-right font-medium">Αξία</th>
                  <th className="px-5 py-3 font-medium">Τελευταία επίσκεψη</th>
                  <th className="px-5 py-3 font-medium">Επόμενο ραντεβού</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {filtered.map((customer) => (
                  <tr
                    key={customer.key}
                    onClick={() => setOpenKey(customer.key)}
                    className="cursor-pointer transition-colors hover:bg-[var(--admin-surface-2)]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{customer.name}</span>
                        {customer.noShows > 0 && (
                          <span
                            title={`Δεν ήρθε ${customer.noShows} φορές`}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                          >
                            <AlertIcon className="h-3 w-3" />
                            {customer.noShows}
                          </span>
                        )}
                      </div>
                      {customer.email && (
                        <p className="text-xs text-[var(--admin-muted)]">{customer.email}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{formatPhone(customer.phone)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{customer.visits}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatPrice(customer.spent)}</td>
                    <td className="px-5 py-3 text-[var(--admin-muted)]">
                      {customer.lastVisit ? formatDateShort(customer.lastVisit) : '—'}
                    </td>
                    <td className="px-5 py-3 text-[var(--admin-muted)]">
                      {customer.nextBooking
                        ? `${formatDateShort(customer.nextBooking)}, ${formatTime(customer.nextBooking)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {openCustomer && (
        <Drawer title={openCustomer.name} onClose={() => setOpenKey(null)}>
          <div className="space-y-2">
            <a
              href={`tel:${openCustomer.phone}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] px-3.5 py-2.5 text-sm hover:bg-[var(--admin-surface-2)]"
            >
              <PhoneIcon className="h-4 w-4 text-[var(--admin-muted)]" />
              <span className="font-medium">{formatPhone(openCustomer.phone)}</span>
            </a>
            {openCustomer.email && (
              <a
                href={`mailto:${openCustomer.email}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] px-3.5 py-2.5 text-sm hover:bg-[var(--admin-surface-2)]"
              >
                <MailIcon className="h-4 w-4 text-[var(--admin-muted)]" />
                <span className="truncate font-medium">{openCustomer.email}</span>
              </a>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)] text-center">
            {[
              ['Επισκέψεις', String(openCustomer.visits)],
              ['Αξία', formatPrice(openCustomer.spent)],
              ['Δεν ήρθε', String(openCustomer.noShows)],
            ].map(([label, value]) => (
              <div key={label} className="px-2 py-3">
                <p className="text-lg font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-[var(--admin-muted)]">{label}</p>
              </div>
            ))}
          </div>

          <p className="mb-2 mt-6 text-[13px] font-medium text-[var(--admin-muted)]">
            Ιστορικό ραντεβού
          </p>
          <ul className="divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)]">
            {openCustomer.bookings.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize">
                    {formatDateKeyLong(bookingDateKey(booking))}, {formatTime(booking.startTime)}
                  </p>
                  <p className="truncate text-xs text-[var(--admin-muted)]">
                    {booking.service.name} · {booking.barber.name} · {formatPrice(booking.service.price)}
                  </p>
                </div>
                <StateBadge state={getBookingState(booking)} />
              </li>
            ))}
          </ul>
        </Drawer>
      )}
    </>
  )
}

'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { normalizeGreekMobilePhone, toNationalPhoneInput } from '@/lib/phone'
import { EditableNote } from './editable-note'
import {
  type Booking,
  type CustomerProfile,
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
  BanIcon,
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorNotice,
  Field,
  FormError,
  MailIcon,
  Modal,
  NoteIcon,
  PageHeader,
  PhoneIcon,
  SearchIcon,
  SelectInput,
  Skeleton,
  StatCard,
  StateBadge,
  TextInput,
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
  profile: CustomerProfile | null
}

type SortKey = 'recent' | 'name' | 'visits' | 'spent'
type FilterKey = 'all' | 'notes' | 'noShows' | 'blocked'

function buildCustomers(bookings: Booking[], profiles: Map<string, CustomerProfile>): Customer[] {
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
      profile: profiles.get(sorted[0].customerPhone) ?? null,
    }
  })
}

function downloadCsv(customers: Customer[]) {
  const escape = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const rows = [
    ['Όνομα', 'Κινητό', 'Email', 'Επισκέψεις', 'Δεν ήρθε', 'Ακυρώσεις', 'Σύνολο €', 'Τελευταία επίσκεψη', 'Σημειώσεις', 'Μπλοκαρισμένος'],
    ...customers.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.visits,
      c.noShows,
      c.cancellations,
      c.spent,
      c.lastVisit ? bookingDateKey({ startTime: c.lastVisit }) : '',
      c.profile?.notes ?? '',
      c.profile?.blocked ? 'Ναι' : '',
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
  const [profiles, setProfiles] = useState<Map<string, CustomerProfile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [bookingList, profileList] = await Promise.all([
        adminFetch<Booking[]>('/api/admin/bookings'),
        adminFetch<CustomerProfile[]>('/api/admin/customers'),
      ])
      setBookings(bookingList)
      setProfiles(new Map(profileList.map((profile) => [profile.phone, profile])))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  const customers = useMemo(() => buildCustomers(bookings, profiles), [bookings, profiles])

  function saveProfile(profile: CustomerProfile) {
    setProfiles((current) => new Map(current).set(profile.phone, profile))
  }

  async function updateProfile(phone: string, changes: Partial<CustomerProfile>) {
    saveProfile(
      await adminFetch<CustomerProfile>('/api/admin/customers', {
        method: 'PATCH',
        body: JSON.stringify({ phone, ...changes }),
      }),
    )
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('el')
    const digits = term.replace(/\D/g, '')
    const filters: Record<FilterKey, (c: Customer) => boolean> = {
      all: () => true,
      notes: (c) => Boolean(c.profile?.notes),
      noShows: (c) => c.noShows > 0,
      blocked: (c) => Boolean(c.profile?.blocked),
    }
    const list = customers.filter(
      (c) =>
        filters[filter](c) &&
        (!term ||
          c.name.toLocaleLowerCase('el').includes(term) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)) ||
          c.email?.toLowerCase().includes(term)),
    )
    const sorters: Record<SortKey, (a: Customer, b: Customer) => number> = {
      recent: (a, b) => (b.bookings[0]?.startTime ?? '').localeCompare(a.bookings[0]?.startTime ?? ''),
      name: (a, b) => a.name.localeCompare(b.name, 'el'),
      visits: (a, b) => b.visits - a.visits,
      spent: (a, b) => b.spent - a.spent,
    }
    return [...list].sort(sorters[sort])
  }, [customers, query, sort, filter])

  const openCustomer = customers.find((c) => c.key === openKey) ?? null
  const returning = customers.filter((c) => c.visits >= 2).length

  return (
    <>
      <PageHeader
        title="Πελάτες"
        description="Όλοι όσοι έχουν κλείσει ραντεβού, με το ιστορικό και τις σημειώσεις τους."
        actions={
          <Button onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
            Εξαγωγή CSV
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <StatCard
          label="Μπλοκαρισμένοι"
          value={String(customers.filter((c) => c.profile?.blocked).length)}
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
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterKey)}
            className="!mt-0 sm:w-48"
            aria-label="Φίλτρο"
          >
            <option value="all">Όλοι οι πελάτες</option>
            <option value="notes">Με σημειώσεις</option>
            <option value="noShows">Με «δεν ήρθε»</option>
            <option value="blocked">Μπλοκαρισμένοι</option>
          </SelectInput>
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
              title={
                query || filter !== 'all'
                  ? 'Κανένας πελάτης δεν ταιριάζει με την αναζήτηση.'
                  : 'Δεν υπάρχουν πελάτες ακόμα.'
              }
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
                        {customer.profile?.blocked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            <BanIcon className="h-3 w-3" />
                            Μπλοκαρισμένος
                          </span>
                        )}
                        {customer.noShows > 0 && (
                          <span
                            title={`Δεν ήρθε ${customer.noShows} φορές`}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                          >
                            <AlertIcon className="h-3 w-3" />
                            {customer.noShows}
                          </span>
                        )}
                        {customer.profile?.notes && (
                          <span title={customer.profile.notes} className="text-[var(--admin-muted)]">
                            <NoteIcon className="h-3.5 w-3.5" />
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
        <Drawer
          title={openCustomer.name}
          onClose={() => setOpenKey(null)}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <BlockControl
                key={openCustomer.key}
                profile={openCustomer.profile}
                onChange={(changes) => updateProfile(openCustomer.phone, changes)}
              />
              <Button size="sm" onClick={() => setEditing(true)}>
                Επεξεργασία στοιχείων
              </Button>
            </div>
          }
        >
          {openCustomer.profile?.blocked && (
            <div className="mb-4 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
              <BanIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Μπλοκαρισμένος.</strong> Δεν μπορεί να κλείσει online, μόνο εσύ από το πρόγραμμα
                {openCustomer.profile.blockedReason ? `. Αιτία: ${openCustomer.profile.blockedReason}` : '.'}
              </span>
            </div>
          )}

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

          <div className="mt-6">
            <EditableNote
              key={openCustomer.key}
              label="Σημειώσεις"
              value={openCustomer.profile?.notes ?? null}
              emptyText="Καμία σημείωση. Φαίνονται σε κάθε ραντεβού του πελάτη."
              placeholder="π.χ. Κούρεμα με 2 στα πλάγια, αλλεργία σε…"
              maxLength={1000}
              onSave={(notes) => updateProfile(openCustomer.phone, { notes })}
            />
          </div>

          <p className="mb-2 mt-6 text-[13px] font-medium text-[var(--admin-muted)]">
            Ιστορικό ραντεβού
          </p>
          <ul className="divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)]">
            {openCustomer.bookings.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {formatDateKeyLong(bookingDateKey(booking))}, {formatTime(booking.startTime)}
                  </p>
                  <p className="truncate text-xs text-[var(--admin-muted)]">
                    {booking.service.name} · {booking.barber.name} · {formatPrice(booking.service.price)}
                  </p>
                  {booking.notes && (
                    <p className="mt-0.5 truncate text-xs italic text-[var(--admin-muted)]">
                      «{booking.notes}»
                    </p>
                  )}
                </div>
                <StateBadge state={getBookingState(booking)} />
              </li>
            ))}
          </ul>
        </Drawer>
      )}

      {openCustomer && editing && (
        <EditCustomerModal
          customer={openCustomer}
          onClose={() => setEditing(false)}
          onSaved={async (profile) => {
            saveProfile(profile)
            setEditing(false)
            setOpenKey(profile.phone)
            await load()
          }}
        />
      )}
    </>
  )
}

function BlockControl({
  profile,
  onChange,
}: {
  profile: CustomerProfile | null
  onChange: (changes: Partial<CustomerProfile>) => Promise<void>
}) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply(changes: Partial<CustomerProfile>) {
    setBusy(true)
    setError(null)
    try {
      await onChange(changes)
      setAsking(false)
      setReason('')
    } catch (changeError) {
      setError(errorMessage(changeError))
    } finally {
      setBusy(false)
    }
  }

  if (profile?.blocked) {
    return (
      <div>
        <Button size="sm" disabled={busy} onClick={() => void apply({ blocked: false })}>
          Ξεμπλοκάρισμα
        </Button>
        <FormError message={error} />
      </div>
    )
  }

  if (!asking) {
    return (
      <Button size="sm" variant="danger" onClick={() => setAsking(true)}>
        <BanIcon className="h-3.5 w-3.5" />
        Μπλοκάρισμα
      </Button>
    )
  }

  return (
    <div className="w-full space-y-2">
      <TextInput
        autoFocus
        maxLength={200}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Αιτία (προαιρετικό), π.χ. δεν ήρθε 3 φορές"
        className="!mt-0"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => void apply({ blocked: true, blockedReason: reason.trim() || null })}
        >
          Επιβεβαίωση μπλοκαρίσματος
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
          Άκυρο
        </Button>
      </div>
      <FormError message={error} />
    </div>
  )
}

function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer
  onClose: () => void
  onSaved: (profile: CustomerProfile) => Promise<void>
}) {
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(toNationalPhoneInput(customer.phone))
  const [email, setEmail] = useState(customer.email ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Συμπλήρωσε όνομα.')
    if (!normalizeGreekMobilePhone(phone)) return setError('Συμπλήρωσε έγκυρο κινητό (69xxxxxxxx).')

    setSaving(true)
    setError(null)
    try {
      const profile = await adminFetch<CustomerProfile>('/api/admin/customers', {
        method: 'PATCH',
        body: JSON.stringify({
          phone: customer.phone,
          name: name.trim(),
          newPhone: phone,
          email: email.trim() || null,
        }),
      })
      await onSaved(profile)
    } catch (saveError) {
      setError(errorMessage(saveError))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Στοιχεία πελάτη"
      description={`Οι αλλαγές περνάνε σε όλα τα ραντεβού του πελάτη (${customer.bookings.length}).`}
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel="Αποθήκευση"
      submitting={saving}
    >
      <Field label="Ονοματεπώνυμο">
        <TextInput value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Κινητό">
        <TextInput
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(event) => setPhone(toNationalPhoneInput(event.target.value))}
        />
      </Field>
      <Field label="Email" hint="Προαιρετικό.">
        <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <FormError message={error} />
    </Modal>
  )
}

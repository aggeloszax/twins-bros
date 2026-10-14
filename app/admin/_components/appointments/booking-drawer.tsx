'use client'

import { useState } from 'react'
import { EditableNote } from '../editable-note'
import {
  type Booking,
  type BookingStatus,
  type CustomerProfile,
  adminFetch,
  bookingDateKey,
  errorMessage,
  formatDateKeyLong,
  formatPhone,
  formatPrice,
  formatTime,
  getBookingState,
  minutesOfDay,
} from '../../_lib/admin-data'
import {
  AlertIcon,
  Button,
  ClockIcon,
  ConfirmButton,
  Drawer,
  FormError,
  MailIcon,
  PhoneIcon,
  ScissorsIcon,
  StateBadge,
  UserIcon,
} from '../ui'

type BookingUpdate = { status?: BookingStatus; noShow?: boolean; notes?: string | null }

export function BookingDrawer({
  booking,
  allBookings,
  onClose,
  onUpdated,
  onDeleted,
  onBookAgain,
  onReschedule,
}: {
  booking: Booking
  allBookings: Booking[]
  onClose: () => void
  onUpdated: (booking: Booking) => void
  onDeleted: (id: string) => void
  onBookAgain: (booking: Booking) => void
  onReschedule: (booking: Booking) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const state = getBookingState(booking)

  // A cancelled booking can only come back if its time is still free.
  const restoreBlocked = allBookings.some((other) => {
    if (other.id === booking.id || other.status === 'CANCELLED') return false
    if (other.barber.id !== booking.barber.id) return false
    if (bookingDateKey(other) !== bookingDateKey(booking)) return false
    const start = minutesOfDay(booking.startTime)
    const otherStart = minutesOfDay(other.startTime)
    return start < otherStart + other.service.duration && otherStart < start + booking.service.duration
  })

  async function saveCustomerNotes(notes: string | null) {
    const customer = await adminFetch<CustomerProfile>('/api/admin/customers', {
      method: 'PATCH',
      body: JSON.stringify({ phone: booking.customerPhone, notes }),
    })
    onUpdated({ ...booking, customer })
  }

  async function saveBookingNotes(notes: string | null) {
    const updated = await adminFetch<Booking>(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    })
    onUpdated(updated)
  }

  async function update(changes: BookingUpdate) {
    setBusy(true)
    setError(null)
    try {
      const updated = await adminFetch<Booking>(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      onUpdated(updated)
    } catch (updateError) {
      setError(errorMessage(updateError))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await adminFetch(`/api/admin/bookings/${booking.id}`, { method: 'DELETE' })
      onDeleted(booking.id)
    } catch (deleteError) {
      setError(errorMessage(deleteError))
      setBusy(false)
    }
  }

  const rows = [
    {
      icon: <ClockIcon className="h-4 w-4" />,
      label: formatDateKeyLong(bookingDateKey(booking)),
      detail: `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`,
    },
    {
      icon: <ScissorsIcon className="h-4 w-4" />,
      label: booking.service.name,
      detail: `${booking.service.duration} λεπτά · ${formatPrice(booking.service.price)}`,
    },
    {
      icon: <UserIcon className="h-4 w-4" />,
      label: booking.barber.name,
      detail: 'Κουρέας',
    },
  ]

  return (
    <Drawer
      title="Ραντεβού"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ConfirmButton
            label="Οριστική διαγραφή"
            confirmLabel="Σίγουρα διαγραφή;"
            busy={busy}
            onConfirm={() => void remove()}
          />
          <Button size="sm" onClick={() => onBookAgain(booking)}>
            Νέο ραντεβού για τον πελάτη
          </Button>
        </div>
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold tracking-tight">{booking.customerName}</p>
          <div className="mt-2">
            <StateBadge state={state} />
          </div>
        </div>
      </div>

      {booking.customer?.blocked && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Μπλοκαρισμένος πελάτης.</strong> Δεν μπορεί να κλείσει online
            {booking.customer.blockedReason ? `. Αιτία: ${booking.customer.blockedReason}` : '.'}
          </span>
        </div>
      )}

      {booking.noShowCount > 0 && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Ο πελάτης δεν ήρθε σε{' '}
            <strong>{booking.noShowCount === 1 ? '1 ραντεβού' : `${booking.noShowCount} ραντεβού`}</strong>{' '}
            στο παρελθόν.
          </span>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <a
          href={`tel:${booking.customerPhone}`}
          className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--admin-surface-2)]"
        >
          <PhoneIcon className="h-4 w-4 text-[var(--admin-muted)]" />
          <span className="font-medium">{formatPhone(booking.customerPhone)}</span>
        </a>
        {booking.customerEmail && (
          <a
            href={`mailto:${booking.customerEmail}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--admin-surface-2)]"
          >
            <MailIcon className="h-4 w-4 text-[var(--admin-muted)]" />
            <span className="truncate font-medium">{booking.customerEmail}</span>
          </a>
        )}
      </div>

      <dl className="mt-6 divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)]">
        {rows.map((row) => (
          <div key={row.detail} className="flex items-start gap-3 px-3.5 py-3">
            <span className="mt-0.5 text-[var(--admin-muted)]">{row.icon}</span>
            <div>
              <dt className="text-sm font-medium">{row.label}</dt>
              <dd className="text-[13px] text-[var(--admin-muted)]">{row.detail}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="mt-6 space-y-5">
        <EditableNote
          label="Σχόλιο ραντεβού"
          value={booking.notes}
          emptyText="Χωρίς σχόλιο."
          maxLength={500}
          onSave={saveBookingNotes}
        />
        <EditableNote
          label="Σημειώσεις πελάτη"
          value={booking.customer?.notes ?? null}
          emptyText="Καμία σημείωση. Φαίνονται σε κάθε ραντεβού του πελάτη."
          placeholder="π.χ. Κούρεμα με 2 στα πλάγια, αλλεργία σε…"
          maxLength={1000}
          onSave={saveCustomerNotes}
        />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[13px] font-medium text-[var(--admin-muted)]">Ενέργειες</p>
        <div className="flex flex-wrap gap-2">
          {state === 'upcoming' && (
            <>
              <Button size="sm" variant="primary" disabled={busy} onClick={() => void update({ status: 'COMPLETED' })}>
                Ολοκληρώθηκε
              </Button>
              <ConfirmButton
                label="Ακύρωση ραντεβού"
                confirmLabel="Επιβεβαίωση ακύρωσης"
                busy={busy}
                onConfirm={() => void update({ status: 'CANCELLED' })}
              />
            </>
          )}
          {state !== 'cancelled' && (
            <Button size="sm" disabled={busy} onClick={() => onReschedule(booking)}>
              Μετακίνηση
            </Button>
          )}
          {(state === 'upcoming' || state === 'completed') && (
            <Button size="sm" disabled={busy} onClick={() => void update({ noShow: true })}>
              Δεν ήρθε
            </Button>
          )}
          {state === 'noShow' && (
            <Button size="sm" disabled={busy} onClick={() => void update({ noShow: false })}>
              Αναίρεση «δεν ήρθε»
            </Button>
          )}
          {state === 'cancelled' && (
            <Button
              size="sm"
              disabled={busy || restoreBlocked}
              title={restoreBlocked ? 'Η ώρα έχει πια άλλο ραντεβού.' : undefined}
              onClick={() => void update({ status: 'PENDING' })}
            >
              Επαναφορά ραντεβού
            </Button>
          )}
        </div>
        {state === 'cancelled' && restoreBlocked && (
          <p className="mt-2 text-xs text-[var(--admin-muted)]">
            Δεν γίνεται επαναφορά: η ώρα έχει πια άλλο ραντεβού.
          </p>
        )}
      </div>

      <div className="mt-4">
        <FormError message={error} />
      </div>
    </Drawer>
  )
}

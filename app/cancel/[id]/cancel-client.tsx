'use client'

import { useEffect, useState, useTransition } from 'react'
import { BOOKING_LOCALE } from '@/lib/schedule'
import { cancelBooking, rescheduleBooking } from './actions'

export type BookingDetails = {
  service: string
  barber: string
  date: string
  time: string
  customerName: string
}

type Slot = { time: string; available: boolean }
type Mode = 'view' | 'reschedule' | 'cancel'

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  )
}

const detailRows: { label: string; key: keyof BookingDetails }[] = [
  { label: 'Πελάτης', key: 'customerName' },
  { label: 'Υπηρεσία', key: 'service' },
  { label: 'Barber', key: 'barber' },
  { label: 'Ημερομηνία', key: 'date' },
  { label: 'Ώρα', key: 'time' },
]

function dayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  return {
    weekday: date.toLocaleDateString(BOOKING_LOCALE, { weekday: 'short' }),
    day: date.getDate(),
    month: date.toLocaleDateString(BOOKING_LOCALE, { month: 'short' }),
    long: date.toLocaleDateString(BOOKING_LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

function SuccessMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="animate-fade-in text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
        <CheckIcon className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-500">{text}</p>
    </div>
  )
}

export function CancelClient({
  id,
  token,
  details,
  brandColor,
  barberId,
  serviceId,
  bookableDays,
  currentDateKey,
  currentTime,
}: {
  id: string
  token: string
  details: BookingDetails
  brandColor: string
  barberId: string
  serviceId: string
  bookableDays: string[]
  currentDateKey: string
  currentTime: string
}) {
  const [mode, setMode] = useState<Mode>('view')
  const [isPending, startTransition] = useTransition()
  const [cancelled, setCancelled] = useState(false)
  const [moved, setMoved] = useState<{ date: string; time: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [day, setDay] = useState<string | null>(
    bookableDays.includes(currentDateKey) ? currentDateKey : (bookableDays[0] ?? null),
  )
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'reschedule' || !day) return
    const controller = new AbortController()
    const params = new URLSearchParams({ barberId, serviceId, date: day, exclude: id, token })
    queueMicrotask(() => {
      setLoadingSlots(true)
      setTime(null)
    })
    fetch(`/api/available-slots?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Slot[]>) : []))
      .then((data) => setSlots(data))
      .catch(() => {
        if (!controller.signal.aborted) setSlots([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false)
      })
    return () => controller.abort()
  }, [mode, day, barberId, serviceId, id, token])

  const isCurrent = (slot: string) => day === currentDateKey && slot === currentTime
  const freeSlots = slots.filter((slot) => slot.available && !isCurrent(slot.time))

  function handleCancel() {
    setError(null)
    startTransition(async () => {
      const result = await cancelBooking(id, token)
      if (result.ok || result.reason === 'already-cancelled') {
        setCancelled(true)
      } else if (result.reason === 'too-late') {
        setError(
          'Το χρονικό περιθώριο ακύρωσης έχει παρέλθει. Παρακαλώ καλέστε στο μαγαζί για αλλαγές τελευταίας στιγμής.',
        )
      } else if (result.reason === 'not-found') {
        setError('Το ραντεβού δεν βρέθηκε. Ίσως έχει ήδη ακυρωθεί.')
      } else {
        setError('Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά σε λίγο.')
      }
    })
  }

  function handleReschedule() {
    if (!day || !time) return
    setError(null)
    startTransition(async () => {
      const result = await rescheduleBooking(id, token, day, time)
      if (result.ok) {
        setMoved({ date: result.date, time: result.time })
      } else if (result.reason === 'unavailable') {
        setError('Η ώρα αυτή μόλις κλείστηκε. Διάλεξε άλλη.')
        setSlots((current) => current.map((slot) => (slot.time === time ? { ...slot, available: false } : slot)))
        setTime(null)
      } else if (result.reason === 'too-late') {
        setError('Δεν γίνεται πια αλλαγή online. Παρακαλώ καλέστε στο μαγαζί.')
      } else if (result.reason === 'not-found' || result.reason === 'already-cancelled') {
        setError('Το ραντεβού δεν βρέθηκε. Ίσως έχει ακυρωθεί.')
      } else {
        setError('Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά σε λίγο.')
      }
    })
  }

  if (cancelled) {
    return (
      <SuccessMessage
        title="Το ραντεβού σας ακυρώθηκε με επιτυχία."
        text="Ελπίζουμε να σας δούμε σύντομα ξανά. Μπορείτε να κλείσετε νέο ραντεβού όποτε θέλετε."
      />
    )
  }

  if (moved) {
    return (
      <SuccessMessage
        title="Το ραντεβού σας άλλαξε."
        text={`Σας περιμένουμε ${dayLabel(moved.date).long} στις ${moved.time}, με τον ${details.barber}. Αν δώσατε email, θα λάβετε τα νέα στοιχεία.`}
      />
    )
  }

  const primaryButton =
    'mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-white transition-all duration-300 ease-in-out hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
  const secondaryButton =
    'flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--page-border)] px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50'

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        {mode === 'reschedule' ? 'Αλλαγή ώρας' : mode === 'cancel' ? 'Ακύρωση ραντεβού' : 'Το ραντεβού σας'}
      </h1>
      <p className="mt-2 text-sm leading-6 text-neutral-500">
        {mode === 'reschedule'
          ? `Διαλέξτε νέα ημέρα και ώρα με τον ${details.barber}.`
          : mode === 'cancel'
            ? 'Ελέγξτε τα στοιχεία του ραντεβού σας πριν την ακύρωση.'
            : 'Μπορείτε να αλλάξετε την ώρα ή να ακυρώσετε έως και 2,5 ώρες πριν.'}
      </p>

      {mode !== 'reschedule' && (
        <dl className="mt-6 space-y-3 rounded-3xl border border-[var(--page-border)] bg-[var(--page-bg)] p-4 text-left text-sm">
          {detailRows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">{row.label}</dt>
              <dd className="text-right font-medium text-neutral-900">{details[row.key]}</dd>
            </div>
          ))}
        </dl>
      )}

      {mode === 'reschedule' && (
        <div className="mt-6">
          <p className="text-xs text-neutral-500">
            Τρέχον ραντεβού: {details.date}, {details.time}
          </p>
          {bookableDays.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">Δεν υπάρχουν διαθέσιμες ημέρες αυτή τη στιγμή.</p>
          ) : (
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2">
              {bookableDays.map((key) => {
                const label = dayLabel(key)
                const selected = key === day
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDay(key)}
                    aria-pressed={selected}
                    className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 text-xs transition ${
                      selected ? 'border-transparent text-white' : 'border-[var(--page-border)] text-neutral-600 hover:bg-neutral-50'
                    }`}
                    style={selected ? { backgroundColor: brandColor } : undefined}
                  >
                    <span className="capitalize opacity-80">{label.weekday}</span>
                    <span className="text-lg font-bold">{label.day}</span>
                    <span className="opacity-70">{label.month}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-4 min-h-24">
            {loadingSlots ? (
              <p className="text-sm text-neutral-500">Φόρτωση ωρών…</p>
            ) : day && freeSlots.length === 0 ? (
              <p className="text-sm text-neutral-500">Δεν υπάρχουν ελεύθερες ώρες αυτή την ημέρα.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {freeSlots.map((slot) => {
                  const selected = slot.time === time
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setTime(slot.time)}
                      aria-pressed={selected}
                      className={`rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition ${
                        selected ? 'border-transparent text-white' : 'border-[var(--page-border)] text-neutral-900 hover:bg-neutral-50'
                      }`}
                      style={selected ? { backgroundColor: brandColor } : undefined}
                    >
                      {slot.time}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {mode === 'view' && (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => setMode('reschedule')}
            className={`${primaryButton} !mt-0`}
            style={{ backgroundColor: brandColor }}
          >
            Αλλαγή ώρας
          </button>
          <button type="button" onClick={() => setMode('cancel')} className={secondaryButton}>
            Ακύρωση ραντεβού
          </button>
        </div>
      )}

      {mode === 'reschedule' && (
        <>
          <button
            type="button"
            onClick={handleReschedule}
            disabled={isPending || !day || !time}
            className={primaryButton}
            style={{ backgroundColor: brandColor }}
          >
            {isPending
              ? 'Γίνεται αλλαγή…'
              : time && day
                ? `Αλλαγή σε ${dayLabel(day).long}, ${time}`
                : 'Διαλέξτε ώρα'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('view')
              setError(null)
            }}
            className={`${secondaryButton} mt-3`}
          >
            Πίσω
          </button>
        </>
      )}

      {mode === 'cancel' && (
        <>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className={primaryButton}
            style={{ backgroundColor: brandColor }}
          >
            {isPending ? 'Γίνεται ακύρωση…' : 'Επιβεβαίωση Ακύρωσης Ραντεβού'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('view')
              setError(null)
            }}
            className={`${secondaryButton} mt-3`}
          >
            Πίσω
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-neutral-9000">
            Η ενέργεια αυτή είναι οριστική και δεν μπορεί να αναιρεθεί.
          </p>
        </>
      )}
    </div>
  )
}

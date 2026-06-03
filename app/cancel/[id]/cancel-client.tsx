'use client'

import { useState, useTransition } from 'react'
import { cancelBooking } from './actions'

export type BookingDetails = {
  service: string
  barber: string
  date: string
  time: string
  customerName: string
}

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

export function CancelClient({
  id,
  token,
  details,
}: {
  id: string
  token: string
  details: BookingDetails
}) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCancel() {
    setError(null)
    startTransition(async () => {
      const result = await cancelBooking(id, token)
      if (result.ok) {
        setDone(true)
        return
      }
      if (result.reason === 'too-late') {
        setError(
          'Το χρονικό περιθώριο ακύρωσης έχει παρέλθει. Παρακαλώ καλέστε στο μαγαζί για αλλαγές τελευταίας στιγμής.',
        )
      } else if (result.reason === 'not-found') {
        setError('Το ραντεβού δεν βρέθηκε — ίσως έχει ήδη ακυρωθεί.')
      } else {
        setError('Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά σε λίγο.')
      }
    })
  }

  if (done) {
    return (
      <div className="animate-fade-in text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
          <CheckIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-50">
          Το ραντεβού σας ακυρώθηκε με επιτυχία.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Ελπίζουμε να σας δούμε σύντομα ξανά. Μπορείτε να κλείσετε νέο ραντεβού
          όποτε θέλετε.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
        Ακύρωση ραντεβού
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Ελέγξτε τα στοιχεία του ραντεβού σας πριν την ακύρωση.
      </p>

      <dl className="mt-6 space-y-3 rounded-3xl border border-white/10 bg-black/45 p-4 text-left text-sm">
        {detailRows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-3"
          >
            <dt className="text-zinc-400">{row.label}</dt>
            <dd className="text-right font-medium text-zinc-50">
              {details[row.key]}
            </dd>
          </div>
        ))}
      </dl>

      {error && (
        <div className="mt-5 rounded-3xl border border-[#ff1f2d]/50 bg-[#ff1f2d]/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff1f2d] px-6 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_rgba(255,31,45,0.22)] transition-all duration-300 ease-in-out hover:bg-[#d80d19] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[#ff1f2d]"
      >
        {isPending ? 'Γίνεται ακύρωση…' : 'Επιβεβαίωση Ακύρωσης Ραντεβού'}
      </button>
      <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
        Η ενέργεια αυτή είναι οριστική και δεν μπορεί να αναιρεθεί.
      </p>
    </div>
  )
}

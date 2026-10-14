'use client'

import { useEffect, useState } from 'react'
import { type WorkingPeriod, WORKING_PERIODS, timeToMinutes, minutesToTime } from '@/lib/schedule'
import { SHOP } from '@/lib/shop'

type Photo = { id: string; url: string; caption: string | null }

// Monday first, as Greek calendars show the week.
const WEEK = [
  { day: 1, label: 'Δευτέρα' },
  { day: 2, label: 'Τρίτη' },
  { day: 3, label: 'Τετάρτη' },
  { day: 4, label: 'Πέμπτη' },
  { day: 5, label: 'Παρασκευή' },
  { day: 6, label: 'Σάββατο' },
  { day: 0, label: 'Κυριακή' },
]

// The shop is open on a day from the first barber in to the last one out.
function shopHours(schedules: (WorkingPeriod[] | null)[]) {
  const all = (schedules.length ? schedules : [null]).flatMap((schedule) => schedule ?? WORKING_PERIODS)
  return WEEK.map(({ day, label }) => {
    const periods = all.filter((period) => period.dayOfWeek === day)
    const starts = periods.flatMap((period) => timeToMinutes(period.startTime) ?? [])
    const ends = periods.flatMap((period) => timeToMinutes(period.endTime) ?? [])
    if (starts.length === 0 || ends.length === 0) return { day, label, hours: null }
    const open = Math.min(...starts)
    const close = Math.max(...ends)
    return { day, label, hours: `${minutesToTime(open)} – ${minutesToTime(close)}` }
  })
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function ShopInfo({ schedules }: { schedules: (WorkingPeriod[] | null)[] }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [today, setToday] = useState<number | null>(null)

  useEffect(() => {
    queueMicrotask(() => setToday(new Date().getDay()))
    fetch('/api/gallery')
      .then((res) => (res.ok ? (res.json() as Promise<Photo[]>) : []))
      .then(setPhotos)
      .catch(() => setPhotos([]))
  }, [])

  const hours = shopHours(schedules)
  const mapQuery = encodeURIComponent(`${SHOP.address}, Ελλάδα`)

  return (
    <section aria-labelledby="shop-info-title" className="mt-14">
      <h2 id="shop-info-title" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
        Το μαγαζί
      </h2>

      {photos.length > 0 && (
        <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {photos.map((photo) => (
            // Plain img: photos are already sized on upload and cached forever.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.caption ?? `${SHOP.name}`}
              loading="lazy"
              className="h-56 w-auto max-w-[85%] shrink-0 snap-start rounded-2xl border border-neutral-200 object-cover sm:h-64"
            />
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <iframe
            title={`Χάρτης: ${SHOP.address}`}
            src={`https://maps.google.com/maps?q=${mapQuery}&z=16&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-52 w-full border-0"
          />
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
              <p className="text-sm font-semibold text-neutral-900">{SHOP.address}</p>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              Οδηγίες
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-neutral-900">Ωράριο</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              {hours.map((row) => (
                <div
                  key={row.day}
                  className={`flex justify-between gap-3 ${row.day === today ? 'font-bold text-neutral-900' : 'text-neutral-600'}`}
                >
                  <dt>{row.label}</dt>
                  <dd className="tabular-nums">{row.hours ?? 'Κλειστά'}</dd>
                </div>
              ))}
            </dl>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href={SHOP.phone.href}
              className="flex items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white px-6 py-4 text-sm font-semibold text-neutral-900 shadow-sm transition hover:border-[var(--brand)]"
            >
              <PhoneIcon className="h-5 w-5 text-[var(--brand)]" />
              {SHOP.phone.label}
            </a>
          </div>
    </section>
  )
}

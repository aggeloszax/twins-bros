'use client'

import { useEffect, useRef, useState } from 'react'
import { type WorkingPeriod, WORKING_PERIODS, timeToMinutes, minutesToTime } from '@/lib/schedule'
import { SHOP } from '@/lib/shop'
import { SocialLinks } from './social-links'

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
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const photoDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!selectedPhoto) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedPhoto])

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
    <>
      <section aria-label="Πληροφορίες καταστήματος" className="mt-14 border-t border-[var(--page-border)] pt-8">
        <div className={`grid gap-6 md:items-stretch ${photos.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {photos.length > 0 && (
            <div aria-labelledby="shop-work-title" className="flex flex-col">
              <h2 id="shop-work-title" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Η δουλειά μας
              </h2>
              <div className="mt-4 flex-1 rounded-2xl border border-[var(--page-border)] bg-white p-3 shadow-sm">
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, 9).map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => {
                        setSelectedPhoto(photo)
                        photoDialogRef.current?.showModal()
                      }}
                      aria-label={`Μεγαλύτερη προβολή: ${photo.caption || `κούρεμα ${index + 1}`}`}
                      aria-haspopup="dialog"
                      className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--page-border)] bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
                    >
                      {/* Photos are already resized on upload. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption || `Κούρεμα από την ομάδα του ${SHOP.name}, φωτογραφία ${index + 1}`}
                        loading="lazy"
                        width={400}
                        height={400}
                        className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
                      />
                    </button>
                  ))}
                </div>
                <SocialLinks className="mt-3 justify-center" />
              </div>
            </div>
          )}

          <div aria-labelledby="shop-info-title" className="flex flex-col">
            <h2 id="shop-info-title" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Το μαγαζί
            </h2>
            <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--page-border)] bg-white shadow-sm">
              <iframe
                title={`Χάρτης: ${SHOP.address}`}
                src={`https://maps.google.com/maps?q=${mapQuery}&z=16&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-48 w-full flex-1 border-0"
              />
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-2">
                  <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
                  <p className="text-sm font-semibold text-neutral-900">{SHOP.address}</p>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full border border-[var(--page-border)] px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  Οδηγίες
                </a>
              </div>
            </div>
          </div>

          <div aria-labelledby="shop-hours-title" className="flex flex-col">
            <h2 id="shop-hours-title" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Ωράριο
            </h2>
            <div className="mt-4 flex flex-1 flex-col rounded-2xl border border-[var(--page-border)] bg-white p-4 shadow-sm">
              <dl className="space-y-2 text-sm">
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
              <a
                href={SHOP.phone.href}
                className="mt-5 flex items-center justify-center gap-2 rounded-full border border-[var(--page-border)] px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                <PhoneIcon className="h-4 w-4 text-[var(--brand)]" />
                {SHOP.phone.label}
              </a>
            </div>
          </div>
        </div>
      </section>

      <dialog
        ref={photoDialogRef}
        aria-labelledby="shop-photo-title"
        onClose={() => setSelectedPhoto(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) photoDialogRef.current?.close()
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[432px] overflow-y-auto rounded-2xl border border-[var(--page-border)] bg-white p-4 text-neutral-900 shadow-2xl backdrop:bg-black/70"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="shop-photo-title" className="text-sm font-semibold">Η δουλειά μας · {SHOP.name}</h2>
          <button
            type="button"
            onClick={() => photoDialogRef.current?.close()}
            aria-label="Κλείσιμο φωτογραφίας"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        {selectedPhoto && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedPhoto.url} alt={selectedPhoto.caption || `Κούρεμα από την ομάδα του ${SHOP.name}`} width={400} height={400} className="mx-auto h-auto max-h-[65dvh] w-full rounded-xl object-contain" />
            {selectedPhoto.caption && <figcaption className="mt-3 text-center text-sm text-neutral-600">{selectedPhoto.caption}</figcaption>}
          </figure>
        )}
      </dialog>
    </>
  )
}

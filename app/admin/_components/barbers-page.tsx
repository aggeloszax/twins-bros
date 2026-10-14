'use client'

import Image from 'next/image'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  type Barber,
  type Booking,
  adminFetch,
  bookingDateKey,
  buildMonthGrid,
  errorMessage,
  formatPrice,
  isBillable,
  summarizeSchedule,
  todayKey,
} from '../_lib/admin-data'
import { WORKING_PERIODS } from '@/lib/schedule'
import { BarberScheduleModal } from './barber-schedule-modal'
import {
  Avatar,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorNotice,
  Field,
  FormError,
  Modal,
  PageHeader,
  PlusIcon,
  Skeleton,
  TextInput,
} from './ui'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const MAX_DIMENSION = 900

// Downscales the photo in the browser so uploads stay small.
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas is not available'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.84))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image could not be loaded'))
    }
    img.src = objectUrl
  })
}

type Editing =
  | { mode: 'create' }
  | { mode: 'photo'; barber: Barber }
  | { mode: 'schedule'; barber: Barber }

export function BarbersPage() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [monthBookings, setMonthBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const month = todayKey()
    const grid = buildMonthGrid(month)
    try {
      const [barberList, bookings] = await Promise.all([
        adminFetch<Barber[]>('/api/barbers'),
        adminFetch<Booking[]>(`/api/admin/bookings?from=${grid[0]}&to=${grid[41]}`),
      ])
      setBarbers(barberList)
      setMonthBookings(bookings.filter(isBillable))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  const statsByBarber = useMemo(() => {
    const month = todayKey().slice(0, 7)
    const stats = new Map<string, { count: number; revenue: number }>()
    for (const booking of monthBookings) {
      if (!bookingDateKey(booking).startsWith(month)) continue
      const entry = stats.get(booking.barber.id) ?? { count: 0, revenue: 0 }
      entry.count += 1
      entry.revenue += booking.service.price
      stats.set(booking.barber.id, entry)
    }
    return stats
  }, [monthBookings])

  async function handleDelete(barber: Barber) {
    setDeletingId(barber.id)
    setError(null)
    try {
      await adminFetch(`/api/barbers?id=${encodeURIComponent(barber.id)}`, { method: 'DELETE' })
      setBarbers((current) => current.filter((item) => item.id !== barber.id))
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Κουρείς"
        description="Η ομάδα που εμφανίζεται στη σελίδα κράτησης."
        actions={
          <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
            <PlusIcon className="h-4 w-4" />
            Νέος κουρέας
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNotice message={error} />
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : barbers.length === 0 ? (
        <EmptyState title="Δεν υπάρχουν κουρείς ακόμα." description="Πρόσθεσε τον πρώτο για να δέχεσαι κρατήσεις." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {barbers.map((barber) => {
            const stats = statsByBarber.get(barber.id) ?? { count: 0, revenue: 0 }
            return (
              <Card key={barber.id} className="p-5">
                <div className="flex items-center gap-4">
                  <Avatar name={barber.name} image={barber.image} size={64} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{barber.name}</p>
                    <p className="text-[13px] text-[var(--admin-muted)]">Κουρέας</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-[var(--admin-border)] px-4 py-3">
                  <p className="text-xs text-[var(--admin-muted)]">
                    Ωράριο{barber.schedule ? '' : ' (του μαγαζιού)'}
                  </p>
                  <p className="mt-0.5 text-[13px] font-medium leading-5">
                    {summarizeSchedule(barber.schedule ?? WORKING_PERIODS)}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-[var(--admin-surface-2)] px-4 py-3">
                  <div>
                    <p className="text-xs text-[var(--admin-muted)]">Ραντεβού μήνα</p>
                    <p className="text-lg font-semibold tabular-nums">{stats.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--admin-muted)]">Έσοδα μήνα</p>
                    <p className="text-lg font-semibold tabular-nums">{formatPrice(stats.revenue)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setEditing({ mode: 'schedule', barber })}>
                      Ωράριο
                    </Button>
                    <Button size="sm" onClick={() => setEditing({ mode: 'photo', barber })}>
                      Φωτογραφία
                    </Button>
                  </div>
                  <ConfirmButton
                    label="Διαγραφή"
                    confirmLabel="Σίγουρα;"
                    busy={deletingId === barber.id}
                    onConfirm={() => void handleDelete(barber)}
                  />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing?.mode === 'schedule' && (
        <BarberScheduleModal
          barber={editing.barber}
          onClose={() => setEditing(null)}
          onSaved={(schedule) => {
            setBarbers((current) =>
              current.map((item) => (item.id === editing.barber.id ? { ...item, schedule } : item)),
            )
            setEditing(null)
          }}
        />
      )}

      {editing && editing.mode !== 'schedule' && (
        <BarberModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setBarbers((current) =>
              editing.mode === 'create'
                ? [...current, { ...saved, schedule: null }].sort((a, b) => a.name.localeCompare(b.name, 'el'))
                : current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)),
            )
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function BarberModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Exclude<Editing, { mode: 'schedule' }>
  onClose: () => void
  onSaved: (barber: Omit<Barber, 'schedule'>) => void
}) {
  const current = editing.mode === 'photo' ? editing.barber : null
  const [name, setName] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = image ?? current?.image ?? null

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Επίλεξε αρχείο εικόνας.')
    if (file.size > MAX_UPLOAD_BYTES) return setError('Η φωτογραφία πρέπει να είναι έως 8MB.')
    setProcessing(true)
    try {
      setImage(await resizeImage(file))
    } catch {
      setError('Η φωτογραφία δεν μπόρεσε να φορτωθεί. Δοκίμασε άλλη.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!current && !name.trim()) return setError('Συμπλήρωσε το όνομα.')
    if (current && !image) return setError('Επίλεξε νέα φωτογραφία.')
    setSubmitting(true)
    setError(null)
    try {
      const saved = await adminFetch<Omit<Barber, 'schedule'>>('/api/barbers', {
        method: current ? 'PATCH' : 'POST',
        body: JSON.stringify(current ? { id: current.id, image } : { name: name.trim(), image }),
      })
      onSaved(saved)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={current ? `Φωτογραφία: ${current.name}` : 'Νέος κουρέας'}
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel={current ? 'Αποθήκευση' : 'Προσθήκη'}
      submitting={submitting || processing}
    >
      {!current && (
        <Field label="Όνομα">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="π.χ. Νίκος" autoFocus />
        </Field>
      )}
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#ece2d4]">
          {preview && <Image src={preview} alt="" fill unoptimized sizes="80px" className="object-cover" />}
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-[var(--admin-border)] bg-white px-4 text-sm font-medium hover:bg-[var(--admin-surface-2)]">
          {processing ? 'Επεξεργασία...' : preview ? 'Αλλαγή φωτογραφίας' : 'Επιλογή φωτογραφίας'}
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => void handleFile(event)} />
        </label>
      </div>
      <FormError message={error} />
    </Modal>
  )
}

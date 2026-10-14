'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { WORKING_PERIODS } from '@/lib/schedule'
import {
  type Barber,
  type ExceptionType,
  type ScheduleException,
  adminFetch,
  errorMessage,
  formatDateKeyLong,
  minutesToTime,
  todayKey,
} from '../_lib/admin-data'
import {
  Button,
  Card,
  CardHeader,
  ConfirmButton,
  EmptyState,
  ErrorNotice,
  Field,
  FormError,
  Modal,
  PageHeader,
  PlusIcon,
  SelectInput,
  Skeleton,
  TextInput,
} from './ui'

// Monday first, using JavaScript day numbers (Sunday = 0).
const WEEK = [
  [1, 'Δευτέρα'],
  [2, 'Τρίτη'],
  [3, 'Τετάρτη'],
  [4, 'Πέμπτη'],
  [5, 'Παρασκευή'],
  [6, 'Σάββατο'],
  [0, 'Κυριακή'],
] as const

const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  FORCE_CLOSE: 'Κλειστά όλη την ημέρα',
  FORCE_OPEN: 'Ανοιχτά (έκτακτα)',
  BLOCK_SLOT: 'Μπλοκαρισμένη ώρα',
}

const EXCEPTION_STYLES: Record<ExceptionType, string> = {
  FORCE_CLOSE: 'bg-red-50 text-red-700',
  FORCE_OPEN: 'bg-emerald-50 text-emerald-700',
  BLOCK_SLOT: 'bg-stone-100 text-stone-600',
}

const SLOT_TIMES = Array.from({ length: 28 }, (_, index) => minutesToTime(8 * 60 + index * 30))

export function SchedulePage() {
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [exceptionList, barberList] = await Promise.all([
        adminFetch<ScheduleException[]>('/api/admin/schedule-exceptions'),
        adminFetch<Barber[]>('/api/barbers'),
      ])
      setExceptions(exceptionList)
      setBarbers(barberList)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await adminFetch(`/api/admin/schedule-exceptions/${id}`, { method: 'DELETE' })
      setExceptions((current) => current.filter((item) => item.id !== id))
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  const today = todayKey()
  const visible = exceptions
    .filter((item) => showPast || item.dateKey >= today)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || (a.slotTime ?? '').localeCompare(b.slotTime ?? ''))
  const pastCount = exceptions.filter((item) => item.dateKey < today).length

  return (
    <>
      <PageHeader
        title="Ωράριο"
        description="Οι ώρες λειτουργίας και οι εξαιρέσεις τους (αργίες, έκτακτο άνοιγμα, μπλοκαρισμένες ώρες)."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" />
            Νέα εξαίρεση
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNotice message={error} onRetry={() => void load()} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader title="Εβδομαδιαίο ωράριο" description="Ισχύει για όλους τους κουρείς." />
          <ul className="divide-y divide-[var(--admin-border)]">
            {WEEK.map(([day, label]) => {
              const periods = WORKING_PERIODS.filter((p) => p.dayOfWeek === day)
              return (
                <li key={day} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium">{label}</span>
                  <span className={periods.length ? 'tabular-nums' : 'text-[var(--admin-muted)]'}>
                    {periods.length
                      ? periods.map((p) => `${p.startTime}–${p.endTime}`).join(', ')
                      : 'Κλειστά'}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Εξαιρέσεις"
            description="Υπερισχύουν του εβδομαδιαίου ωραρίου για τη συγκεκριμένη ημέρα."
            actions={
              pastCount > 0 ? (
                <label className="flex items-center gap-2 text-[13px] text-[var(--admin-muted)]">
                  <input
                    type="checkbox"
                    checked={showPast}
                    onChange={(event) => setShowPast(event.target.checked)}
                    className="h-4 w-4 accent-[var(--admin-accent)]"
                  />
                  Παλιές ({pastCount})
                </label>
              ) : undefined
            }
          />
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Καμία εξαίρεση." description="Πρόσθεσε αργίες ή κλείσε ώρες από το «Νέα εξαίρεση»." />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {visible.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">
                      {formatDateKeyLong(item.dateKey)}
                      {item.slotTime ? `, ${item.slotTime}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EXCEPTION_STYLES[item.type]}`}>
                        {EXCEPTION_LABELS[item.type]}
                      </span>
                      {item.type === 'BLOCK_SLOT' && (
                        <span className="text-xs text-[var(--admin-muted)]">
                          {item.barberName ?? 'Όλοι οι κουρείς'}
                        </span>
                      )}
                    </div>
                  </div>
                  <ConfirmButton
                    label="Αφαίρεση"
                    confirmLabel="Σίγουρα;"
                    busy={deletingId === item.id}
                    onConfirm={() => void handleDelete(item.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {creating && (
        <ExceptionModal
          barbers={barbers}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setExceptions((current) => [...current, created])
            setCreating(false)
          }}
        />
      )}
    </>
  )
}

function ExceptionModal({
  barbers,
  onClose,
  onCreated,
}: {
  barbers: Barber[]
  onClose: () => void
  onCreated: (exception: ScheduleException) => void
}) {
  const [type, setType] = useState<ExceptionType>('FORCE_CLOSE')
  const [date, setDate] = useState(todayKey())
  const [slotTime, setSlotTime] = useState('10:00')
  const [barberName, setBarberName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const created = await adminFetch<ScheduleException>('/api/admin/schedule-exceptions', {
        method: 'POST',
        body: JSON.stringify(
          type === 'BLOCK_SLOT'
            ? { type, date, slotTime, barberName: barberName || null }
            : { type, date },
        ),
      })
      onCreated(created)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Νέα εξαίρεση ωραρίου"
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel="Αποθήκευση"
      submitting={submitting}
    >
      <div className="grid gap-2">
        {(Object.keys(EXCEPTION_LABELS) as ExceptionType[]).map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
              type === option
                ? 'border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]'
                : 'border-[var(--admin-border)] hover:bg-[var(--admin-surface-2)]'
            }`}
          >
            <input
              type="radio"
              name="exception-type"
              checked={type === option}
              onChange={() => setType(option)}
              className="accent-[var(--admin-accent)]"
            />
            {EXCEPTION_LABELS[option]}
          </label>
        ))}
      </div>
      <Field label="Ημερομηνία">
        <TextInput type="date" value={date} min={todayKey()} onChange={(event) => setDate(event.target.value)} />
      </Field>
      {type === 'BLOCK_SLOT' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ώρα (30 λεπτά)">
            <SelectInput value={slotTime} onChange={(event) => setSlotTime(event.target.value)}>
              {SLOT_TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Κουρέας">
            <SelectInput value={barberName} onChange={(event) => setBarberName(event.target.value)}>
              <option value="">Όλοι</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.name}>
                  {barber.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      )}
      <FormError message={error} />
    </Modal>
  )
}

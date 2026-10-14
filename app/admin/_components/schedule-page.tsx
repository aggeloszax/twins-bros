'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { WORKING_PERIODS } from '@/lib/schedule'
import {
  type Barber,
  type ExceptionType,
  type ScheduleException,
  type TimeOff,
  adminFetch,
  errorMessage,
  formatDateKeyLong,
  minutesToTime,
  summarizeSchedule,
  todayKey,
} from '../_lib/admin-data'
import { BarberScheduleModal } from './barber-schedule-modal'
import {
  Avatar,
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

function formatRange(range: TimeOff) {
  const start = formatDateKeyLong(range.startDate)
  return range.startDate === range.endDate ? start : `${start} έως ${formatDateKeyLong(range.endDate)}`
}

export function SchedulePage() {
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [timeOff, setTimeOff] = useState<TimeOff[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<'exception' | 'timeOff' | null>(null)
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [exceptionList, timeOffList, barberList] = await Promise.all([
        adminFetch<ScheduleException[]>('/api/admin/schedule-exceptions'),
        adminFetch<TimeOff[]>('/api/admin/time-off'),
        adminFetch<Barber[]>('/api/barbers'),
      ])
      setExceptions(exceptionList)
      setTimeOff(timeOffList)
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

  async function remove(kind: 'exception' | 'timeOff', id: string) {
    setDeletingId(id)
    try {
      if (kind === 'exception') {
        await adminFetch(`/api/admin/schedule-exceptions/${id}`, { method: 'DELETE' })
        setExceptions((current) => current.filter((item) => item.id !== id))
      } else {
        await adminFetch(`/api/admin/time-off/${id}`, { method: 'DELETE' })
        setTimeOff((current) => current.filter((item) => item.id !== id))
      }
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  const today = todayKey()
  const barberName = (id: string | null) =>
    id === null ? 'Όλο το μαγαζί' : (barbers.find((barber) => barber.id === id)?.name ?? 'Κουρέας')

  const visibleTimeOff = timeOff
    .filter((range) => showPast || range.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const visibleExceptions = exceptions
    .filter((item) => showPast || item.dateKey >= today)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || (a.slotTime ?? '').localeCompare(b.slotTime ?? ''))
  const pastCount =
    timeOff.filter((range) => range.endDate < today).length +
    exceptions.filter((item) => item.dateKey < today).length

  return (
    <>
      <PageHeader
        title="Ωράριο"
        description="Ποιος δουλεύει πότε, άδειες, αργίες και εξαιρέσεις."
        actions={
          <>
            <Button onClick={() => setModal('exception')}>Εξαίρεση ημέρας</Button>
            <Button variant="primary" onClick={() => setModal('timeOff')}>
              <PlusIcon className="h-4 w-4" />
              Άδεια ή κλείσιμο
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNotice message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="self-start">
            <CardHeader
              title="Ωράριο κουρέων"
              description={`Του μαγαζιού: ${summarizeSchedule(WORKING_PERIODS)}`}
            />
            {barbers.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--admin-muted)]">Δεν υπάρχουν κουρείς.</p>
            ) : (
              <ul className="divide-y divide-[var(--admin-border)]">
                {barbers.map((barber) => (
                  <li key={barber.id} className="flex items-center gap-3 px-5 py-3.5">
                    <Avatar name={barber.name} image={barber.image} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{barber.name}</p>
                      <p className="text-[13px] leading-5 text-[var(--admin-muted)]">
                        {barber.schedule
                          ? summarizeSchedule(barber.schedule)
                          : 'Ωράριο μαγαζιού'}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setEditingBarber(barber)}>
                      Αλλαγή
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Άδειες και κλεισίματα"
                description="Διαστήματα ημερών που δεν δουλεύει ένας κουρέας ή όλο το μαγαζί."
                actions={
                  pastCount > 0 ? (
                    <label className="flex shrink-0 items-center gap-2 text-[13px] text-[var(--admin-muted)]">
                      <input
                        type="checkbox"
                        checked={showPast}
                        onChange={(event) => setShowPast(event.target.checked)}
                        className="h-4 w-4 accent-[var(--admin-accent)]"
                      />
                      Παλιές
                    </label>
                  ) : undefined
                }
              />
              {visibleTimeOff.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="Καμία άδεια ή κλείσιμο." />
                </div>
              ) : (
                <ul className="divide-y divide-[var(--admin-border)]">
                  {visibleTimeOff.map((range) => (
                    <li key={range.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{formatRange(range)}</p>
                        <p className="mt-0.5 text-[13px] text-[var(--admin-muted)]">
                          {barberName(range.barberId)}
                          {range.reason ? ` · ${range.reason}` : ''}
                        </p>
                      </div>
                      <ConfirmButton
                        label="Αφαίρεση"
                        confirmLabel="Σίγουρα;"
                        busy={deletingId === range.id}
                        onConfirm={() => void remove('timeOff', range.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Εξαιρέσεις ημέρας"
                description="Κλείσιμο ή έκτακτο άνοιγμα μιας ημέρας, ή μπλοκάρισμα μιας ώρας."
              />
              {visibleExceptions.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="Καμία εξαίρεση." />
                </div>
              ) : (
                <ul className="divide-y divide-[var(--admin-border)]">
                  {visibleExceptions.map((item) => (
                    <li key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
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
                        onConfirm={() => void remove('exception', item.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {modal === 'exception' && (
        <ExceptionModal
          barbers={barbers}
          onClose={() => setModal(null)}
          onCreated={(created) => {
            setExceptions((current) => [...current, created])
            setModal(null)
          }}
        />
      )}

      {modal === 'timeOff' && (
        <TimeOffModal
          barbers={barbers}
          onClose={() => setModal(null)}
          onCreated={(created) => {
            setTimeOff((current) => [...current, created])
            setModal(null)
          }}
        />
      )}

      {editingBarber && (
        <BarberScheduleModal
          barber={editingBarber}
          onClose={() => setEditingBarber(null)}
          onSaved={(schedule) => {
            setBarbers((current) =>
              current.map((item) => (item.id === editingBarber.id ? { ...item, schedule } : item)),
            )
            setEditingBarber(null)
          }}
        />
      )}
    </>
  )
}

function TimeOffModal({
  barbers,
  onClose,
  onCreated,
}: {
  barbers: Barber[]
  onClose: () => void
  onCreated: (range: TimeOff) => void
}) {
  const [barberId, setBarberId] = useState('')
  const [startDate, setStartDate] = useState(todayKey())
  const [endDate, setEndDate] = useState(todayKey())
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const created = await adminFetch<TimeOff>('/api/admin/time-off', {
        method: 'POST',
        body: JSON.stringify({ barberId: barberId || null, startDate, endDate, reason }),
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
      title="Άδεια ή κλείσιμο"
      description="Τις ημέρες αυτές δεν θα εμφανίζονται διαθέσιμες ώρες. Τα υπάρχοντα ραντεβού δεν αλλάζουν."
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel="Αποθήκευση"
      submitting={submitting}
    >
      <Field label="Ποιος">
        <SelectInput value={barberId} onChange={(event) => setBarberId(event.target.value)}>
          <option value="">Όλο το μαγαζί (κλειστά)</option>
          {barbers.map((barber) => (
            <option key={barber.id} value={barber.id}>
              {barber.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Από">
          <TextInput
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value)
              if (endDate < event.target.value) setEndDate(event.target.value)
            }}
          />
        </Field>
        <Field label="Έως (μαζί)">
          <TextInput type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
        </Field>
      </div>
      <Field label="Αιτία" hint="Προαιρετικό, π.χ. Άδεια, Αργία, Ανακαίνιση.">
        <TextInput value={reason} maxLength={120} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <FormError message={error} />
    </Modal>
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

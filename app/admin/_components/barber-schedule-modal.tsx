'use client'

import { type FormEvent, useState } from 'react'
import { type WorkingPeriod, WORKING_PERIODS, minutesToTime } from '@/lib/schedule'
import {
  type Barber,
  WEEK_DAYS,
  adminFetch,
  errorMessage,
  periodsOfDay,
  summarizeSchedule,
} from '../_lib/admin-data'
import { Button, FormError, IconButton, Modal, PlusIcon, XIcon } from './ui'

// Half-hour choices from 06:00 to 24:00.
const TIMES = Array.from({ length: 37 }, (_, index) => minutesToTime(6 * 60 + index * 30)).map(
  (time) => (time === '24:00' ? '23:59' : time),
)

type Interval = { startTime: string; endTime: string }
type Week = Record<number, Interval[]>

function toWeek(periods: WorkingPeriod[]): Week {
  return Object.fromEntries(
    WEEK_DAYS.map(({ day }) => [
      day,
      periodsOfDay(periods, day).map(({ startTime, endTime }) => ({ startTime, endTime })),
    ]),
  )
}

function fromWeek(week: Week): WorkingPeriod[] {
  return WEEK_DAYS.flatMap(({ day }) => week[day].map((interval) => ({ dayOfWeek: day, ...interval })))
}

const SELECT_CLASS =
  'h-9 rounded-lg border border-[var(--admin-border)] bg-white px-2 text-sm tabular-nums outline-none focus:border-[var(--admin-accent)]'

export function BarberScheduleModal({
  barber,
  onClose,
  onSaved,
}: {
  barber: Barber
  onClose: () => void
  onSaved: (schedule: WorkingPeriod[] | null) => void
}) {
  const [custom, setCustom] = useState(barber.schedule !== null)
  const [week, setWeek] = useState<Week>(() => toWeek(barber.schedule ?? WORKING_PERIODS))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateDay(day: number, intervals: Interval[]) {
    setWeek((current) => ({ ...current, [day]: intervals }))
  }

  function addInterval(day: number) {
    const intervals = week[day]
    const last = intervals.at(-1)
    // A second interval after a break defaults to the evening shift.
    updateDay(day, [
      ...intervals,
      last ? { startTime: last.endTime < '17:00' ? '17:00' : last.endTime, endTime: '21:00' } : { startTime: '09:00', endTime: '21:00' },
    ])
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const schedule = custom ? fromWeek(week) : null
      await adminFetch(`/api/admin/barbers/${barber.id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ schedule }),
      })
      onSaved(schedule)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Ωράριο: ${barber.name}`}
      description="Οι πελάτες βλέπουν διαθέσιμες ώρες μόνο μέσα σε αυτό το ωράριο."
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel="Αποθήκευση ωραρίου"
      submitting={submitting}
      wide
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { value: false, label: 'Ωράριο μαγαζιού', hint: summarizeSchedule(WORKING_PERIODS) },
          { value: true, label: 'Δικό του ωράριο', hint: 'Ρεπό, διαλείμματα, άλλες ώρες' },
        ].map((option) => (
          <label
            key={String(option.value)}
            className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
              custom === option.value
                ? 'border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]'
                : 'border-[var(--admin-border)] hover:bg-[var(--admin-surface-2)]'
            }`}
          >
            <input
              type="radio"
              name="schedule-mode"
              checked={custom === option.value}
              onChange={() => setCustom(option.value)}
              className="mt-0.5 accent-[var(--admin-accent)]"
            />
            <span>
              <span className="font-medium">{option.label}</span>
              <span className="block text-xs text-[var(--admin-muted)]">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {custom && (
        <ul className="divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)]">
          {WEEK_DAYS.map(({ day, long }) => {
            const intervals = week[day]
            const works = intervals.length > 0
            return (
              <li key={day} className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-start">
                <label className="flex w-36 shrink-0 cursor-pointer items-center gap-2.5 pt-1.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={works}
                    onChange={(event) =>
                      updateDay(day, event.target.checked ? [{ startTime: '09:00', endTime: '21:00' }] : [])
                    }
                    className="h-4 w-4 accent-[var(--admin-accent)]"
                  />
                  {long}
                </label>
                {works ? (
                  <div className="flex-1 space-y-2">
                    {intervals.map((interval, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          aria-label={`${long}: έναρξη`}
                          value={interval.startTime}
                          onChange={(event) =>
                            updateDay(
                              day,
                              intervals.map((item, i) => (i === index ? { ...item, startTime: event.target.value } : item)),
                            )
                          }
                          className={SELECT_CLASS}
                        >
                          {TIMES.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        <span className="text-[var(--admin-muted)]">–</span>
                        <select
                          aria-label={`${long}: λήξη`}
                          value={interval.endTime}
                          onChange={(event) =>
                            updateDay(
                              day,
                              intervals.map((item, i) => (i === index ? { ...item, endTime: event.target.value } : item)),
                            )
                          }
                          className={SELECT_CLASS}
                        >
                          {TIMES.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        {intervals.length > 1 && (
                          <IconButton
                            label="Αφαίρεση διαστήματος"
                            onClick={() => updateDay(day, intervals.filter((_, i) => i !== index))}
                          >
                            <XIcon className="h-4 w-4" />
                          </IconButton>
                        )}
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => addInterval(day)}>
                      <PlusIcon className="h-3.5 w-3.5" />
                      Διάστημα μετά από διάλειμμα
                    </Button>
                  </div>
                ) : (
                  <p className="pt-1.5 text-sm text-[var(--admin-muted)]">Ρεπό</p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <FormError message={error} />
    </Modal>
  )
}

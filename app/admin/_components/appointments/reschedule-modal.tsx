'use client'

import { type FormEvent, useMemo, useState } from 'react'
import {
  type Barber,
  type Booking,
  type ScheduleException,
  type Service,
  type TimeOff,
  adminFetch,
  bookingDateKey,
  errorMessage,
  formatDateShort,
  formatPrice,
  formatTime,
} from '../../_lib/admin-data'
import { Field, FormError, Modal, SelectInput, TextInput } from '../ui'
import { takenTimes, workingTimeOptions } from './time-options'

type RescheduleResult = Booking & { customerNotification: 'sent' | 'failed' | 'skipped' }

export function RescheduleModal({
  booking,
  barbers,
  services,
  exceptions,
  timeOff,
  knownBookings,
  target,
  onClose,
  onSaved,
}: {
  booking: Booking
  // Where the booking was dropped in the schedule, if it was dragged.
  target?: { barberId: string; date: string; time: string }
  barbers: Barber[]
  services: Service[]
  exceptions: ScheduleException[]
  timeOff: TimeOff[]
  knownBookings: Booking[]
  onClose: () => void
  onSaved: (booking: Booking, notification: RescheduleResult['customerNotification']) => void
}) {
  const [barberId, setBarberId] = useState(target?.barberId ?? booking.barber.id)
  const [serviceId, setServiceId] = useState(booking.service.id)
  const [date, setDate] = useState(target?.date ?? bookingDateKey(booking))
  const [time, setTime] = useState(target?.time ?? formatTime(booking.startTime))
  const [notify, setNotify] = useState(Boolean(booking.customerEmail))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const duration = services.find((item) => item.id === serviceId)?.duration ?? booking.service.duration
  const taken = useMemo(
    () => takenTimes(knownBookings, barberId, date, duration, booking.id),
    [knownBookings, barberId, date, duration, booking.id],
  )
  const unchanged =
    barberId === booking.barber.id &&
    serviceId === booking.service.id &&
    date === bookingDateKey(booking) &&
    time === formatTime(booking.startTime)

  // The barber's hours that day; the current or dropped time stays selectable
  // even when it falls outside them.
  const workingOptions = workingTimeOptions(
    barbers.find((item) => item.id === barberId),
    date,
    exceptions,
    timeOff,
    duration,
  )
  const timeOptions = workingOptions.includes(time)
    ? workingOptions
    : [...workingOptions, time].sort()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const saved = await adminFetch<RescheduleResult>(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          reschedule: { barberId, serviceId, date, slotTime: time, notifyCustomer: notify },
        }),
      })
      onSaved(saved, saved.customerNotification)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Μετακίνηση ραντεβού"
      description={`${booking.customerName} · τώρα ${formatDateShort(booking.startTime)}, ${formatTime(booking.startTime)} με ${booking.barber.name}`}
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel="Αποθήκευση αλλαγής"
      submitting={submitting}
      submitDisabled={unchanged || taken.has(time)}
    >
      <Field label="Υπηρεσία">
        <SelectInput value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
          {services.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.duration}′ · {formatPrice(item.price)}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Κουρέας">
        <SelectInput value={barberId} onChange={(event) => setBarberId(event.target.value)}>
          {barbers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ημερομηνία">
          <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Ώρα">
          <SelectInput value={time} onChange={(event) => setTime(event.target.value)}>
            {timeOptions.map((option) => (
              <option key={option} value={option} disabled={taken.has(option)}>
                {option}
                {taken.has(option) ? ' · κλεισμένη' : ''}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      {taken.has(time) && (
        <p className="text-sm text-amber-800">Η ώρα συμπίπτει με άλλο ραντεβού του κουρέα.</p>
      )}
      <label
        className={`flex items-start gap-3 rounded-xl border border-[var(--admin-border)] px-3.5 py-3 text-sm ${
          booking.customerEmail ? 'cursor-pointer' : 'opacity-60'
        }`}
      >
        <input
          type="checkbox"
          checked={notify}
          disabled={!booking.customerEmail}
          onChange={(event) => setNotify(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--admin-accent)]"
        />
        <span>
          Ενημέρωση πελάτη με email
          <span className="block text-xs text-[var(--admin-muted)]">
            {booking.customerEmail ?? 'Ο πελάτης δεν έχει δώσει email.'}
          </span>
        </span>
      </label>
      <FormError message={error} />
    </Modal>
  )
}

'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { normalizeGreekMobilePhone, toNationalPhoneInput } from '@/lib/phone'
import {
  type Barber,
  type Booking,
  type Service,
  ApiError,
  adminFetch,
  errorMessage,
  formatPrice,
} from '../../_lib/admin-data'
import { AlertIcon, Field, FormError, Modal, SelectInput, TextArea, TextInput } from '../ui'
import { ADMIN_TIME_OPTIONS, takenTimes } from './time-options'

export type NewBookingPrefill = {
  barberId?: string
  date: string
  time?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string | null
}

export function NewBookingModal({
  prefill,
  barbers,
  services,
  knownBookings,
  onClose,
  onCreated,
}: {
  prefill: NewBookingPrefill
  barbers: Barber[]
  services: Service[]
  // Bookings already loaded in the calendar, used to flag taken times and to
  // fill in returning customers' details.
  knownBookings: Booking[]
  onClose: () => void
  onCreated: (booking: Booking) => void
}) {
  const [customerName, setCustomerName] = useState(prefill.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(
    prefill.customerPhone ? toNationalPhoneInput(prefill.customerPhone) : '',
  )
  const [customerEmail, setCustomerEmail] = useState(prefill.customerEmail ?? '')
  const [notes, setNotes] = useState('')
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [barberId, setBarberId] = useState(prefill.barberId ?? barbers[0]?.id ?? '')
  const [date, setDate] = useState(prefill.date)
  const [time, setTime] = useState(prefill.time ?? '10:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const service = services.find((item) => item.id === serviceId)
  const duration = service?.duration ?? 30

  const taken = useMemo(
    () => takenTimes(knownBookings, barberId, date, duration),
    [knownBookings, barberId, date, duration],
  )

  const knownCustomer = knownBookings.find(
    (b) => b.customerPhone === normalizeGreekMobilePhone(customerPhone),
  )?.customer

  // Fill a returning customer's name and email from their phone number.
  function handlePhoneChange(value: string) {
    const national = toNationalPhoneInput(value)
    setCustomerPhone(national)
    const normalized = normalizeGreekMobilePhone(national)
    if (!normalized) return
    const previous = knownBookings.find(
      (b) => normalizeGreekMobilePhone(b.customerPhone) === normalized,
    )
    if (!previous) return
    if (!customerName.trim()) setCustomerName(previous.customerName)
    if (!customerEmail.trim() && previous.customerEmail) setCustomerEmail(previous.customerEmail)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const phone = normalizeGreekMobilePhone(customerPhone)

    if (!customerName.trim()) return setError('Συμπλήρωσε το όνομα του πελάτη.')
    if (!phone) return setError('Συμπλήρωσε έγκυρο κινητό (69xxxxxxxx).')
    if (!serviceId || !barberId) return setError('Επίλεξε υπηρεσία και κουρέα.')

    setSubmitting(true)
    setError(null)
    try {
      const created = await adminFetch<Omit<Booking, 'noShow' | 'noShowCount' | 'customer'>>(
        '/api/bookings',
        {
          method: 'POST',
          body: JSON.stringify({
            serviceId,
            barberId,
            date,
            slotTime: time,
            customerName: customerName.trim(),
            customerPhone: phone,
            customerEmail: customerEmail.trim() || null,
            notes: notes.trim() || null,
            adminManual: true,
          }),
        },
      )
      const previous = knownBookings.find((b) => b.customerPhone === phone)
      onCreated({
        ...created,
        noShow: false,
        noShowCount: previous?.noShowCount ?? 0,
        customer: previous?.customer ?? null,
      })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof ApiError && submitError.status === 409
          ? 'Ο κουρέας έχει ήδη ραντεβού σε αυτή την ώρα.'
          : errorMessage(submitError),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Νέο ραντεβού"
      description="Για πελάτη που ήρθε από κοντά ή κάλεσε στο τηλέφωνο."
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel="Καταχώρηση"
      submitting={submitting}
      submitDisabled={services.length === 0 || barbers.length === 0 || taken.has(time)}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Κινητό">
          <TextInput
            type="tel"
            inputMode="numeric"
            value={customerPhone}
            onChange={(event) => handlePhoneChange(event.target.value)}
            placeholder="69xxxxxxxx"
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field label="Ονοματεπώνυμο">
          <TextInput
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="π.χ. Γιώργος Παπαδόπουλος"
            autoComplete="off"
          />
        </Field>
        <Field label="Email" hint="Προαιρετικό. Αν το συμπληρώσεις, ο πελάτης παίρνει επιβεβαίωση." className="sm:col-span-2">
          <TextInput
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="pelatis@example.com"
            autoComplete="off"
          />
        </Field>
        <Field label="Υπηρεσία" className="sm:col-span-2">
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
              {ADMIN_TIME_OPTIONS.map((option) => (
                <option key={option} value={option} disabled={taken.has(option)}>
                  {option}
                  {taken.has(option) ? ' · κλεισμένη' : ''}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </div>
      <Field label="Σχόλιο ραντεβού" hint="Προαιρετικό, φαίνεται μόνο στο πρόγραμμα.">
        <TextArea
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      {knownCustomer?.blocked && (
        <p className="flex gap-2 text-sm text-red-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          Ο πελάτης είναι μπλοκαρισμένος για online κρατήσεις
          {knownCustomer.blockedReason ? ` (${knownCustomer.blockedReason})` : ''}.
        </p>
      )}
      {knownCustomer?.notes && (
        <p className="rounded-xl bg-[var(--admin-surface-2)] px-3 py-2 text-sm">
          <span className="font-medium">Σημειώσεις πελάτη:</span> {knownCustomer.notes}
        </p>
      )}
      {taken.has(time) && (
        <p className="text-sm text-amber-800">
          Η ώρα αυτή συμπίπτει με άλλο ραντεβού του κουρέα. Διάλεξε άλλη ώρα.
        </p>
      )}
      <FormError message={error} />
    </Modal>
  )
}

'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { normalizeGreekMobilePhone, toNationalPhoneInput } from '@/lib/phone'
import {
  type Barber,
  type Booking,
  type Service,
  ApiError,
  adminFetch,
  bookingDateKey,
  errorMessage,
  formatPrice,
  minutesOfDay,
  minutesToTime,
} from '../../_lib/admin-data'
import { Field, FormError, Modal, SelectInput, TextInput } from '../ui'

const TIME_STEP = 15
const FIRST_TIME = 7 * 60
const LAST_TIME = 22 * 60

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
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [barberId, setBarberId] = useState(prefill.barberId ?? barbers[0]?.id ?? '')
  const [date, setDate] = useState(prefill.date)
  const [time, setTime] = useState(prefill.time ?? '10:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const service = services.find((item) => item.id === serviceId)
  const duration = service?.duration ?? 30

  // Times that would overlap an existing booking for this barber and day.
  const takenTimes = useMemo(() => {
    const busy = knownBookings
      .filter(
        (b) =>
          b.barber.id === barberId &&
          b.status !== 'CANCELLED' &&
          bookingDateKey(b) === date,
      )
      .map((b) => {
        const start = minutesOfDay(b.startTime)
        return [start, start + b.service.duration] as const
      })
    const taken = new Set<string>()
    for (let m = FIRST_TIME; m < LAST_TIME; m += TIME_STEP) {
      if (busy.some(([start, end]) => m < end && m + duration > start)) {
        taken.add(minutesToTime(m))
      }
    }
    return taken
  }, [knownBookings, barberId, date, duration])

  const timeOptions = useMemo(() => {
    const options: string[] = []
    for (let m = FIRST_TIME; m < LAST_TIME; m += TIME_STEP) options.push(minutesToTime(m))
    return options
  }, [])

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
      const created = await adminFetch<Omit<Booking, 'noShow' | 'noShowCount'>>(
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
            adminManual: true,
          }),
        },
      )
      const previousNoShows =
        knownBookings.find((b) => normalizeGreekMobilePhone(b.customerPhone) === phone)
          ?.noShowCount ?? 0
      onCreated({ ...created, noShow: false, noShowCount: previousNoShows })
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
      submitDisabled={services.length === 0 || barbers.length === 0 || takenTimes.has(time)}
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
              {timeOptions.map((option) => (
                <option key={option} value={option} disabled={takenTimes.has(option)}>
                  {option}
                  {takenTimes.has(option) ? ' · κλεισμένη' : ''}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </div>
      {takenTimes.has(time) && (
        <p className="text-sm text-amber-800">
          Η ώρα αυτή συμπίπτει με άλλο ραντεβού του κουρέα. Διάλεξε άλλη ώρα.
        </p>
      )}
      <FormError message={error} />
    </Modal>
  )
}

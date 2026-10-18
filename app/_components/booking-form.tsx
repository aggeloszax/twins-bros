'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ANY_BARBER,
  BOOKING_WINDOW_DAYS,
  getBarberPeriodsForDate,
  isDayBookable,
  isScheduleExceptionType,
  type NormalizedScheduleException,
  type TimeOffRange,
  type WorkingPeriod,
  toDateKey,
} from '@/lib/schedule'
import { normalizeGreekMobilePhone, toNationalPhoneInput } from '@/lib/phone'
import { groupByCategory } from '@/lib/catalog'
import { SHOP, SITE_THEME } from '@/lib/shop'
import { ShopInfo } from './shop-info'
import { SocialLinks } from './social-links'

type Service = {
  id: string
  name: string
  price: number
  duration: number
  description: string | null
  category: string | null
}

type Barber = {
  id: string
  name: string
  image: string | null
  bio: string | null
  // null: the barber follows the default weekly hours.
  schedule: WorkingPeriod[] | null
}

type Slot = {
  time: string
  available: boolean
}

type BookingStep = 1 | 2 | 3 | 4
type EmailDeliveryStatus = 'sent' | 'failed' | 'skipped'

type BookingCreationResponse = {
  barber?: { id: string; name: string }
  calendar?: { google: string; ics: string }
  notificationDelivery?: {
    customerEmail: EmailDeliveryStatus
  }
}

// "No preference": the server assigns whichever barber is free.
const ANY_BARBER_CHOICE: Barber = {
  id: ANY_BARBER,
  name: 'Οποιοσδήποτε',
  image: null,
  bio: null,
  schedule: null,
}

// Frame the existing photos around the barber, rather than the ceiling.
// Newly uploaded photos keep their natural framing.
const BARBER_PORTRAIT_FRAMING: Record<string, { transform: string; transformOrigin: string }> = {
  '/barbers/donaldo.webp': { transform: 'scale(1.6)', transformOrigin: '40% 85%' },
  '/barbers/kleidi.png': { transform: 'scale(1.6)', transformOrigin: '48% 85%' },
  '/barbers/redi.jpg': { transform: 'scale(1.45)', transformOrigin: '40% 75%' },
}

const GR_DAYS = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ']
const GR_WEEKDAYS_MON_FIRST = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ']
const GR_MONTHS = [
  'Ιαν',
  'Φεβ',
  'Μαρ',
  'Απρ',
  'Μαϊ',
  'Ιουν',
  'Ιουλ',
  'Αυγ',
  'Σεπ',
  'Οκτ',
  'Νοε',
  'Δεκ',
]

const STEP_LABELS = ['Υπηρεσία', 'Κουρέας', 'Ημέρα & ώρα', 'Τα στοιχεία σου']
// Light-mode input: white field, charcoal text, burgundy focus ring.
const inputClass =
  'w-full rounded-2xl border border-[var(--page-border)] bg-white py-3.5 pl-12 pr-4 text-base text-neutral-900 outline-none transition-all duration-300 ease-in-out focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]'

const formatPrice = (price: number) =>
  `${Number.isInteger(price) ? price : price.toFixed(2)}€`

function formatDateLong(key: string) {
  const d = new Date(`${key}T00:00:00`)
  return `${GR_DAYS[d.getDay()]} ${d.getDate()} ${GR_MONTHS[d.getMonth()]}`
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function buildCalendarGrid(monthDate: Date) {
  const firstOfMonth = startOfMonth(monthDate)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('el-GR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getMaxBookingDate(today: Date) {
  const maxDate = startOfDay(today)
  maxDate.setDate(maxDate.getDate() + BOOKING_WINDOW_DAYS)
  return maxDate
}

function withImageVersion(src: string, version: string) {
  if (src.startsWith('data:')) return src
  const separator = src.includes('?') ? '&' : '?'
  return `${src}${separator}v=${version}`
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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v5l3.5 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="9" r="2.8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M2.5 19.5c.7-3.6 3-5.5 6.5-5.5s5.8 1.9 6.5 5.5M15 14.2c.5-.1 1-.2 1.5-.2 2.8 0 4.6 1.6 5 4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 20c.8-4 3.3-6 7.5-6s6.7 2 7.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M7.2 3.5 10 7.8 7.8 10c1.2 2.6 3.3 4.7 5.9 5.9l2.2-2.2 4.4 2.8-.7 3.4c-.2.8-.9 1.3-1.7 1.3C9.6 20.7 3.3 14.4 2.8 6.1c0-.8.5-1.5 1.3-1.7l3.1-.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m5 8 7 5 7-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function isValidCustomerEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function Stepper({
  step,
  done,
  canReach,
  onGo,
}: {
  step: number
  done: Record<number, boolean>
  canReach: (n: number) => boolean
  onGo: (n: number) => void
}) {
  return (
    <nav
      aria-label="Βήματα κράτησης"
      className="pb-1"
    >
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-x-1 sm:gap-x-2">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1
          const isActive = step === n
          const isDone = done[n]
          const reachable = canReach(n)

          return (
            <Fragment key={n}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onGo(n)}
                className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl transition-all duration-300 ease-in-out disabled:cursor-not-allowed"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300 ease-in-out sm:h-9 sm:w-9 ${
                    isDone
                      ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                      : isActive
                        ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-neutral-900 shadow-[0_0_0_4px_rgba(128,0,32,0.10)]'
                        : 'border-[var(--page-border)] bg-white text-neutral-400'
                  }`}
                >
                  {isDone ? <CheckIcon className="h-4 w-4" /> : n}
                </span>
                <span
                  className={`w-full text-center text-[10px] font-semibold leading-tight transition-colors duration-300 sm:text-xs ${
                    isActive
                      ? 'text-neutral-900'
                      : isDone
                        ? 'text-neutral-700'
                        : 'text-neutral-400'
                  }`}
                >
                  <span className="block break-words">{label}</span>
                </span>
              </button>
              {n < STEP_LABELS.length && (
                <span
                  className={`mt-4 h-0.5 w-4 shrink-0 rounded-full transition-colors duration-300 sm:mt-[18px] sm:w-10 ${
                    done[n] ? 'bg-[var(--brand)]' : 'bg-neutral-200'
                  }`}
                />
              )}
            </Fragment>
          )
        })}
      </div>
    </nav>
  )
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--page-border)] bg-white p-5">
      <div className="h-4 w-2/3 rounded bg-neutral-200" />
      <div className="mt-4 h-3 w-1/3 rounded bg-neutral-200" />
    </div>
  )
}

function AvatarSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-[var(--page-border)] bg-white">
      <div className="aspect-[3/4] bg-neutral-200" />
      <div className="mx-auto my-5 h-4 w-1/2 rounded bg-neutral-200" />
    </div>
  )
}

function SlotSkeleton() {
  return <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[var(--brand)] bg-[var(--brand)]/5 p-6 text-center">
      <p className="text-sm text-[var(--brand)]">
        Κάτι πήγε στραβά κατά τη φόρτωση.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md border border-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand)] transition-all duration-300 ease-in-out hover:bg-[var(--brand)] hover:text-white"
      >
        Δοκίμασε ξανά
      </button>
    </div>
  )
}

export default function BookingForm() {
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingBarbers, setLoadingBarbers] = useState(true)
  const [servicesError, setServicesError] = useState(false)
  const [barbersError, setBarbersError] = useState(false)

  const [step, setStep] = useState<BookingStep>(1)
  useEffect(() => {
    if (step > 1) stepHeadingRef.current?.focus()
  }, [step])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [touched, setTouched] = useState({ name: false, phone: false, email: false })
  const [bookingNotes, setBookingNotes] = useState('')
  // Services whose description the visitor has expanded.
  const [openDescriptions, setOpenDescriptions] = useState<Set<string>>(new Set())

  function toggleDescription(id: string) {
    setOpenDescriptions((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [bookingError, setBookingError] = useState<'failed' | 'blocked' | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmedBooking, setConfirmedBooking] = useState<BookingCreationResponse | null>(null)
  const [customerEmailDelivery, setCustomerEmailDelivery] =
    useState<EmailDeliveryStatus | null>(null)
  const [failedBarberImages, setFailedBarberImages] = useState<
    Record<string, boolean>
  >({})

  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(false)
  const [slotsRetry, setSlotsRetry] = useState(0)
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null)
  const [searchingNextDate, setSearchingNextDate] = useState(false)
  const [nextDateError, setNextDateError] = useState(false)

  const [scheduleExceptions, setScheduleExceptions] = useState<
    NormalizedScheduleException[]
  >([])
  const [timeOff, setTimeOff] = useState<TimeOffRange[]>([])

  const today = startOfDay(new Date())
  const maxBookingDate = getMaxBookingDate(today)
  const calendarDays = buildCalendarGrid(calendarMonth)
  const canGoPreviousMonth = calendarMonth > startOfMonth(today)
  const canGoNextMonth = addMonths(calendarMonth, 1) <= startOfMonth(maxBookingDate)
  const brandStyle = SITE_THEME

  async function loadServices() {
    setLoadingServices(true)
    setServicesError(false)
    try {
      const res = await fetch('/api/services')
      if (!res.ok) throw new Error('Request failed')
      setServices(await res.json())
    } catch {
      setServicesError(true)
    } finally {
      setLoadingServices(false)
    }
  }

  async function loadBarbers() {
    setLoadingBarbers(true)
    setBarbersError(false)
    try {
      const res = await fetch('/api/barbers')
      if (!res.ok) throw new Error('Request failed')
      setBarbers(await res.json())
    } catch {
      setBarbersError(true)
    } finally {
      setLoadingBarbers(false)
    }
  }

  async function loadScheduleExceptions() {
    try {
      const res = await fetch('/api/schedule-exceptions')
      if (!res.ok) throw new Error('Request failed')
      const data = (await res.json()) as {
        exceptions: Array<{
          dateKey: string
          barberName: string | null
          type: string
          slotTime: string | null
        }>
        timeOff: TimeOffRange[]
      }
      setTimeOff(data.timeOff)
      setScheduleExceptions(
        data.exceptions.flatMap((item) =>
          isScheduleExceptionType(item.type)
            ? [
                {
                  dateKey: item.dateKey,
                  barberName: item.barberName,
                  type: item.type,
                  slotTime: item.slotTime,
                },
              ]
            : [],
        ),
      )
    } catch {
      // Calendar still works without overrides; default rules apply.
      setScheduleExceptions([])
      setTimeOff([])
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadServices()
      void loadBarbers()
      void loadScheduleExceptions()
    })
  }, [])

  useEffect(() => {
    if (!selectedDate || !selectedBarber || !selectedService) {
      queueMicrotask(() => setSlots([]))
      return
    }
    let active = true
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!active) return
      setLoadingSlots(true)
      setSlotsError(false)
      setSelectedTime(null)
      setNextAvailableDate(null)
      setSearchingNextDate(false)
      setNextDateError(false)
    })

    fetch(
      `/api/available-slots?barberId=${encodeURIComponent(
        selectedBarber.id,
      )}&serviceId=${encodeURIComponent(selectedService.id)}&date=${selectedDate}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error('Request failed')
        return res.json()
      })
      .then(async (data: Slot[]) => {
        if (!active) return
        setSlots(data)
        setLoadingSlots(false)
        if (data.some((slot) => slot.available)) return

        setSearchingNextDate(true)
        try {
          const candidate = new Date(`${selectedDate}T00:00:00`)
          const lastDate = getMaxBookingDate(new Date())
          candidate.setDate(candidate.getDate() + 1)
          while (candidate <= lastDate && active) {
            const date = toDateKey(candidate)
            const params = new URLSearchParams({
              barberId: selectedBarber.id,
              serviceId: selectedService.id,
              date,
            })
            const response = await fetch(`/api/available-slots?${params}`, {
              signal: controller.signal,
            })
            if (!response.ok) throw new Error('Request failed')
            const nextSlots: Slot[] = await response.json()
            if (!active) return
            if (nextSlots.some((slot) => slot.available)) {
              setNextAvailableDate(date)
              break
            }
            candidate.setDate(candidate.getDate() + 1)
          }
        } catch (error) {
          if (active && (error as Error).name !== 'AbortError') setNextDateError(true)
        } finally {
          if (active) setSearchingNextDate(false)
        }
      })
      .catch((err: unknown) => {
        if (active && (err as Error).name !== 'AbortError') {
          setSlotsError(true)
        }
      })
      .then(() => {
        if (active) setLoadingSlots(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedDate, selectedBarber, selectedService, slotsRetry])

  const stepDone: Record<number, boolean> = {
    1: Boolean(selectedService),
    2: Boolean(selectedBarber),
    3: Boolean(selectedDate && selectedTime),
    4: Boolean(
      customerName.trim() &&
        normalizeGreekMobilePhone(customerPhone) &&
        isValidCustomerEmail(customerEmail),
    ),
  }

  const canReach = (n: number) =>
    n === 1 ||
    (n === 2 && Boolean(selectedService)) ||
    (n === 3 && Boolean(selectedService && selectedBarber)) ||
    (n === 4 &&
      Boolean(selectedService && selectedBarber && selectedDate && selectedTime))

  const normalizedCustomerPhone = normalizeGreekMobilePhone(customerPhone)

  const canSubmit =
    Boolean(
      customerName.trim() &&
        normalizedCustomerPhone &&
        isValidCustomerEmail(customerEmail),
    ) && !submittingBooking

  // Steps 1-3 advance as soon as a choice is made; only step 4 submits.
  async function handleSubmit() {
    if (
      selectedService &&
      selectedBarber &&
      selectedDate &&
      selectedTime &&
      customerName.trim() &&
      normalizedCustomerPhone &&
      isValidCustomerEmail(customerEmail)
    ) {
      setSubmittingBooking(true)
      setBookingError(null)
      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serviceId: selectedService.id,
            barberId: selectedBarber.id,
            date: selectedDate,
            slotTime: selectedTime,
            customerName: customerName.trim(),
            customerPhone: normalizedCustomerPhone,
            customerEmail: customerEmail.trim(),
            notes: bookingNotes.trim() || null,
          }),
        })

        if (res.status === 403) {
          setBookingError('blocked')
          return
        }
        if (!res.ok) throw new Error('Booking failed')
        const result = (await res.json()) as BookingCreationResponse
        setConfirmedBooking(result)
        setCustomerEmailDelivery(
          result.notificationDelivery?.customerEmail ??
            (customerEmail.trim() ? 'failed' : 'skipped'),
        )
        setConfirmed(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        setBookingError('failed')
      } finally {
        setSubmittingBooking(false)
      }
    }
  }

  function goToStep(n: number) {
    if (canReach(n)) setStep(n as BookingStep)
  }

  // Starts a fresh booking from the success screen.
  function resetBooking() {
    setConfirmed(false)
    setConfirmedBooking(null)
    setSelectedTime(null)
    setSelectedDate(null)
    setBookingNotes('')
    setStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSelectService(service: Service) {
    setSelectedService(service)
    setStep(2)
  }

  const successCard = (confirmed &&
    selectedService &&
    selectedBarber &&
    selectedDate &&
    selectedTime &&
    customerName.trim() &&
    normalizedCustomerPhone) ? (
        <div className="animate-fade-in w-full max-w-md rounded-3xl border border-[var(--page-border)] bg-white p-7 text-center shadow-md sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_24px_rgba(16,185,129,0.28)]">
            <CheckIcon className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-neutral-900">
            Το ραντεβού σας κατοχυρώθηκε με επιτυχία! 🎉
          </h2>
          {customerEmail.trim() ? (
            customerEmailDelivery === 'sent' ? (
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Το email επιβεβαίωσης στάλθηκε. Αν δεν εμφανίζεται στα εισερχόμενα,
                ελέγξτε και τον φάκελο Ανεπιθύμητα / Spam.
              </p>
            ) : (
              <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">
                Η κράτηση ολοκληρώθηκε, αλλά η υπηρεσία email δεν αποδέχτηκε την
                αποστολή. Η κράτηση έχει αποθηκευτεί κανονικά στο σύστημα.
              </p>
            )
          ) : (
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Δεν δηλώθηκε email. Τα στοιχεία του ραντεβού εμφανίζονται παρακάτω.
            </p>
          )}
          <div className="mt-6 space-y-3 rounded-2xl border border-[var(--page-border)] bg-neutral-50 p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Υπηρεσία</span>
              <span className="font-bold text-neutral-900">
                {selectedService.name} · {formatPrice(selectedService.price)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Barber</span>
              <span className="font-bold text-neutral-900">
                {confirmedBooking?.barber?.name ?? selectedBarber.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Ημερομηνία</span>
              <span className="font-bold text-neutral-900">
                {formatDateLong(selectedDate)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Ώρα</span>
              <span className="font-bold text-neutral-900">{selectedTime}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Πελάτης</span>
              <span className="font-bold text-neutral-900">
                {customerName.trim()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Κινητό</span>
              <span className="font-bold text-neutral-900">
                {normalizedCustomerPhone}
              </span>
            </div>
          </div>
          {confirmedBooking?.calendar && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Προσθήκη στο ημερολόγιο
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={confirmedBooking.calendar.google}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--page-border)] px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  Google
                </a>
                <a
                  href={confirmedBooking.calendar.ics}
                  className="rounded-full border border-[var(--page-border)] px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  iPhone / Outlook
                </a>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={resetBooking}
            className="mt-6 w-full rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
          >
            Κλείσε νέο ραντεβού
          </button>
        </div>
  ) : null


  const availableSlots = slots.filter((slot) => slot.available)
  const hasAvailableSlot = availableSlots.length > 0

  return (
    <div
      className="booking-page min-h-screen bg-[var(--page-bg)] font-sans text-neutral-900"
      style={brandStyle}
    >
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-10 pt-5 sm:px-8 sm:pt-8">
        <header className="relative text-center">
          <SocialLinks className="absolute left-0 top-0" />
          <div className="mx-auto relative h-16 w-16 overflow-hidden rounded-full border border-[var(--page-border)] bg-white shadow-sm">
            <Image
              src={SHOP.logoUrl}
              alt={`${SHOP.name} logo`}
              fill
              priority
              sizes="64px"
              className="object-cover"
            />
          </div>
          <p
            className="mt-3 text-sm font-bold uppercase tracking-[0.28em]"
            style={{ color: SHOP.primaryColor }}
          >
            {SHOP.name}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Κλείσε το ραντεβού σου
          </h1>
        </header>

        {successCard ? (
          <div className="mt-8 flex flex-1 justify-center">{successCard}</div>
        ) : (
        <>
        <div className="relative mx-auto mt-8 w-full max-w-2xl px-2 sm:mt-10">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((current) => (current - 1) as BookingStep)}
              aria-label="Πίσω"
              className="absolute -left-2 -top-7 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white hover:text-[var(--brand)] sm:-left-8 sm:top-0.5"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <Stepper
            step={step}
            done={stepDone}
            canReach={canReach}
            onGo={goToStep}
          />
        </div>

        <section
          key={step}
          className="animate-fade-in mt-8 flex-1 transition-all duration-300 ease-in-out"
        >
          <h2 ref={stepHeadingRef} tabIndex={-1} className="sr-only">{STEP_LABELS[step - 1]}</h2>
          {step === 1 && (
            <div className="mx-auto max-w-2xl">
              <div
                className="space-y-3"
              >
                {loadingServices ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))
                ) : servicesError ? (
                  <ErrorState onRetry={loadServices} />
                ) : (
                  groupByCategory(services).map(([category, items]) => (
                  <div key={category || 'none'} className="grid grid-cols-2 items-stretch gap-3 sm:gap-4">
                    {category && (
                      <h3 className="col-span-2 pb-1 pt-4 text-center text-sm font-semibold text-neutral-600">{category}</h3>
                    )}
                  {items.map((service) => {
                    const isSelected = selectedService?.id === service.id
                    const isOpen = openDescriptions.has(service.id)
                    return (
                      <div
                        key={service.id}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 ${
                          isSelected
                            ? 'border-[var(--brand)] bg-gradient-to-b from-[#f4e5e7] to-white shadow-[0_8px_24px_-16px_rgba(128,0,32,0.4)]'
                            : 'border-[var(--page-border)] bg-gradient-to-b from-white to-[#fbf9f5] hover:border-[var(--brand)]/40 hover:shadow-sm'
                        }`}
                      >
                      <button
                        type="button"
                        onClick={() => handleSelectService(service)}
                        aria-pressed={isSelected}
                        className="flex min-h-24 w-full flex-1 flex-col items-center justify-between gap-2 px-3 py-2 text-center sm:min-h-28 sm:px-5 sm:py-3"
                      >
                        <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-2">
                          <h3 className="text-sm font-bold leading-snug text-neutral-900 sm:text-base">
                            {service.name}
                          </h3>
                          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-neutral-600 sm:text-sm">
                            <ClockIcon className="h-4 w-4 text-[var(--brand)]" />
                            <span>{service.duration} λεπτά</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-center">
                          <span className="inline-flex min-w-16 items-center justify-center rounded-full border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-4 py-1 text-sm font-bold tabular-nums text-[var(--brand)]">
                            {formatPrice(service.price)}
                          </span>
                          <span
                            aria-hidden
                            className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200 ${
                              isSelected
                                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                : 'text-transparent'
                            }`}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                      {service.description && (
                        <div className="px-3 pb-1 text-center sm:px-5">
                          <button
                            type="button"
                            onClick={() => toggleDescription(service.id)}
                            aria-expanded={isOpen}
                            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline"
                          >
                            Λεπτομέρειες
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden
                              className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            >
                              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {isOpen && (
                            <p className="animate-fade-in mt-2 whitespace-pre-line text-sm leading-6 text-neutral-500">
                              {service.description}
                            </p>
                          )}
                        </div>
                      )}
                      </div>
                    )
                  })}
                  </div>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="mx-auto grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {loadingBarbers ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <AvatarSkeleton key={i} />
                  ))
                ) : barbersError ? (
                  <div className="col-span-full">
                    <ErrorState onRetry={loadBarbers} />
                  </div>
                ) : (
                  barbers.map((barber) => {
                    const isSelected = selectedBarber?.id === barber.id
                    const showImage =
                      Boolean(barber.image) && !failedBarberImages[barber.id]
                    const barberImageSrc = barber.image
                      ? withImageVersion(barber.image, barber.id)
                      : null
                    return (
                      <button
                        key={barber.id}
                        type="button"
                        onClick={() => {
                          setSelectedBarber(barber)
                          setStep(3)
                        }}
                        aria-pressed={isSelected}
                        className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white text-center transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] ${
                          isSelected
                            ? 'border-[var(--brand)] ring-1 ring-[var(--brand)]'
                            : 'border-[var(--page-border)] hover:border-[var(--brand)] hover:bg-neutral-50'
                        }`}
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100">
                          {showImage && barberImageSrc ? (
                            <Image
                              src={barberImageSrc}
                              alt={barber.name}
                              fill
                              unoptimized
                              sizes="(max-width: 639px) 45vw, 240px"
                              onError={() =>
                                setFailedBarberImages((current) => ({
                                  ...current,
                                  [barber.id]: true,
                                }))
                              }
                              className="object-cover object-center"
                              style={barber.image ? BARBER_PORTRAIT_FRAMING[barber.image.split('?')[0]] : undefined}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-4xl font-semibold text-neutral-400">
                              {barber.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="w-full flex-1 px-3 py-3">
                          <span className="flex items-center justify-center gap-2 break-words text-sm font-semibold text-neutral-900 sm:text-base">
                            {barber.name}
                            {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-[var(--brand)]" />}
                          </span>
                          {barber.bio && (
                            <span className="mt-1 line-clamp-2 block text-xs leading-5 text-neutral-500">
                              {barber.bio}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
              {!loadingBarbers && !barbersError && barbers.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBarber(ANY_BARBER_CHOICE)
                    setStep(3)
                  }}
                  aria-pressed={selectedBarber?.id === ANY_BARBER}
                  className={`mx-auto flex min-h-12 w-full max-w-xl items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] ${selectedBarber?.id === ANY_BARBER ? 'border-[var(--brand)] bg-white ring-1 ring-[var(--brand)]' : 'border-[var(--page-border)] hover:border-[var(--brand)] hover:bg-white/60'}`}
                >
                  <UsersIcon className="h-6 w-6 shrink-0 text-[var(--brand)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Οποιοσδήποτε κουρέας</span>
                    <span className="mt-0.5 block text-xs text-neutral-500">Χωρίς προτίμηση — δες τις διαθέσιμες ώρες όλης της ομάδας.</span>
                  </span>
                  {selectedBarber?.id === ANY_BARBER && <CheckIcon className="h-5 w-5 shrink-0 text-[var(--brand)]" />}
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="mx-auto max-w-3xl">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] md:items-start">
                <section className="rounded-2xl border border-[var(--page-border)] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold capitalize text-neutral-900">
                        {formatMonthTitle(calendarMonth)}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        Διαθέσιμες ημερομηνίες έως {formatDateLong(toDateKey(maxBookingDate))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canGoPreviousMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                        aria-label="Προηγούμενος μήνας"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--page-border)] bg-white text-neutral-700 transition-colors hover:border-[var(--brand)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        disabled={!canGoNextMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                        aria-label="Επόμενος μήνας"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--page-border)] bg-white text-neutral-700 transition-colors hover:border-[var(--brand)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {GR_WEEKDAYS_MON_FIRST.map((day) => (
                      <div
                        key={day}
                        className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
                      >
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((day) => {
                      const key = toDateKey(day)
                      const isCurrentMonth = day.getMonth() === calendarMonth.getMonth()
                      const isPast = day < today
                      const isDisabled =
                        !isCurrentMonth ||
                        isPast ||
                        !selectedBarber ||
                        !(selectedBarber.id === ANY_BARBER ? barbers : [selectedBarber]).some(
                          (barber) =>
                            isDayBookable(
                              day,
                              getBarberPeriodsForDate(barber, key, scheduleExceptions, timeOff),
                              today,
                            ),
                        )
                      const isSelected = selectedDate === key
                      const isToday = key === toDateKey(today)

                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={isDisabled}
                          aria-label={new Intl.DateTimeFormat('el-GR', { dateStyle: 'full' }).format(day)}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedDate(key)
                            setSelectedTime(null)
                          }}
                          className={`relative flex aspect-square min-h-9 items-center justify-center rounded-lg border text-sm font-semibold transition-all duration-200 ease-in-out ${
                            isSelected
                              ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
                              : isDisabled
                                ? 'cursor-not-allowed border-transparent bg-neutral-50 text-neutral-300'
                                : 'border-[var(--page-border)] bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-neutral-50'
                          }`}
                        >
                          <span>{day.getDate()}</span>
                          {isToday && !isSelected && !isDisabled && (
                            <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-[var(--brand)]" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-[var(--page-border)] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5">
                    <h3 className="text-base font-bold text-neutral-900">
                      Διαθέσιμες ώρες
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {selectedDate ? formatDateLong(selectedDate) : 'Επίλεξε ημερομηνία'}
                    </p>
                  </div>

                  {!selectedDate ? (
                    <div className="rounded-2xl border border-dashed border-[var(--page-border)] bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                      Διάλεξε πρώτα μια ημέρα.
                    </div>
                  ) : loadingSlots ? (
                    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SlotSkeleton key={i} />
                      ))}
                    </div>
                  ) : slotsError ? (
                    <ErrorState onRetry={() => setSlotsRetry((value) => value + 1)} />
                  ) : !hasAvailableSlot ? (
                    <div aria-live="polite" className="rounded-2xl border border-dashed border-[var(--page-border)] bg-neutral-50 p-6 text-center text-sm text-neutral-500">
                      <p>Δεν υπάρχει ελεύθερη ώρα αυτή την ημέρα.</p>
                      {searchingNextDate ? (
                        <p className="mt-3">Ψάχνουμε την επόμενη διαθέσιμη ημέρα…</p>
                      ) : nextAvailableDate ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTime(null)
                            setSelectedDate(nextAvailableDate)
                            setCalendarMonth(startOfMonth(new Date(`${nextAvailableDate}T00:00:00`)))
                          }}
                          className="mt-4 min-h-11 w-full rounded-xl bg-[var(--brand)] px-4 py-3 font-semibold text-white"
                        >
                          Δες ώρες για {formatDateLong(nextAvailableDate)}
                        </button>
                      ) : nextDateError ? (
                        <div className="mt-3">
                          <p>Δεν μπορέσαμε να ελέγξουμε τις επόμενες ημέρες.</p>
                          <button type="button" onClick={() => setSlotsRetry((value) => value + 1)} className="mt-2 min-h-11 font-semibold text-[var(--brand)] underline">
                            Δοκίμασε ξανά
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3">Δεν βρέθηκε άλλη διαθέσιμη ημέρα έως {formatDateLong(toDateKey(maxBookingDate))}. Δοκίμασε άλλον κουρέα ή άλλη υπηρεσία.</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedTime === slot.time
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedTime(slot.time)
                              setStep(4)
                            }}
                            className={`h-12 rounded-xl border text-sm font-semibold tabular-nums transition-all duration-300 ease-in-out ${
                              isSelected
                                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
                                  : 'border-[var(--page-border)] bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-neutral-50'
                            }`}
                          >
                            {slot.time}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mx-auto max-w-md space-y-5">
              <p className="text-sm text-neutral-600">Το όνομα, το κινητό και το email είναι υποχρεωτικά.</p>
              <div className="space-y-4 rounded-2xl border border-[var(--page-border)] bg-white p-5 shadow-sm">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Ονοματεπώνυμο
                  </span>
                  <span className="relative mt-2 block">
                    <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      autoComplete="name"
                      onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                      aria-invalid={touched.name && !customerName.trim()}
                      aria-describedby={touched.name && !customerName.trim() ? 'name-error' : undefined}
                      className={inputClass}
                    />
                  </span>
                  {touched.name && !customerName.trim() && <span id="name-error" className="mt-2 block text-sm text-[var(--brand)]">Συμπλήρωσε το ονοματεπώνυμό σου.</span>}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Κινητό Τηλέφωνο
                  </span>
                  <span className="relative mt-2 block">
                    <PhoneIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="69[0-9]{8}"
                      required
                      value={customerPhone}
                      onChange={(event) =>
                        setCustomerPhone(toNationalPhoneInput(event.target.value))
                      }
                      onBlur={(event) => {
                        setCustomerPhone(toNationalPhoneInput(event.target.value))
                        setTouched((current) => ({ ...current, phone: true }))
                      }}
                      autoComplete="tel"
                      aria-invalid={touched.phone && !normalizedCustomerPhone}
                      aria-describedby={touched.phone && !normalizedCustomerPhone ? 'phone-help phone-error' : 'phone-help'}
                      className={inputClass}
                    />
                  </span>
                  <span id="phone-help" className="mt-2 block text-xs text-neutral-600">Ελληνικό κινητό: 10 ψηφία, ξεκινώντας από 69.</span>
                  {touched.phone && !normalizedCustomerPhone && <span id="phone-error" className="mt-2 block text-sm text-[var(--brand)]">Συμπλήρωσε έγκυρο ελληνικό κινητό.</span>}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Email
                  </span>
                  <span className="relative mt-2 block">
                    <EmailIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                      aria-invalid={touched.email && !isValidCustomerEmail(customerEmail)}
                      aria-describedby={touched.email && !isValidCustomerEmail(customerEmail) ? 'email-help email-error' : 'email-help'}
                      className={inputClass}
                    />
                  </span>
                  <span id="email-help" className="mt-2 block text-xs text-neutral-600">Για την επιβεβαίωση και τον σύνδεσμο διαχείρισης του ραντεβού.</span>
                  {touched.email && !isValidCustomerEmail(customerEmail) && <span id="email-error" className="mt-2 block text-sm text-[var(--brand)]">Συμπλήρωσε έγκυρη διεύθυνση email.</span>}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Σχόλιο <span className="normal-case tracking-normal text-neutral-400">(προαιρετικό)</span>
                  </span>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={bookingNotes}
                    onChange={(event) => setBookingNotes(event.target.value)}
                    placeholder="Κάτι που πρέπει να ξέρει ο κουρέας;"
                    className="mt-2 w-full resize-none rounded-2xl border border-[var(--page-border)] bg-white px-4 py-3 text-base text-neutral-900 outline-none transition-all duration-300 ease-in-out placeholder:text-neutral-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </label>
              </div>

              <p className="text-center text-xs leading-5 text-neutral-500">
                Με την καταχώριση του ραντεβού αποδέχεσαι τους{' '}
                <Link
                  href="/booking-terms"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--brand)] underline underline-offset-4"
                >
                  Όρους Κράτησης
                </Link>{' '}
                και επιβεβαιώνεις ότι ενημερώθηκες για την{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--brand)] underline underline-offset-4"
                >
                  Πολιτική Απορρήτου
                </Link>
                .
              </p>

              {bookingError && (
                <div className="rounded-2xl border border-[var(--brand)] bg-[var(--brand)]/5 p-4 text-sm text-[var(--brand)]">
                  {bookingError === 'blocked' ? (
                    <>
                      Δεν είναι δυνατή η online κράτηση για αυτό το κινητό. Κάλεσέ μας στο{' '}
                      <a href={SHOP.phone.href} className="font-semibold underline underline-offset-4">
                        {SHOP.phone.label}
                      </a>{' '}
                      για να κλείσεις ραντεβού.
                    </>
                  ) : (
                    'Δεν μπορέσαμε να καταχωρήσουμε το ραντεβού. Δοκίμασε ξανά.'
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-300 ease-in-out ${
                  canSubmit
                    ? 'bg-[var(--brand)] text-white shadow-sm active:scale-95'
                    : 'cursor-not-allowed bg-neutral-200 text-neutral-400'
                }`}
              >
                {submittingBooking ? 'Καταχώρηση...' : 'Επιβεβαίωση Ραντεβού'}
                <CheckIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
        </>
        )}

        {step === 1 || confirmed ? (
          <ShopInfo schedules={barbers.map((barber) => barber.schedule)} />
        ) : (
          <details key={step} className="mt-8 rounded-2xl border border-[var(--page-border)] px-4">
            <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold text-neutral-700">Πληροφορίες καταστήματος</summary>
            <ShopInfo schedules={barbers.map((barber) => barber.schedule)} />
          </details>
        )}

        <footer className="mt-12 border-t border-[var(--page-border)] pt-6 text-center text-xs leading-5 text-neutral-500">
          <nav
            aria-label="Νομικές πληροφορίες"
            className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2"
          >
            <Link
              href="/booking-terms"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--brand)] underline underline-offset-4"
            >
              Όροι Κράτησης
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--brand)] underline underline-offset-4"
            >
              Πολιτική Απορρήτου
            </Link>
          </nav>
          <div className="mt-5 flex flex-col gap-2 border-t border-[var(--page-border)] pt-5 text-left sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Twins Bros. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  )
}

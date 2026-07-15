'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import {
  BOOKING_WINDOW_DAYS,
  isDayBookable,
  isScheduleExceptionType,
  type NormalizedScheduleException,
  type WorkingPeriod,
  toDateKey,
} from '@/lib/schedule'
import { normalizeGreekMobilePhone, toNationalPhoneInput } from '@/lib/phone'

type Service = {
  id: string
  name: string
  price: number
  duration: number
}

type Barber = {
  id: string
  name: string
  image: string | null
}

type Slot = {
  time: string
  available: boolean
}

type BookingStep = 1 | 2 | 3 | 4
type EmailDeliveryStatus = 'sent' | 'failed' | 'skipped'

type BookingCreationResponse = {
  notificationDelivery?: {
    customerEmail: EmailDeliveryStatus
    shopEmail: 'sent' | 'failed'
  }
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

const STEP_LABELS = ['Υπηρεσία', 'Barber', 'Ημ/νία & Ώρα', 'Στοιχεία Πελάτη']
// Light-mode input: white field, charcoal text, burgundy focus ring.
const inputClass =
  'mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-base text-neutral-900 outline-none transition-all duration-300 ease-in-out placeholder:text-neutral-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]'
// Reusable eyebrow for step/section headers: small, uppercase, sharp gray.
const stepHeaderClass =
  'text-xs font-bold uppercase tracking-wider text-neutral-500'

function apiPath(path: string, shopSlug: string) {
  const params = new URLSearchParams({ shop: shopSlug })
  return `${path}?${params.toString()}`
}

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

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 12h14m-6-7 7 7-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  )
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
      aria-label="Booking progress"
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
                onClick={() => onGo(n)}
                className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl transition-all duration-300 ease-in-out disabled:cursor-not-allowed"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300 ease-in-out sm:h-9 sm:w-9 ${
                    isDone
                      ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                      : isActive
                        ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-neutral-900 shadow-[0_0_0_4px_rgba(128,0,32,0.10)]'
                        : 'border-neutral-200 bg-white text-neutral-400'
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
    <div className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="h-4 w-2/3 rounded bg-neutral-200" />
      <div className="mt-4 h-3 w-1/3 rounded bg-neutral-200" />
    </div>
  )
}

function AvatarSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="aspect-square rounded-2xl bg-neutral-200" />
      <div className="mx-auto mt-4 h-3 w-2/3 rounded bg-neutral-200" />
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

type BookingFormProps = {
  shopSlug?: string
  shopName?: string
  logoUrl?: string | null
  primaryColor?: string
  bookingSubtitle?: string | null
}

type ShopSettings = {
  name: string
  logoUrl: string | null
  primaryColor: string
  bookingSubtitle: string | null
  workingPeriods: WorkingPeriod[]
}

export default function BookingForm({
  shopSlug = 'twins-bros',
  shopName = 'TWINS BROS',
  logoUrl = '/logo.webp',
  primaryColor = '#800020',
  bookingSubtitle = 'Καθαρή επιλογή, ακριβής διάρκεια, premium αποτέλεσμα.',
}: BookingFormProps) {
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    name: shopName,
    logoUrl: logoUrl ?? null,
    primaryColor,
    bookingSubtitle: bookingSubtitle ?? null,
    workingPeriods: [],
  })
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingBarbers, setLoadingBarbers] = useState(true)
  const [servicesError, setServicesError] = useState(false)
  const [barbersError, setBarbersError] = useState(false)

  const [step, setStep] = useState<BookingStep>(1)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [bookingError, setBookingError] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [customerEmailDelivery, setCustomerEmailDelivery] =
    useState<EmailDeliveryStatus | null>(null)
  const [failedBarberImages, setFailedBarberImages] = useState<
    Record<string, boolean>
  >({})

  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(false)

  const [scheduleExceptions, setScheduleExceptions] = useState<
    NormalizedScheduleException[]
  >([])

  const today = startOfDay(new Date())
  const maxBookingDate = getMaxBookingDate(today)
  const calendarDays = buildCalendarGrid(calendarMonth)
  const canGoPreviousMonth = calendarMonth > startOfMonth(today)
  const canGoNextMonth = addMonths(calendarMonth, 1) <= startOfMonth(maxBookingDate)
  const brandColor = shopSettings.primaryColor || primaryColor
  const brandName = shopSettings.name || shopName
  const brandLogo = shopSettings.logoUrl || logoUrl || '/logo.webp'
  const brandSubtitle =
    shopSettings.bookingSubtitle ||
    bookingSubtitle ||
    'Καθαρή επιλογή, ακριβής διάρκεια, premium αποτέλεσμα.'
  const brandStyle = { '--brand': brandColor } as CSSProperties

  async function loadShopSettings() {
    try {
      const res = await fetch(apiPath('/api/shop', shopSlug))
      if (!res.ok) throw new Error('Request failed')
      setShopSettings((await res.json()) as ShopSettings)
    } catch {
      setShopSettings({
        name: shopName,
        logoUrl: logoUrl ?? null,
        primaryColor,
        bookingSubtitle: bookingSubtitle ?? null,
        workingPeriods: [],
      })
    }
  }

  async function loadServices() {
    setLoadingServices(true)
    setServicesError(false)
    try {
      const res = await fetch(apiPath('/api/services', shopSlug))
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
      const res = await fetch(apiPath('/api/barbers', shopSlug))
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
      const res = await fetch(apiPath('/api/schedule-exceptions', shopSlug))
      if (!res.ok) throw new Error('Request failed')
      const data = (await res.json()) as Array<{
        dateKey: string
        barberName: string | null
        type: string
        slotTime: string | null
      }>
      setScheduleExceptions(
        data.flatMap((item) =>
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
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadServices()
      void loadBarbers()
      void loadScheduleExceptions()
      void loadShopSettings()
    })
  }, [shopSlug])

  useEffect(() => {
    if (!selectedDate || !selectedBarber) {
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
    })

    fetch(
      `${apiPath('/api/available-slots', shopSlug)}&barberId=${encodeURIComponent(
        selectedBarber.id,
      )}&date=${selectedDate}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error('Request failed')
        return res.json()
      })
      .then((data: Slot[]) => {
        if (active) setSlots(data)
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
  }, [selectedDate, selectedBarber, shopSlug])

  const stepDone: Record<number, boolean> = {
    1: Boolean(selectedService),
    2: Boolean(selectedBarber),
    3: Boolean(selectedDate && selectedTime),
    4: Boolean(customerName.trim() && normalizeGreekMobilePhone(customerPhone)),
  }

  const canReach = (n: number) =>
    n === 1 ||
    (n === 2 && Boolean(selectedService)) ||
    (n === 3 && Boolean(selectedService && selectedBarber)) ||
    (n === 4 &&
      Boolean(selectedService && selectedBarber && selectedDate && selectedTime))

  const normalizedCustomerPhone = normalizeGreekMobilePhone(customerPhone)

  const canProceed =
    step === 1
      ? Boolean(selectedService)
      : step === 2
        ? Boolean(selectedService && selectedBarber)
        : step === 3
          ? Boolean(selectedDate && selectedTime)
          : Boolean(customerName.trim() && normalizedCustomerPhone) &&
            !submittingBooking

  async function handleNext() {
    if (step === 1 && selectedService) setStep(2)
    else if (step === 2 && selectedService && selectedBarber) setStep(3)
    else if (step === 3 && selectedDate && selectedTime) setStep(4)
    else if (
      step === 4 &&
      selectedService &&
      selectedBarber &&
      selectedDate &&
      selectedTime &&
      customerName.trim() &&
      normalizedCustomerPhone
    ) {
      setSubmittingBooking(true)
      setBookingError(false)
      try {
        const res = await fetch(apiPath('/api/bookings', shopSlug), {
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
          }),
        })

        if (!res.ok) throw new Error('Booking failed')
        const result = (await res.json()) as BookingCreationResponse
        setCustomerEmailDelivery(
          result.notificationDelivery?.customerEmail ??
            (customerEmail.trim() ? 'failed' : 'skipped'),
        )
        setConfirmed(true)
      } catch {
        setBookingError(true)
      } finally {
        setSubmittingBooking(false)
      }
    }
  }

  function goToStep(n: number) {
    if (canReach(n)) setStep(n as BookingStep)
  }

  function handleSelectService(service: Service) {
    setSelectedService(service)
  }

  if (
    confirmed &&
    selectedService &&
    selectedBarber &&
    selectedDate &&
    selectedTime &&
    customerName.trim() &&
    normalizedCustomerPhone
  ) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-10 font-sans text-neutral-900">
        <div className="animate-fade-in w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-7 text-center shadow-md sm:p-8">
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
          <div className="mt-6 space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Υπηρεσία</span>
              <span className="font-bold text-neutral-900">
                {selectedService.name} · {formatPrice(selectedService.price)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Barber</span>
              <span className="font-bold text-neutral-900">
                {selectedBarber.name}
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
        </div>
      </main>
    )
  }

  const hasAvailableSlot = slots.some((s) => s.available)

  return (
    <div
      className="min-h-screen bg-white font-sans text-neutral-900"
      style={brandStyle}
    >
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-36 pt-5 sm:px-6 sm:pb-40 sm:pt-8">
        <header className="text-center">
          <div className="mx-auto relative h-16 w-16 overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm">
            <Image
              src={brandLogo}
              alt={`${brandName} logo`}
              fill
              priority
              sizes="64px"
              className="object-cover"
            />
          </div>
          <p
            className="mt-3 text-sm font-bold uppercase tracking-[0.28em]"
            style={{ color: brandColor }}
          >
            {brandName}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Κλείσε το ραντεβού σου
          </h1>
        </header>

        <div className="mt-7 rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
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
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className={stepHeaderClass}>Επίλεξε υπηρεσία</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  {brandSubtitle}
                </p>
              </div>

              <div className="space-y-3">
                {loadingServices ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))
                ) : servicesError ? (
                  <ErrorState onRetry={loadServices} />
                ) : (
                  services.map((service) => {
                    const isSelected = selectedService?.id === service.id
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleSelectService(service)}
                        className={`group flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${
                          isSelected
                            ? 'border-[var(--brand)] bg-[var(--brand)]/[0.06] ring-1 ring-[var(--brand)]'
                            : 'border-[var(--brand)] bg-white hover:bg-neutral-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-neutral-900 sm:text-lg">
                            {service.name}
                          </h3>
                          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
                            <ClockIcon className="h-4 w-4 text-[var(--brand)]" />
                            <span>{service.duration} λεπτά</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-lg font-bold tabular-nums text-neutral-900">
                            {formatPrice(service.price)}
                          </span>
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-300 ease-in-out ${
                              isSelected
                                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                : 'border-neutral-300 text-transparent group-hover:border-[var(--brand)]'
                            }`}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className={stepHeaderClass}>Διάλεξε barber</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {loadingBarbers ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <AvatarSkeleton key={i} />
                  ))
                ) : barbersError ? (
                  <div className="col-span-2 sm:col-span-3">
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
                        onClick={() => setSelectedBarber(barber)}
                        className={`group rounded-2xl border bg-white p-3 text-left transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${
                          isSelected
                            ? 'border-[var(--brand)] bg-[var(--brand)]/[0.06] ring-1 ring-[var(--brand)]'
                            : 'border-[var(--brand)] hover:bg-neutral-50'
                        }`}
                      >
                        <div className="relative mx-auto aspect-[4/5] w-full max-w-52 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 transition-all duration-300 ease-in-out group-hover:border-[var(--brand)]">
                          {showImage && barberImageSrc ? (
                            <Image
                              src={barberImageSrc}
                              alt={barber.name}
                              fill
                              unoptimized
                              sizes="(max-width: 640px) 46vw, 208px"
                              onError={() =>
                                setFailedBarberImages((current) => ({
                                  ...current,
                                  [barber.id]: true,
                                }))
                              }
                              className="object-contain object-center transition-transform duration-500 ease-in-out group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-4xl font-semibold text-neutral-400">
                              {barber.name.charAt(0)}
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
                          {isSelected && (
                            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-lg">
                              <CheckIcon className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                        <div className="px-1 pb-1 pt-3">
                          <span className="block truncate text-sm font-bold text-neutral-900 sm:text-base">
                            {barber.name}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-7">
              <div>
                <h2 className={stepHeaderClass}>Ημέρα και ώρα</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Βρες το διαθέσιμο slot που ταιριάζει στο πρόγραμμά σου.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] md:items-start">
                <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
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
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-[var(--brand)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        disabled={!canGoNextMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                        aria-label="Επόμενος μήνας"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-[var(--brand)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
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
                        !isDayBookable(
                          day,
                          key,
                          scheduleExceptions,
                          today,
                          shopSettings.workingPeriods,
                        )
                      const isSelected = selectedDate === key
                      const isToday = key === toDateKey(today)

                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setSelectedDate(key)
                            setSelectedTime(null)
                          }}
                          className={`relative flex aspect-square min-h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-200 ease-in-out sm:min-h-14 ${
                            isSelected
                              ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
                              : isDisabled
                                ? 'cursor-not-allowed border-transparent bg-neutral-50 text-neutral-300'
                                : 'border-neutral-200 bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-neutral-50'
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

                <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5">
                    <h3 className="text-base font-bold text-neutral-900">
                      Διαθέσιμες ώρες
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {selectedDate ? formatDateLong(selectedDate) : 'Επίλεξε ημερομηνία'}
                    </p>
                  </div>

                  {!selectedDate ? (
                    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                      Διάλεξε πρώτα μια ημέρα.
                    </div>
                  ) : loadingSlots ? (
                    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SlotSkeleton key={i} />
                      ))}
                    </div>
                  ) : slotsError ? (
                    <ErrorState onRetry={() => setSelectedDate(selectedDate)} />
                  ) : !hasAvailableSlot ? (
                    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                      Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημέρα.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                      {slots.map((slot) => {
                        const isSelected = selectedTime === slot.time
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`h-12 rounded-xl border text-sm font-semibold tabular-nums transition-all duration-300 ease-in-out ${
                              !slot.available
                                ? 'cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300 line-through'
                                : isSelected
                                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
                                  : 'border-neutral-200 bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-neutral-50'
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
            <div className="space-y-5">
              <div>
                <h2 className={stepHeaderClass}>Στοιχεία Πελάτη</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Συμπλήρωσε τα στοιχεία επικοινωνίας για την τελική
                  επιβεβαίωση.
                </p>
              </div>

              <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Όνοματεπώνυμο
                  </span>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="name"
                    placeholder="π.χ. Γιώργος Παπαδόπουλος"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Κινητό Τηλέφωνο
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="69[0-9]{8}"
                    required
                    value={customerPhone}
                    onChange={(event) =>
                      setCustomerPhone(toNationalPhoneInput(event.target.value))
                    }
                    onBlur={(event) =>
                      setCustomerPhone(toNationalPhoneInput(event.target.value))
                    }
                    autoComplete="tel"
                    placeholder="6912345678"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Email
                  </span>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="προαιρετικό"
                    className={inputClass}
                  />
                </label>
              </div>

              {shopSlug === 'salut' && (
                <p className="text-xs leading-5 text-neutral-500">
                  Με την καταχώριση του ραντεβού αποδέχεσαι τους{' '}
                  <Link
                    href={`/booking-terms?${new URLSearchParams({ shop: shopSlug }).toString()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--brand)] underline underline-offset-4"
                  >
                    Όρους Κράτησης
                  </Link>{' '}
                  και επιβεβαιώνεις ότι ενημερώθηκες για την{' '}
                  <Link
                    href={`/privacy?${new URLSearchParams({ shop: shopSlug }).toString()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--brand)] underline underline-offset-4"
                  >
                    Πολιτική Απορρήτου
                  </Link>
                  .
                </p>
              )}

              {bookingError && (
                <div className="rounded-2xl border border-[var(--brand)] bg-[var(--brand)]/5 p-4 text-sm text-[var(--brand)]">
                  Δεν μπορέσαμε να καταχωρήσουμε το ραντεβού. Δοκίμασε ξανά.
                </div>
              )}
            </div>
          )}
        </section>

        {shopSlug === 'salut' && (
          <footer className="mt-10 border-t border-neutral-200 pt-6 text-center text-xs leading-5 text-neutral-500">
            <p className="font-semibold text-neutral-700">SALUT</p>
            <p>Ακτή Καραϊσκάκη 49, Σαλαμίνα 189 00</p>
            <a
              href="tel:+302104654063"
              className="transition-colors hover:text-[var(--brand)]"
            >
              +30 210 465 4063
            </a>
            <nav
              aria-label="Νομικές πληροφορίες"
              className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2"
            >
              <Link
                href={`/booking-terms?${new URLSearchParams({ shop: shopSlug }).toString()}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--brand)] underline underline-offset-4"
              >
                Όροι Κράτησης
              </Link>
              <Link
                href={`/privacy?${new URLSearchParams({ shop: shopSlug }).toString()}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--brand)] underline underline-offset-4"
              >
                Πολιτική Απορρήτου
              </Link>
            </nav>
          </footer>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-4 sm:px-6">
          {step > 1 && (
            <button
              type="button"
              onClick={() =>
                setStep((current) => (current - 1) as BookingStep)
              }
              aria-label="Πίσω"
              className="flex min-h-12 shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition-all duration-300 ease-in-out hover:border-[var(--brand)] hover:bg-neutral-50 active:scale-95 sm:px-5"
            >
              <ArrowIcon className="h-4 w-4 rotate-180" />
              <span className="hidden sm:inline">Πίσω</span>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-neutral-900">
              {selectedService
                ? `${selectedService.name} • ${formatPrice(
                    selectedService.price,
                  )}`
                : 'Επίλεξε υπηρεσία'}
            </p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {step === 4 && customerName.trim()
                ? customerName.trim()
                : selectedBarber
                  ? selectedBarber.name
                  : 'Επίλεξε barber'}
              {selectedDate && selectedTime
                ? ` · ${formatDateLong(selectedDate)} ${selectedTime}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={!canProceed}
            onClick={handleNext}
            className={`flex min-h-12 shrink-0 items-center gap-2 rounded-md px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-300 ease-in-out sm:px-6 ${
              canProceed
                ? 'bg-[var(--brand)] text-white shadow-sm hover:bg-[var(--brand)] active:scale-95'
                : 'cursor-not-allowed bg-neutral-100 text-neutral-400'
            }`}
          >
            <span className="max-w-[9.5rem] truncate sm:max-w-none">
              {step === 4
                ? submittingBooking
                  ? 'Καταχώρηση...'
                  : 'Επιβεβαίωση Ραντεβού'
                : 'Επόμενο'}
            </span>
            {step === 4 ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <ArrowIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import Image from 'next/image'
import { Fragment, useEffect, useState } from 'react'
import {
  BOOKING_WINDOW_DAYS,
  isClosedDay,
  isWithinBookingWindow,
  toDateKey,
} from '@/lib/schedule'

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
const inputClass =
  'mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-base text-zinc-50 outline-none transition-all duration-300 ease-in-out placeholder:text-zinc-600 focus:border-[#A61E22] focus:ring-2 focus:ring-[#A61E22]/35'

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
                      ? 'border-[#A61E22] bg-[#A61E22] text-white'
                      : isActive
                        ? 'border-[#A61E22] bg-[#A61E22]/15 text-zinc-50 shadow-[0_0_0_4px_rgba(166,30,34,0.12)]'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                  }`}
                >
                  {isDone ? <CheckIcon className="h-4 w-4" /> : n}
                </span>
                <span
                  className={`w-full text-center text-[10px] font-semibold leading-tight transition-colors duration-300 sm:text-xs ${
                    isActive
                      ? 'text-zinc-50'
                      : isDone
                        ? 'text-zinc-300'
                        : 'text-zinc-500'
                  }`}
                >
                  <span className="block break-words">{label}</span>
                </span>
              </button>
              {n < STEP_LABELS.length && (
                <span
                  className={`mt-4 h-0.5 w-4 shrink-0 rounded-full transition-colors duration-300 sm:mt-[18px] sm:w-10 ${
                    done[n] ? 'bg-[#A61E22]' : 'bg-zinc-800'
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
    <div className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="h-4 w-2/3 rounded bg-zinc-800" />
      <div className="mt-4 h-3 w-1/3 rounded bg-zinc-800" />
    </div>
  )
}

function AvatarSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="aspect-square rounded-2xl bg-zinc-800" />
      <div className="mx-auto mt-4 h-3 w-2/3 rounded bg-zinc-800" />
    </div>
  )
}

function SlotSkeleton() {
  return <div className="h-12 animate-pulse rounded-2xl bg-zinc-900" />
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-[#A61E22]/50 bg-[#A61E22]/10 p-6 text-center">
      <p className="text-sm text-red-100">
        Κάτι πήγε στραβά κατά τη φόρτωση.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full border border-[#A61E22] px-5 py-2 text-sm font-semibold text-zinc-50 transition-all duration-300 ease-in-out hover:bg-[#A61E22]"
      >
        Δοκίμασε ξανά
      </button>
    </div>
  )
}

export default function Home() {
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
  const [failedBarberImages, setFailedBarberImages] = useState<
    Record<string, boolean>
  >({})

  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(false)

  const today = startOfDay(new Date())
  const maxBookingDate = getMaxBookingDate(today)
  const calendarDays = buildCalendarGrid(calendarMonth)
  const canGoPreviousMonth = calendarMonth > startOfMonth(today)
  const canGoNextMonth = addMonths(calendarMonth, 1) <= startOfMonth(maxBookingDate)

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

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadServices()
      void loadBarbers()
    })
  }, [])

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
      `/api/available-slots?barberId=${encodeURIComponent(
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
  }, [selectedDate, selectedBarber])

  const stepDone: Record<number, boolean> = {
    1: Boolean(selectedService),
    2: Boolean(selectedBarber),
    3: Boolean(selectedDate && selectedTime),
    4: Boolean(customerName.trim() && customerPhone.trim()),
  }

  const canReach = (n: number) =>
    n === 1 ||
    (n === 2 && Boolean(selectedService)) ||
    (n === 3 && Boolean(selectedService && selectedBarber)) ||
    (n === 4 &&
      Boolean(selectedService && selectedBarber && selectedDate && selectedTime))

  const canProceed =
    step === 1
      ? Boolean(selectedService)
      : step === 2
        ? Boolean(selectedService && selectedBarber)
        : step === 3
          ? Boolean(selectedDate && selectedTime)
          : Boolean(customerName.trim() && customerPhone.trim()) &&
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
      customerPhone.trim()
    ) {
      setSubmittingBooking(true)
      setBookingError(false)
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
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim(),
          }),
        })

        if (!res.ok) throw new Error('Booking failed')
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
    setStep(2)
  }

  if (
    confirmed &&
    selectedService &&
    selectedBarber &&
    selectedDate &&
    selectedTime &&
    customerName.trim() &&
    customerPhone.trim()
  ) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-5 py-10 font-sans text-zinc-50">
        <div className="animate-fade-in w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-7 text-center shadow-2xl shadow-black/40 sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#A61E22] text-white shadow-[0_0_40px_rgba(166,30,34,0.35)]">
            <CheckIcon className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">
            Το ραντεβού καταχωρήθηκε!
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Θα επικοινωνήσουμε μαζί σου αν χρειαστεί κάποια αλλαγή.
          </p>
          <div className="mt-6 space-y-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Υπηρεσία</span>
              <span className="font-medium text-zinc-50">
                {selectedService.name} · {formatPrice(selectedService.price)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Barber</span>
              <span className="font-medium text-zinc-50">
                {selectedBarber.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Ημερομηνία</span>
              <span className="font-medium text-zinc-50">
                {formatDateLong(selectedDate)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Ώρα</span>
              <span className="font-medium text-zinc-50">{selectedTime}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Πελάτης</span>
              <span className="font-medium text-zinc-50">
                {customerName.trim()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Κινητό</span>
              <span className="font-medium text-zinc-50">
                {customerPhone.trim()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmed(false)}
            className="mt-6 w-full rounded-full border border-zinc-700 py-3 text-sm font-semibold text-zinc-200 transition-all duration-300 ease-in-out hover:border-[#A61E22] hover:bg-[#A61E22]/15 hover:text-zinc-50"
          >
            Άλλαξε τις επιλογές σου
          </button>
        </div>
      </main>
    )
  }

  const hasAvailableSlot = slots.some((s) => s.available)

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-36 pt-5 sm:px-6 sm:pb-40 sm:pt-8">
        <header className="text-center">
          <div className="mx-auto relative h-16 w-16 overflow-hidden rounded-full border border-[#A61E22]/70 bg-zinc-900 shadow-[0_0_30px_rgba(166,30,34,0.18)]">
            <Image
              src="/logo.webp"
              alt="TWINS BROS logo"
              fill
              priority
              sizes="64px"
              className="object-cover"
            />
          </div>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.28em] text-amber-400">
            TWINS BROS
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Κλείσε το ραντεβού σου
          </h1>
        </header>

        <div className="mt-7 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-3 shadow-2xl shadow-black/20 sm:p-4">
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
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
                  Επίλεξε υπηρεσία
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Καθαρή επιλογή, ακριβής διάρκεια, premium αποτέλεσμα.
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
                        className={`group flex w-full items-center justify-between gap-4 rounded-3xl border p-5 text-left shadow-black/20 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl ${
                          isSelected
                            ? 'border-[#A61E22] bg-zinc-900 shadow-[inset_0_0_0_1px_rgba(166,30,34,0.28),0_22px_60px_rgba(166,30,34,0.16)]'
                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-zinc-50 sm:text-lg">
                            {service.name}
                          </h3>
                          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                            <ClockIcon className="h-4 w-4 text-[#C9484C]" />
                            <span>{service.duration} λεπτά</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-lg font-semibold tabular-nums text-zinc-50">
                            {formatPrice(service.price)}
                          </span>
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-300 ease-in-out ${
                              isSelected
                                ? 'border-[#A61E22] bg-[#A61E22] text-white'
                                : 'border-zinc-700 text-transparent group-hover:border-[#A61E22]/70'
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
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
                  Διάλεξε barber
                </h2>
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
                        className={`group rounded-3xl border bg-zinc-900 p-3 text-left transition-all duration-300 ease-in-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/25 ${
                          isSelected
                            ? 'border-[#A61E22] shadow-[inset_0_0_0_1px_rgba(166,30,34,0.3),0_20px_50px_rgba(166,30,34,0.18)]'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="relative mx-auto aspect-[4/5] w-full max-w-52 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-inner shadow-black/40 transition-all duration-300 ease-in-out group-hover:border-[#A61E22]/70">
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
                            <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-4xl font-semibold text-zinc-500">
                              {barber.name.charAt(0)}
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
                          {isSelected && (
                            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#A61E22] text-white shadow-lg">
                              <CheckIcon className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                        <div className="px-1 pb-1 pt-3">
                          <span className="block truncate text-sm font-semibold text-zinc-50 sm:text-base">
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
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
                  Ημέρα και ώρα
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Βρες το διαθέσιμο slot που ταιριάζει στο πρόγραμμά σου.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] md:items-start">
                <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold capitalize text-zinc-50">
                        {formatMonthTitle(calendarMonth)}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Διαθέσιμες ημερομηνίες έως {formatDateLong(toDateKey(maxBookingDate))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canGoPreviousMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                        aria-label="Προηγούμενος μήνας"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        disabled={!canGoNextMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                        aria-label="Επόμενος μήνας"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {GR_WEEKDAYS_MON_FIRST.map((day) => (
                      <div
                        key={day}
                        className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500"
                      >
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((day) => {
                      const key = toDateKey(day)
                      const isCurrentMonth = day.getMonth() === calendarMonth.getMonth()
                      const isPast = day < today
                      const isClosed = isClosedDay(day)
                      const isOutOfWindow = !isWithinBookingWindow(day, today)
                      const isDisabled = !isCurrentMonth || isPast || isClosed || isOutOfWindow
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
                              ? 'border-[#A61E22] bg-[#A61E22] text-white shadow-[0_16px_34px_rgba(166,30,34,0.26)]'
                              : isDisabled
                                ? 'cursor-not-allowed border-transparent bg-zinc-900/35 text-zinc-700'
                                : 'border-zinc-800 bg-zinc-900 text-zinc-100 hover:-translate-y-0.5 hover:border-[#A61E22]/70 hover:bg-zinc-800'
                          }`}
                        >
                          <span>{day.getDate()}</span>
                          {isToday && !isSelected && !isDisabled && (
                            <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-[#A61E22]" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
                  <div className="mb-5">
                    <h3 className="text-base font-semibold text-zinc-50">
                      Διαθέσιμες ώρες
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {selectedDate ? formatDateLong(selectedDate) : 'Επίλεξε ημερομηνία'}
                    </p>
                  </div>

                  {!selectedDate ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/70 p-8 text-center text-sm text-zinc-400">
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
                    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/70 p-8 text-center text-sm text-zinc-400">
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
                                ? 'cursor-not-allowed border-zinc-900 bg-zinc-900/70 text-zinc-700 line-through'
                                : isSelected
                                  ? 'border-[#A61E22] bg-[#A61E22] text-white shadow-[0_14px_34px_rgba(166,30,34,0.22)]'
                                  : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:-translate-y-0.5 hover:border-[#A61E22]/80 hover:bg-zinc-800'
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
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
                  Στοιχεία Πελάτη
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Συμπλήρωσε τα στοιχεία επικοινωνίας για την τελική
                  επιβεβαίωση.
                </p>
              </div>

              <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl shadow-black/20">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
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
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Κινητό Τηλέφωνο
                  </span>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    autoComplete="tel"
                    placeholder="π.χ. 69XXXXXXXX"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
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

              {bookingError && (
                <div className="rounded-3xl border border-[#A61E22]/50 bg-[#A61E22]/10 p-4 text-sm text-red-100">
                  Δεν μπορέσαμε να καταχωρήσουμε το ραντεβού. Δοκίμασε ξανά.
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-50">
              {selectedService
                ? `${selectedService.name} • ${formatPrice(
                    selectedService.price,
                  )}`
                : 'Επίλεξε υπηρεσία'}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-400">
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
            className={`flex min-h-12 shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-all duration-300 ease-in-out sm:px-6 ${
              canProceed
                ? 'bg-[#A61E22] text-white shadow-[0_16px_40px_rgba(166,30,34,0.25)] hover:scale-105 hover:bg-[#8F171B] active:scale-95'
                : 'cursor-not-allowed bg-zinc-900 text-zinc-600'
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

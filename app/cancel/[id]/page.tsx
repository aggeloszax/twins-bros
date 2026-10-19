import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { SHOP, SITE_THEME } from '@/lib/shop'
import { BARBER_SCHEDULE_SELECT, loadScheduleRules, toScheduleSource } from '@/lib/availability'
import {
  BOOKING_LOCALE,
  BOOKING_TIME_ZONE,
  BOOKING_WINDOW_DAYS,
  canCancelBooking,
  createBookingDateTime,
  getBarberPeriodsForDate,
  getDateKeyInBookingTimeZone,
  isDayBookable,
  parseDateKey,
} from '@/lib/schedule'
import { CancelClient } from './cancel-client'

export const dynamic = 'force-dynamic'

function formatDate(date: Date) {
  return date.toLocaleDateString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function Shell({ children }: { children: React.ReactNode }) {
  const brandColor = SHOP.primaryColor

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--page-bg)] px-5 py-10 font-sans text-neutral-900"
      style={SITE_THEME}
    >
      <div className="animate-fade-in w-full max-w-3xl rounded-3xl border border-[var(--page-border)] bg-white p-4 shadow-sm sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div
            className="relative h-14 w-14 overflow-hidden rounded-full border bg-white"
            style={{ borderColor: brandColor }}
          >
            <Image
              src={SHOP.logoUrl}
              alt={`${SHOP.name} logo`}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
          <p
            className="mt-3 text-xs font-bold uppercase tracking-[0.28em]"
            style={{ color: brandColor }}
          >
            {SHOP.name}
          </p>
        </div>
        <div className="mt-7">{children}</div>
      </div>
    </main>
  )
}

export default async function CancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const { id } = await params
  const query = await searchParams
  const token = Array.isArray(query.token) ? query.token[0] : query.token

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      cancelToken: true,
      startTime: true,
      status: true,
      customerName: true,
      barber: { select: { id: true, name: true, ...BARBER_SCHEDULE_SELECT } },
      service: { select: { id: true, name: true } },
    },
  })

  if (!booking || !token || booking.cancelToken !== token) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Το ραντεβού δεν βρέθηκε
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Ο σύνδεσμος δεν είναι έγκυρος ή το ραντεβού έχει ήδη ακυρωθεί. Αν
            χρειάζεστε βοήθεια, επικοινωνήστε με το μαγαζί.
          </p>
        </div>
      </Shell>
    )
  }

  if (booking.status === 'CANCELLED') {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl text-emerald-600">
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-900">
            Το ραντεβού έχει ήδη ακυρωθεί
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Δεν χρειάζεται να κάνετε κάποια άλλη ενέργεια. Η συγκεκριμένη ώρα
            είναι ξανά διαθέσιμη για κράτηση.
          </p>
        </div>
      </Shell>
    )
  }

  if (!canCancelBooking(booking.startTime, new Date())) {
    return (
      <Shell>
        <div className="text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border bg-white text-2xl"
            style={{ borderColor: SHOP.primaryColor }}
          >
            ⏳
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-neutral-900">
            Δεν είναι δυνατή η ακύρωση online
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600">
            Πολιτική κρατήσεων: Μπορείτε να ακυρώσετε ή να επαναπρογραμματίσετε
            το ραντεβού σας έως και 2,5 ώρες πριν από την ώρα του ραντεβού. Για
            αλλαγές τελευταίας στιγμής, παρακαλώ επικοινωνήστε απευθείας με το
            κατάστημα.
          </p>
        </div>
      </Shell>
    )
  }

  // Days the barber works within the booking window, for "change time".
  const now = new Date()
  const todayKey = getDateKeyInBookingTimeZone(now)
  const dayKeys = Array.from({ length: BOOKING_WINDOW_DAYS + 1 }, (_, index) =>
    getDateKeyInBookingTimeZone(
      new Date((createBookingDateTime(todayKey, '12:00') as Date).getTime() + index * 24 * 60 * 60_000),
    ),
  )
  const rules = await loadScheduleRules(dayKeys[0], dayKeys[dayKeys.length - 1])
  const barberSource = toScheduleSource(booking.barber)
  const bookableDays = dayKeys.filter((key) => {
    const day = parseDateKey(key)
    return (
      day !== null &&
      isDayBookable(day, getBarberPeriodsForDate(barberSource, key, rules.exceptions, rules.timeOff), now)
    )
  })

  return (
    <Shell>
      <CancelClient
        barberId={booking.barber.id}
        serviceId={booking.service.id}
        bookableDays={bookableDays}
        currentDateKey={getDateKeyInBookingTimeZone(booking.startTime)}
        currentTime={formatTime(booking.startTime)}
        id={booking.id}
        token={token}
        brandColor={SHOP.primaryColor}
        details={{
          customerName: booking.customerName,
          service: booking.service.name,
          barber: booking.barber.name,
          date: formatDate(booking.startTime),
          time: formatTime(booking.startTime),
        }}
      />
    </Shell>
  )
}

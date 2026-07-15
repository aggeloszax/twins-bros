import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import {
  BOOKING_LOCALE,
  BOOKING_TIME_ZONE,
  canCancelBooking,
} from '@/lib/schedule'
import { CancelClient } from './cancel-client'

export const dynamic = 'force-dynamic'

type CancelShop = {
  name: string
  logoUrl: string | null
  primaryColor: string
}

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

function Shell({
  children,
  shop,
}: {
  children: React.ReactNode
  shop?: CancelShop
}) {
  const shopName = shop?.name ?? 'Twins Bros'
  const logoUrl = shop?.logoUrl ?? '/logo.webp'
  const brandColor = /^#[0-9a-f]{6}$/i.test(shop?.primaryColor ?? '')
    ? shop!.primaryColor
    : '#ff1f2d'

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-5 py-10 font-sans text-zinc-50"
      style={{
        background: `radial-gradient(circle at top, ${brandColor} 0%, #050505 58%, #050505 100%)`,
      }}
    >
      <div
        className="animate-fade-in w-full max-w-md rounded-3xl border border-white/10 bg-black/55 p-7 shadow-2xl backdrop-blur sm:p-8"
        style={{ boxShadow: `0 25px 60px -20px ${brandColor}` }}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="relative h-14 w-14 overflow-hidden rounded-full border bg-black/40"
            style={{ borderColor: brandColor }}
          >
            <Image
              src={logoUrl}
              alt={`${shopName} logo`}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
          <p
            className="mt-3 text-xs font-bold uppercase tracking-[0.28em]"
            style={{ color: brandColor }}
          >
            {shopName}
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
      barber: { select: { name: true } },
      service: { select: { name: true } },
      shop: {
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
        },
      },
    },
  })

  if (!booking || !token || booking.cancelToken !== token) {
    return (
      <Shell shop={booking?.shop}>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Το ραντεβού δεν βρέθηκε
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Ο σύνδεσμος δεν είναι έγκυρος ή το ραντεβού έχει ήδη ακυρωθεί. Αν
            χρειάζεστε βοήθεια, επικοινωνήστε με το μαγαζί.
          </p>
        </div>
      </Shell>
    )
  }

  if (booking.status === 'CANCELLED') {
    return (
      <Shell shop={booking.shop}>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-400">
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-50">
            Το ραντεβού έχει ήδη ακυρωθεί
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Δεν χρειάζεται να κάνετε κάποια άλλη ενέργεια. Η συγκεκριμένη ώρα
            είναι ξανά διαθέσιμη για κράτηση.
          </p>
        </div>
      </Shell>
    )
  }

  if (!canCancelBooking(booking.startTime, new Date())) {
    return (
      <Shell shop={booking.shop}>
        <div className="text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border bg-white/5 text-2xl"
            style={{ borderColor: booking.shop.primaryColor }}
          >
            ⏳
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-50">
            Δεν είναι δυνατή η ακύρωση online
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            Πολιτική κρατήσεων: Μπορείτε να ακυρώσετε ή να επαναπρογραμματίσετε
            το ραντεβού σας έως και 2,5 ώρες πριν από την ώρα του ραντεβού. Για
            αλλαγές τελευταίας στιγμής, παρακαλώ επικοινωνήστε απευθείας με το
            κατάστημα.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell shop={booking.shop}>
      <CancelClient
        id={booking.id}
        token={token}
        brandColor={booking.shop.primaryColor}
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

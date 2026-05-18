import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import {
  BOOKING_LOCALE,
  BOOKING_TIME_ZONE,
  canCancelBooking,
} from '@/lib/schedule'
import { CancelClient } from './cancel-client'

export const dynamic = 'force-dynamic'

// TODO: Replace with the shop's real phone number. Leaving the bracketed
// placeholder renders the cancellation policy message exactly as specified.
const SHOP_PHONE = '[Βάλε το τηλέφωνο του μαγαζιού]'

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
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#4b0710_0%,#120306_42%,#050505_100%)] px-5 py-10 font-sans text-zinc-50">
      <div className="animate-fade-in w-full max-w-md rounded-3xl border border-white/10 bg-black/45 p-7 shadow-2xl shadow-[#ff1f2d]/10 backdrop-blur sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-[#ff1f2d]/70 bg-[#120306] shadow-[0_0_30px_rgba(255,31,45,0.18)]">
            <Image
              src="/logo.webp"
              alt="TWINS BROS logo"
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.28em] text-[#ff1f2d]">
            TWINS BROS
          </p>
        </div>
        <div className="mt-7">{children}</div>
      </div>
    </main>
  )
}

export default async function CancelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      startTime: true,
      customerName: true,
      barber: { select: { name: true } },
      service: { select: { name: true } },
    },
  })

  if (!booking) {
    return (
      <Shell>
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

  if (!canCancelBooking(booking.startTime, new Date())) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#ff1f2d]/40 bg-[#ff1f2d]/10 text-2xl">
            ⏳
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-50">
            Δεν είναι δυνατή η ακύρωση online
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            Πολιτική κρατήσεων: Μπορείτε να ακυρώσετε ή να επαναπρογραμματίσετε
            το ραντεβού σας έως και 2,5 ώρες πριν από την ώρα του ραντεβού. Για
            αλλαγές τελευταίας στιγμής, παρακαλώ καλέστε στο μαγαζί: {SHOP_PHONE}.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <CancelClient
        id={booking.id}
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

// Web push notifications to the shop's phones (installed admin app).
// The VAPID key pair is generated on first use and kept in the database, so
// a new deployment needs no extra environment variables.

import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { BOOKING_LOCALE, BOOKING_TIME_ZONE, getDateKeyInBookingTimeZone } from '@/lib/schedule'
import { SHOP } from '@/lib/shop'

const VAPID_SETTING_KEY = 'vapid-keys'

type VapidKeys = { publicKey: string; privateKey: string }

let cachedKeys: VapidKeys | null = null

export async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys

  const stored = await prisma.appSetting.findUnique({ where: { key: VAPID_SETTING_KEY } })
  if (stored) {
    cachedKeys = JSON.parse(stored.value) as VapidKeys
    return cachedKeys
  }

  // Two first requests may race; the database keeps whichever pair landed first.
  const generated = webpush.generateVAPIDKeys()
  await prisma.appSetting.createMany({
    data: [{ key: VAPID_SETTING_KEY, value: JSON.stringify(generated) }],
    skipDuplicates: true,
  })
  const saved = await prisma.appSetting.findUniqueOrThrow({ where: { key: VAPID_SETTING_KEY } })
  cachedKeys = JSON.parse(saved.value) as VapidKeys
  return cachedKeys
}

export type PushMessage = {
  title: string
  body: string
  url: string
  tag?: string
}

type Target = { id: string; endpoint: string; p256dh: string; auth: string }

async function deliver(targets: Target[], message: PushMessage) {
  if (targets.length === 0) return { sent: 0, failed: 0 }

  const keys = await getVapidKeys()
  const payload = JSON.stringify(message)
  const expired: string[] = []
  let sent = 0

  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          payload,
          {
            vapidDetails: { subject: SHOP.appUrl, publicKey: keys.publicKey, privateKey: keys.privateKey },
            TTL: 60 * 60 * 24,
            urgency: 'high',
          },
        )
        sent += 1
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        // The browser dropped this subscription (uninstalled, permission off).
        if (status === 404 || status === 410) expired.push(target.id)
        else console.error('Push delivery failed:', { status, endpoint: target.endpoint.slice(0, 60) })
      }
    }),
  )

  if (expired.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } })
  return { sent, failed: targets.length - sent }
}

const TARGET_SELECT = { id: true, endpoint: true, p256dh: true, auth: true } as const

// Devices that follow every barber, plus those following this barber.
export async function notifyShop(barberId: string, message: PushMessage) {
  try {
    const targets = await prisma.pushSubscription.findMany({
      where: { OR: [{ barberId: null }, { barberId }] },
      select: TARGET_SELECT,
    })
    return await deliver(targets, message)
  } catch (error) {
    console.error('Failed to send push notifications:', error)
    return { sent: 0, failed: 0 }
  }
}

export async function notifyDevice(endpoint: string, message: PushMessage) {
  const targets = await prisma.pushSubscription.findMany({ where: { endpoint }, select: TARGET_SELECT })
  return deliver(targets, message)
}

/* ------------------------------ Booking events ----------------------------- */

type BookingSummary = {
  id: string
  startTime: Date
  customerName: string
  barber: { id: string; name: string }
  service: { name: string }
}

function when(date: Date) {
  const day = date.toLocaleDateString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  })
  const time = date.toLocaleTimeString(BOOKING_LOCALE, {
    timeZone: BOOKING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${day} ${time}`
}

// Opens the admin on that day with the booking's drawer.
function bookingUrl(booking: BookingSummary) {
  return `/admin?date=${getDateKeyInBookingTimeZone(booking.startTime)}&booking=${booking.id}`
}

export function notifyNewBooking(booking: BookingSummary) {
  return notifyShop(booking.barber.id, {
    title: `Νέο ραντεβού · ${booking.barber.name}`,
    body: `${booking.customerName}, ${booking.service.name}\n${when(booking.startTime)}`,
    url: bookingUrl(booking),
    tag: `booking-${booking.id}`,
  })
}

export function notifyBookingMoved(booking: BookingSummary, previousStart: Date) {
  return notifyShop(booking.barber.id, {
    title: `Αλλαγή ώρας · ${booking.barber.name}`,
    body: `${booking.customerName}, ${booking.service.name}\n${when(previousStart)} → ${when(booking.startTime)}`,
    url: bookingUrl(booking),
    tag: `booking-${booking.id}`,
  })
}

export function notifyBookingCancelled(booking: BookingSummary) {
  return notifyShop(booking.barber.id, {
    title: `Ακύρωση · ${booking.barber.name}`,
    body: `${booking.customerName} ακύρωσε: ${booking.service.name}, ${when(booking.startTime)}`,
    url: bookingUrl(booking),
    tag: `booking-${booking.id}`,
  })
}

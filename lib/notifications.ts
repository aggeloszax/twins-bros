import { Resend } from 'resend'
import { SHOP } from '@/lib/shop'
import { googleCalendarUrl } from '@/lib/calendar'

const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? SHOP.emailFrom

// Lazy init: the Resend constructor throws when no API key is set, which
// would crash `next build` during page-data collection. Construct it only
// when actually sending, and skip gracefully if the key is missing.
let resendClient: Resend | null = null
function getResend() {
  const apiKey = process.env.RESEND_API_KEY
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
  if (!apiKey) return null
  if (!resendClient) resendClient = new Resend(apiKey)
  return resendClient
}

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? SHOP.appUrl).replace(/\/$/, '')

type BookingNotificationDetails = {
  id: string
  cancelToken: string
  startTime: Date | string
  endTime?: Date | string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes?: string | null
  barber: {
    name: string
  }
  service: {
    name: string
    duration?: number
  }
}

// Cancel and add-to-calendar links for a customer email.
function bookingLinks(details: BookingNotificationDetails) {
  const token = encodeURIComponent(details.cancelToken)
  const start = new Date(details.startTime)
  const end = details.endTime
    ? new Date(details.endTime)
    : new Date(start.getTime() + (details.service.duration ?? 30) * 60_000)
  return {
    cancelUrl: `${APP_BASE_URL}/cancel/${details.id}?token=${token}`,
    googleCalendarUrl: googleCalendarUrl({
      uid: details.id,
      start,
      end,
      serviceName: details.service.name,
      barberName: details.barber.name,
    }),
    icsUrl: `${APP_BASE_URL}/api/bookings/${details.id}/calendar?token=${token}`,
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function sendSMS(phone: string, message: string) {
  console.log(`
==================== SMS NOTIFICATION ====================
[SMS TO: ${phone}]
${message}
==========================================================
`)

  // Later, replace this console.log with a real SMS gateway call, for example:
  // await fetch(process.env.SMS_GATEWAY_URL!, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ to: phone, message }),
  // })
}

function getShopSender() {
  const addressMatch = RESEND_FROM_EMAIL.match(/<([^<>]+)>\s*$/)
  const address = (addressMatch?.[1] ?? RESEND_FROM_EMAIL).trim()
  return `${SHOP.name} <${address}>`
}

async function sendEmail(
  email: string,
  subject: string,
  html: string,
  from: string,
) {
  const resend = getResend()
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject,
    html,
  })

  if (error) {
    console.error('Resend rejected email:', {
      recipient: email,
      name: error.name,
      message: error.message,
    })
    throw new Error(`Resend rejected email: ${error.message}`)
  }

  console.info('Resend accepted email:', {
    recipient: email,
    emailId: data?.id,
  })

  return data?.id ?? null
}

async function trySendEmail(
  email: string,
  subject: string,
  html: string,
  from: string,
) {
  try {
    const emailId = await sendEmail(email, subject, html, from)
    return { status: 'sent' as const, emailId }
  } catch (error) {
    console.error('Email delivery failed:', {
      recipient: email,
      error: error instanceof Error ? error.message : String(error),
    })
    return { status: 'failed' as const }
  }
}

function formatEmailDateTime(startTime: Date | string) {
  const start = new Date(startTime)
  return {
    emailDate: start.toLocaleDateString('el-GR', {
      timeZone: 'Europe/Athens',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    emailTime: start.toLocaleTimeString('el-GR', {
      timeZone: 'Europe/Athens',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  }
}

// Customer-facing booking email. heading and intro are trusted HTML; the
// booking fields must already be escaped.
function customerBookingEmailHtml({
  heading,
  intro,
  serviceName,
  barberName,
  emailDate,
  emailTime,
  cancelUrl,
  googleCalendarUrl,
  icsUrl,
}: {
  heading: string
  intro: string
  serviceName: string
  barberName: string
  emailDate: string
  emailTime: string
  cancelUrl: string
  googleCalendarUrl: string
  icsUrl: string
}) {
  const shopName = escapeHtml(SHOP.name)
  const logoUrl = escapeHtml(new URL(SHOP.logoUrl, `${APP_BASE_URL}/`).toString())
  const brandColor = SHOP.primaryColor
  return `
<section style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #09090b; color: #f4f4f5; border: 1px solid #27272a; border-radius: 18px; overflow: hidden;">
  <div style="padding: 28px; border-bottom: 1px solid #27272a;">
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 18px; border-collapse: collapse;">
      <tr>
        <td style="padding-right: 12px; vertical-align: middle;">
          <img src="${logoUrl}" width="52" height="52" alt="${shopName}" style="display: block; width: 52px; height: 52px; border-radius: 50%; border: 1px solid ${brandColor}; object-fit: cover;" />
        </td>
        <td style="vertical-align: middle;">
          <p style="margin: 0; color: ${brandColor}; font-size: 13px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">${shopName}</p>
        </td>
      </tr>
    </table>
    <h1 style="margin: 0; font-size: 24px; line-height: 1.25;">${heading}</h1>
  </div>
  <div style="padding: 28px;">
    <p style="margin: 0 0 20px; color: #d4d4d8;">${intro}</p>
    <dl style="margin: 0; display: grid; gap: 12px;">
      <div><dt style="color: #a1a1aa; font-size: 13px;">Υπηρεσία</dt><dd style="margin: 4px 0 0; font-weight: 700;">${serviceName}</dd></div>
      <div><dt style="color: #a1a1aa; font-size: 13px;">Barber</dt><dd style="margin: 4px 0 0; font-weight: 700;">${barberName}</dd></div>
      <div><dt style="color: #a1a1aa; font-size: 13px;">Ημερομηνία</dt><dd style="margin: 4px 0 0; font-weight: 700;">${emailDate}</dd></div>
      <div><dt style="color: #a1a1aa; font-size: 13px;">Ώρα</dt><dd style="margin: 4px 0 0; font-weight: 700;">${emailTime}</dd></div>
      <div><dt style="color: #a1a1aa; font-size: 13px;">Διεύθυνση</dt><dd style="margin: 4px 0 0; font-weight: 700;">${escapeHtml(SHOP.address)}</dd></div>
    </dl>
    <p style="margin: 22px 0 0; font-size: 13px; color: #a1a1aa;">
      Προσθήκη στο ημερολόγιο:
      <a href="${escapeHtml(googleCalendarUrl)}" style="color: #f4f4f5; font-weight: 700;">Google</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(icsUrl)}" style="color: #f4f4f5; font-weight: 700;">iPhone / Outlook</a>
    </p>
  </div>
  <div style="padding: 24px 28px; border-top: 1px solid #27272a; text-align: center;">
    <p style="margin: 0 0 14px; color: #a1a1aa; font-size: 13px; line-height: 1.6;">Θέλεις άλλη ώρα ή δεν μπορείς να έρθεις; Άλλαξε ή ακύρωσε το ραντεβού έως και 2,5 ώρες πριν.</p>
    <a href="${cancelUrl}" style="display: inline-block; padding: 12px 26px; border-radius: 999px; background: ${brandColor}; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Αλλαγή ή ακύρωση</a>
  </div>
</section>`
}

export async function sendBookingNotifications(
  bookingDetails: BookingNotificationDetails,
) {
  const { emailDate, emailTime } = formatEmailDateTime(bookingDetails.startTime)
  let customerName = bookingDetails.customerName
  let serviceName = bookingDetails.service.name
  let barberName = bookingDetails.barber.name
  const bookingDate = emailDate
  const bookingTime = emailTime
  const shopSender = getShopSender()

  const smsMessage = `Γεια σου ${customerName}! Το ραντεβού σου για ${serviceName} με τον ${barberName} επιβεβαιώθηκε για ${bookingDate} στις ${bookingTime}. Σε περιμένουμε!`

  await sendSMS(bookingDetails.customerPhone, smsMessage)

  customerName = escapeHtml(customerName)
  serviceName = escapeHtml(serviceName)
  barberName = escapeHtml(barberName)

  let customerEmailDelivery: { status: 'sent' | 'failed' | 'skipped' } = {
    status: 'skipped',
  }

  if (bookingDetails.customerEmail) {
    const subject = `Επιβεβαίωση ραντεβού · ${SHOP.name}`
    const html = customerBookingEmailHtml({
      heading: 'Το ραντεβού σου επιβεβαιώθηκε',
      intro: `Γεια σου ${customerName}, σε περιμένουμε για το ραντεβού σου.`,
      serviceName,
      barberName,
      emailDate,
      emailTime,
      ...bookingLinks(bookingDetails),
    })

    customerEmailDelivery = await trySendEmail(
      bookingDetails.customerEmail,
      subject,
      html,
      shopSender,
    )
  }

  // The shop is no longer emailed about new bookings; barbers will get a
  // push notification on their phone instead.
  console.log(`
==================== BARBER NOTIFICATION ====================
[BARBER]: ${barberName}
Νέο ραντεβού: ${customerName} για ${serviceName}, ${bookingDate} στις ${bookingTime}.
=============================================================
`)

  return {
    customerEmail: customerEmailDelivery.status,
  }
}

// Tells the customer their booking moved to a new time, barber or service.
export async function sendBookingRescheduledEmail(
  bookingDetails: BookingNotificationDetails,
): Promise<'sent' | 'failed' | 'skipped'> {
  if (!bookingDetails.customerEmail) return 'skipped'

  const { emailDate, emailTime } = formatEmailDateTime(bookingDetails.startTime)
  const customerName = escapeHtml(bookingDetails.customerName)
  const html = customerBookingEmailHtml({
    heading: 'Το ραντεβού σου άλλαξε',
    intro: `Γεια σου ${customerName}, το ραντεβού σου μεταφέρθηκε. Αυτά είναι τα νέα στοιχεία.`,
    serviceName: escapeHtml(bookingDetails.service.name),
    barberName: escapeHtml(bookingDetails.barber.name),
    emailDate,
    emailTime,
    ...bookingLinks(bookingDetails),
  })

  const result = await trySendEmail(
    bookingDetails.customerEmail,
    `Αλλαγή ραντεβού · ${SHOP.name}`,
    html,
    getShopSender(),
  )
  return result.status
}

// Day-before reminder, sent by the daily cron job (app/api/cron/reminders).
export async function sendBookingReminderEmail(
  bookingDetails: BookingNotificationDetails,
): Promise<'sent' | 'failed' | 'skipped'> {
  if (!bookingDetails.customerEmail) return 'skipped'

  const { emailDate, emailTime } = formatEmailDateTime(bookingDetails.startTime)
  const customerName = escapeHtml(bookingDetails.customerName)
  const html = customerBookingEmailHtml({
    heading: `Αύριο στις ${emailTime} σε περιμένουμε`,
    intro: `Γεια σου ${customerName}, σου θυμίζουμε το αυριανό σου ραντεβού. Αν δεν μπορείς να έρθεις, ακύρωσέ το για να δοθεί η ώρα σε κάποιον άλλο.`,
    serviceName: escapeHtml(bookingDetails.service.name),
    barberName: escapeHtml(bookingDetails.barber.name),
    emailDate,
    emailTime,
    ...bookingLinks(bookingDetails),
  })

  const result = await trySendEmail(
    bookingDetails.customerEmail,
    `Υπενθύμιση ραντεβού αύριο στις ${emailTime} · ${SHOP.name}`,
    html,
    getShopSender(),
  )
  return result.status
}

// Tells the shop that a customer moved their own booking from the email link.
export async function sendShopBookingMovedEmail(
  bookingDetails: BookingNotificationDetails,
  previousStart: Date,
): Promise<'sent' | 'failed'> {
  const before = formatEmailDateTime(previousStart)
  const after = formatEmailDateTime(bookingDetails.startTime)
  const customerName = escapeHtml(bookingDetails.customerName)
  const result = await trySendEmail(
    SHOP.notificationEmail,
    `🔁 Αλλαγή ώρας — ${customerName}`,
    `<p style="font-family:Arial;color:#f5f5f5;background:#0f0f0f;padding:24px;border-radius:12px;">
      <strong>${customerName}</strong> · ${escapeHtml(bookingDetails.customerPhone)}<br/>
      ${escapeHtml(bookingDetails.service.name)} με τον ${escapeHtml(bookingDetails.barber.name)}<br/><br/>
      Από: ${before.emailDate} στις ${before.emailTime}<br/>
      <strong>Σε: ${after.emailDate} στις ${after.emailTime}</strong>
    </p>`,
    getShopSender(),
  )
  return result.status
}

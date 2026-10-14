import { Resend } from 'resend'
import { SHOP } from '@/lib/shop'

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
  customerName: string
  customerPhone: string
  customerEmail: string | null
  barber: {
    name: string
  }
  service: {
    name: string
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
}: {
  heading: string
  intro: string
  serviceName: string
  barberName: string
  emailDate: string
  emailTime: string
  cancelUrl: string
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
    </dl>
  </div>
  <div style="padding: 24px 28px; border-top: 1px solid #27272a; text-align: center;">
    <p style="margin: 0 0 14px; color: #a1a1aa; font-size: 13px; line-height: 1.6;">Δεν μπορείτε να έρθετε; Μπορείτε να ακυρώσετε έως και 2,5 ώρες πριν το ραντεβού.</p>
    <a href="${cancelUrl}" style="display: inline-block; padding: 12px 26px; border-radius: 999px; background: ${brandColor}; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Ακύρωση Ραντεβού</a>
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
  const customerPhone = escapeHtml(bookingDetails.customerPhone)
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
    const cancelUrl = `${APP_BASE_URL}/cancel/${bookingDetails.id}?token=${encodeURIComponent(bookingDetails.cancelToken)}`
    const html = customerBookingEmailHtml({
      heading: 'Το ραντεβού σου επιβεβαιώθηκε',
      intro: `Γεια σου ${customerName}, σε περιμένουμε για το ραντεβού σου.`,
      serviceName,
      barberName,
      emailDate,
      emailTime,
      cancelUrl,
    })

    customerEmailDelivery = await trySendEmail(
      bookingDetails.customerEmail,
      subject,
      html,
      shopSender,
    )
  }

  bookingDetails.customerPhone = customerPhone

  const shopEmailDelivery = await trySendEmail(
    SHOP.notificationEmail,
    `📅 Νέο Ραντεβού — ${customerName}`,
    `<p style="font-family:Arial;color:#f5f5f5;background:#0f0f0f;padding:24px;border-radius:12px;">
      <strong>${customerName}</strong> · ${bookingDetails.customerPhone}<br/>
      ${serviceName} με τον ${barberName}<br/>
      ${emailDate} στις ${emailTime}
    </p>`,
    shopSender,
  )

  console.log(`
==================== BARBER NOTIFICATION ====================
[BARBER]: ${barberName}
Νέο ραντεβού: ${customerName} για ${serviceName}, ${bookingDate} στις ${bookingTime}.
=============================================================
`)

  return {
    customerEmail: customerEmailDelivery.status,
    shopEmail: shopEmailDelivery.status,
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
    cancelUrl: `${APP_BASE_URL}/cancel/${bookingDetails.id}?token=${encodeURIComponent(bookingDetails.cancelToken)}`,
  })

  const result = await trySendEmail(
    bookingDetails.customerEmail,
    `Αλλαγή ραντεβού · ${SHOP.name}`,
    html,
    getShopSender(),
  )
  return result.status
}

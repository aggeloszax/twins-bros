import { Resend } from 'resend'

const SHOP_EMAIL = 'aggelos2ker@gmail.com'

// Lazy init: the Resend constructor throws when no API key is set, which
// would crash `next build` during page-data collection. Construct it only
// when actually sending, and skip gracefully if the key is missing.
let resendClient: Resend | null = null
function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  if (!resendClient) resendClient = new Resend(apiKey)
  return resendClient
}

// Default to the production URL; override locally via NEXT_PUBLIC_APP_URL.
const APP_BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://twins-bros.vercel.app'
).replace(/\/$/, '')

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

async function sendEmail(email: string, subject: string, html: string) {
  const resend = getResend()
  if (!resend) {
    console.warn(`RESEND_API_KEY missing — skipping email to ${email}`)
    return
  }
  await resend.emails.send({
    from: 'Twins Bros <onboarding@resend.dev>',
    to: email,
    subject,
    html,
  })
}

export async function sendBookingNotifications(
  bookingDetails: BookingNotificationDetails,
) {
  const bookingStart = new Date(bookingDetails.startTime)
  const emailDate = bookingStart.toLocaleDateString('el-GR', {
    timeZone: 'Europe/Athens',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const emailTime = new Date(bookingDetails.startTime).toLocaleTimeString('el-GR', {
    timeZone: 'Europe/Athens',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  let customerName = bookingDetails.customerName
  let serviceName = bookingDetails.service.name
  let barberName = bookingDetails.barber.name
  const customerPhone = escapeHtml(bookingDetails.customerPhone)
  const bookingDate = emailDate
  const bookingTime = emailTime

  const smsMessage = `Γεια σου ${customerName}! Το ραντεβού σου για ${serviceName} με τον ${barberName} επιβεβαιώθηκε για ${bookingDate} στις ${bookingTime}. Σε περιμένουμε!`

  await sendSMS(bookingDetails.customerPhone, smsMessage)

  customerName = escapeHtml(customerName)
  serviceName = escapeHtml(serviceName)
  barberName = escapeHtml(barberName)

  if (bookingDetails.customerEmail) {
    const subject = `Επιβεβαίωση ραντεβού για ${serviceName}`
    const cancelUrl = `${APP_BASE_URL}/cancel/${bookingDetails.id}?token=${encodeURIComponent(bookingDetails.cancelToken)}`
    const html = `
<section style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #09090b; color: #f4f4f5; border: 1px solid #27272a; border-radius: 18px; overflow: hidden;">
  <div style="padding: 28px; border-bottom: 1px solid #27272a;">
    <p style="margin: 0 0 8px; color: #fbbf24; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase;">Premium Barbershop</p>
    <h1 style="margin: 0; font-size: 24px; line-height: 1.25;">Το ραντεβού σου επιβεβαιώθηκε</h1>
  </div>
  <div style="padding: 28px;">
    <p style="margin: 0 0 20px; color: #d4d4d8;">Γεια σου ${customerName}, σε περιμένουμε για το ραντεβού σου.</p>
    <dl style="margin: 0; display: grid; gap: 12px;">
      <div><dt style="color: #a1a1aa; font-size: 13px;">Υπηρεσία</dt><dd style="margin: 4px 0 0; font-weight: 700;">${serviceName}</dd></div>
      <div><dt style="color: #a1a1aa; font-size: 13px;">Barber</dt><dd style="margin: 4px 0 0; font-weight: 700;">${barberName}</dd></div>
      <div><dt style="color: #a1a1aa; font-size: 13px;">Ημερομηνία</dt><dd style="margin: 4px 0 0; font-weight: 700;">${emailDate}</dd></div>
      <div><dt style="color: #a1a1aa; font-size: 13px;">Ώρα</dt><dd style="margin: 4px 0 0; font-weight: 700;">${emailTime}</dd></div>
    </dl>
  </div>
  <div style="padding: 24px 28px; border-top: 1px solid #27272a; text-align: center;">
    <p style="margin: 0 0 14px; color: #a1a1aa; font-size: 13px; line-height: 1.6;">Δεν μπορείτε να έρθετε; Μπορείτε να ακυρώσετε έως και 2,5 ώρες πριν το ραντεβού.</p>
    <a href="${cancelUrl}" style="display: inline-block; padding: 12px 26px; border-radius: 999px; background: #A61E22; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Ακύρωση Ραντεβού</a>
  </div>
</section>`

    await sendEmail(bookingDetails.customerEmail, subject, html)
  }

  bookingDetails.customerPhone = customerPhone

  await sendEmail(
    SHOP_EMAIL,
    `📅 Νέο Ραντεβού — ${customerName}`,
    `<p style="font-family:Arial;color:#f5f5f5;background:#0f0f0f;padding:24px;border-radius:12px;">
      <strong>${customerName}</strong> · ${bookingDetails.customerPhone}<br/>
      ${serviceName} με τον ${barberName}<br/>
      ${emailDate} στις ${emailTime}
    </p>`
  )

  console.log(`
==================== BARBER NOTIFICATION ====================
[BARBER]: ${barberName}
Νέο ραντεβού: ${customerName} για ${serviceName}, ${bookingDate} στις ${bookingTime}.
=============================================================
`)
}

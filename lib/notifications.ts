import { Resend } from 'resend'

const SHOP_EMAIL = 'aggelos2ker@gmail.com'
const DEFAULT_RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'Twins Bros <onboarding@resend.dev>'

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
  shop: {
    slug: string
    name: string
    logoUrl: string | null
    primaryColor: string
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

function getShopSender(shopName: string) {
  const addressMatch = DEFAULT_RESEND_FROM_EMAIL.match(/<([^<>]+)>\s*$/)
  const address = (addressMatch?.[1] ?? DEFAULT_RESEND_FROM_EMAIL).trim()
  const safeShopName = shopName.replace(/[\r\n<>"]/g, '').trim() || 'Booking'
  return `${safeShopName} <${address}>`
}

function getShopLogoUrl(logoUrl: string | null, shopBaseUrl: string) {
  return new URL(logoUrl || '/logo.webp', `${shopBaseUrl}/`).toString()
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
  const shopName = escapeHtml(bookingDetails.shop.name)
  const shopSender = getShopSender(bookingDetails.shop.name)
  // Shop domains may be reserved in the database before their DNS is live.
  // Email actions must always point to the deployed booking application.
  const shopBaseUrl = APP_BASE_URL
  const shopLogoUrl = escapeHtml(
    getShopLogoUrl(bookingDetails.shop.logoUrl, shopBaseUrl),
  )
  const brandColor = /^#[0-9a-f]{6}$/i.test(bookingDetails.shop.primaryColor)
    ? bookingDetails.shop.primaryColor
    : '#A61E22'

  const smsMessage = `Γεια σου ${customerName}! Το ραντεβού σου για ${serviceName} με τον ${barberName} επιβεβαιώθηκε για ${bookingDate} στις ${bookingTime}. Σε περιμένουμε!`

  await sendSMS(bookingDetails.customerPhone, smsMessage)

  customerName = escapeHtml(customerName)
  serviceName = escapeHtml(serviceName)
  barberName = escapeHtml(barberName)

  let customerEmailDelivery: { status: 'sent' | 'failed' | 'skipped' } = {
    status: 'skipped',
  }

  if (bookingDetails.customerEmail) {
    const subject = `Επιβεβαίωση ραντεβού · ${bookingDetails.shop.name}`
    const cancelUrl = `${shopBaseUrl}/cancel/${bookingDetails.id}?token=${encodeURIComponent(bookingDetails.cancelToken)}`
    const html = `
<section style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #09090b; color: #f4f4f5; border: 1px solid #27272a; border-radius: 18px; overflow: hidden;">
  <div style="padding: 28px; border-bottom: 1px solid #27272a;">
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 18px; border-collapse: collapse;">
      <tr>
        <td style="padding-right: 12px; vertical-align: middle;">
          <img src="${shopLogoUrl}" width="52" height="52" alt="${shopName}" style="display: block; width: 52px; height: 52px; border-radius: 50%; border: 1px solid ${brandColor}; object-fit: cover;" />
        </td>
        <td style="vertical-align: middle;">
          <p style="margin: 0; color: ${brandColor}; font-size: 13px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">${shopName}</p>
        </td>
      </tr>
    </table>
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
    <a href="${cancelUrl}" style="display: inline-block; padding: 12px 26px; border-radius: 999px; background: ${brandColor}; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Ακύρωση Ραντεβού</a>
  </div>
</section>`

    customerEmailDelivery = await trySendEmail(
      bookingDetails.customerEmail,
      subject,
      html,
      shopSender,
    )
  }

  bookingDetails.customerPhone = customerPhone

  const shopEmailDelivery = await trySendEmail(
    SHOP_EMAIL,
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

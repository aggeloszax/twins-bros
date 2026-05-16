function formatBookingDate(date: Date) {
  return new Intl.DateTimeFormat('el-GR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatBookingTime(date: Date) {
  return new Intl.DateTimeFormat('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

type BookingNotificationDetails = {
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
  console.log(`
==================== EMAIL NOTIFICATION ====================
[EMAIL TO: ${email}]
[SUBJECT]: ${subject}

${html}
============================================================
`)
}

export async function sendBookingNotifications(
  bookingDetails: BookingNotificationDetails,
) {
  const date = new Date(bookingDetails.startTime)
  const bookingDate = formatBookingDate(date)
  const bookingTime = formatBookingTime(date)
  const customerName = bookingDetails.customerName
  const serviceName = bookingDetails.service.name
  const barberName = bookingDetails.barber.name

  const smsMessage = `Γεια σου ${customerName}! Το ραντεβού σου για ${serviceName} με τον ${barberName} επιβεβαιώθηκε για ${bookingDate} στις ${bookingTime}. Σε περιμένουμε!`

  await sendSMS(bookingDetails.customerPhone, smsMessage)

  if (bookingDetails.customerEmail) {
    const subject = `Επιβεβαίωση ραντεβού για ${serviceName}`
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
      <div><dt style="color: #a1a1aa; font-size: 13px;">Ημερομηνία</dt><dd style="margin: 4px 0 0; font-weight: 700;">${bookingDate}</dd></div>
      <div><dt style="color: #a1a1aa; font-size: 13px;">Ώρα</dt><dd style="margin: 4px 0 0; font-weight: 700;">${bookingTime}</dd></div>
    </dl>
  </div>
</section>`

    await sendEmail(bookingDetails.customerEmail, subject, html)
  }

  console.log(`
==================== BARBER NOTIFICATION ====================
[BARBER]: ${barberName}
Νέο ραντεβού: ${customerName} για ${serviceName}, ${bookingDate} στις ${bookingTime}.
=============================================================
`)
}

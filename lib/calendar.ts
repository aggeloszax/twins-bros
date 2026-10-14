import { SHOP } from '@/lib/shop'

// A booking as a calendar event, for "add to calendar" links and .ics files.
export type CalendarEvent = {
  uid: string
  start: Date
  end: Date
  serviceName: string
  barberName: string
}

function eventTitle(event: CalendarEvent) {
  return `${event.serviceName} · ${SHOP.name}`
}

function eventDetails(event: CalendarEvent) {
  return `${event.serviceName} με τον ${event.barberName}. Τηλέφωνο: ${SHOP.phone.label}`
}

// 2026-10-15T07:00:00.000Z -> 20261015T070000Z
function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function googleCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(event),
    dates: `${utcStamp(event.start)}/${utcStamp(event.end)}`,
    details: eventDetails(event),
    location: SHOP.address,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// RFC 5545 limits lines to 75 octets; longer ones continue after CRLF + space.
function foldIcsLine(line: string) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let currentBytes = 0
  for (const char of line) {
    const size = new TextEncoder().encode(char).length
    if (currentBytes + size > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      currentBytes = 0
    }
    current += char
    currentBytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function buildIcs(event: CalendarEvent, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${SHOP.name}//Booking//EL`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@${new URL(SHOP.appUrl).host}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(event.start)}`,
    `DTEND:${utcStamp(event.end)}`,
    `SUMMARY:${escapeIcsText(eventTitle(event))}`,
    `DESCRIPTION:${escapeIcsText(eventDetails(event))}`,
    `LOCATION:${escapeIcsText(SHOP.address)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(eventTitle(event))}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

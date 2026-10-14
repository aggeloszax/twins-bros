import { buildIcs } from '@/lib/calendar'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Downloads a booking as an .ics file (Apple Calendar, Outlook). The link
// carries the booking's cancel token, like the cancellation link.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const token = new URL(request.url).searchParams.get('token')

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      cancelToken: true,
      status: true,
      startTime: true,
      endTime: true,
      barber: { select: { name: true } },
      service: { select: { name: true } },
    },
  })

  if (!booking || !token || booking.cancelToken !== token || booking.status === 'CANCELLED') {
    return new Response('Not found', { status: 404 })
  }

  const ics = buildIcs({
    uid: booking.id,
    start: booking.startTime,
    end: booking.endTime,
    serviceName: booking.service.name,
    barberName: booking.barber.name,
  })

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="rantevou.ics"',
      'Cache-Control': 'no-store',
    },
  })
}

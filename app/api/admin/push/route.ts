import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { getVapidKeys } from '@/lib/push'

export const dynamic = 'force-dynamic'

type SubscribePayload = {
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  barberId?: unknown
  label?: unknown
}

const DEVICE_SELECT = { id: true, endpoint: true, label: true, barberId: true, createdAt: true } as const

// The public key the browser needs to subscribe, and the registered devices.
export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const [keys, devices] = await Promise.all([
    getVapidKeys(),
    prisma.pushSubscription.findMany({ select: DEVICE_SELECT, orderBy: { createdAt: 'asc' } }),
  ])
  return Response.json({ publicKey: keys.publicKey, devices })
}

// Registers this device, or updates which barber it follows.
export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: SubscribePayload
  try {
    payload = (await request.json()) as SubscribePayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const endpoint = payload.subscription?.endpoint
  const p256dh = payload.subscription?.keys?.p256dh
  const auth = payload.subscription?.keys?.auth
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    endpoint.length > 1000 ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string'
  ) {
    return Response.json({ error: 'Μη έγκυρη συσκευή.' }, { status: 400 })
  }

  let barberId: string | null = null
  if (typeof payload.barberId === 'string' && payload.barberId) {
    const barber = await prisma.barber.findUnique({ where: { id: payload.barberId }, select: { id: true } })
    if (!barber) return Response.json({ error: 'Ο κουρέας δεν βρέθηκε.' }, { status: 404 })
    barberId = barber.id
  }
  const label = typeof payload.label === 'string' ? payload.label.slice(0, 60) : null

  const device = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, barberId, label },
    update: { p256dh, auth, barberId, label },
    select: DEVICE_SELECT,
  })
  return Response.json(device)
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })
  await prisma.pushSubscription.deleteMany({ where: { id } })
  return Response.json({ success: true })
}

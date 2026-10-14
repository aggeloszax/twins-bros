import { requireAdmin } from '@/lib/admin-auth'
import { notifyDevice } from '@/lib/push'
import { SHOP } from '@/lib/shop'

export const dynamic = 'force-dynamic'

// Sends a test notification to one registered device.
export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let endpoint: unknown
  try {
    endpoint = ((await request.json()) as { endpoint?: unknown }).endpoint
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }
  if (typeof endpoint !== 'string') {
    return Response.json({ error: 'endpoint is required' }, { status: 400 })
  }

  const result = await notifyDevice(endpoint, {
    title: SHOP.name,
    body: 'Οι ειδοποιήσεις δουλεύουν σε αυτή τη συσκευή.',
    url: '/admin',
    tag: 'test',
  })
  if (result.sent === 0) {
    return Response.json({ error: 'Η δοκιμαστική ειδοποίηση δεν στάλθηκε.' }, { status: 502 })
  }
  return Response.json({ success: true })
}

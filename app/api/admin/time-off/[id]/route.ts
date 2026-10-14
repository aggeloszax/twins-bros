import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const { id } = await params
    await prisma.timeOff.deleteMany({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete time off:', error)
    return Response.json({ error: 'Failed to delete time off' }, { status: 500 })
  }
}

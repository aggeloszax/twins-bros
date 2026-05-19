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
    await prisma.scheduleException.deleteMany({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete schedule exception:', error)
    return Response.json(
      { error: 'Failed to delete schedule exception' },
      { status: 500 },
    )
  }
}

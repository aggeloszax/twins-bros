import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.booking.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete booking:', error)
    return Response.json({ error: 'Booking not found' }, { status: 404 })
  }
}

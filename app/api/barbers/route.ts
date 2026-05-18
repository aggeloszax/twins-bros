import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const barbers = await prisma.barber.findMany({
      orderBy: { name: 'asc' },
    })
    return Response.json(barbers)
  } catch (error) {
    console.error('Failed to fetch barbers:', error)
    return Response.json(
      { error: 'Failed to fetch barbers' },
      { status: 500 },
    )
  }
}

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: { price: 'asc' },
    })
    return Response.json(services)
  } catch (error) {
    console.error('Failed to fetch services:', error)
    return Response.json(
      { error: 'Failed to fetch services' },
      { status: 500 },
    )
  }
}

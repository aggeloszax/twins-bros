import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Serves an uploaded barber photo. Its URL carries a version that changes on
// every upload, so the response can be cached indefinitely.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const barber = await prisma.barber.findUnique({
      where: { id },
      select: { imageData: true, imageType: true },
    })

    if (!barber?.imageData || !barber.imageType) {
      return new Response('Not found', { status: 404 })
    }

    return new Response(barber.imageData, {
      headers: {
        'Content-Type': barber.imageType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Failed to load barber image:', error)
    return new Response('Failed to load image', { status: 500 })
  }
}

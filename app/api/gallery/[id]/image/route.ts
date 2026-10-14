import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Serves a shop photo. Each photo's bytes never change, so it caches forever.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const photo = await prisma.galleryPhoto.findUnique({
      where: { id },
      select: { data: true, type: true },
    })
    if (!photo) return new Response('Not found', { status: 404 })

    return new Response(photo.data, {
      headers: {
        'Content-Type': photo.type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Failed to load gallery photo:', error)
    return new Response('Failed to load image', { status: 500 })
  }
}

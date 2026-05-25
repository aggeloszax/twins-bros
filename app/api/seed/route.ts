import { prisma } from '@/lib/prisma'

// Seeding mutates the database, so it must never be statically prerendered.
export const dynamic = 'force-dynamic'

const barbers = [
  {
    name: 'Redi',
    image: '/barbers/redi.jpg',
  },
  {
    name: 'Donaldo',
    image: '/barbers/donaldo.webp',
  },
  {
    name: 'Kleidi',
    image: '/barbers/kleidi.png',
  },
]

const services = [
  { name: 'Κούρεμα - Fade', price: 12.0, duration: 30 },
  { name: 'Κούρεμα - Μούσι', price: 15.0, duration: 30 },
  { name: 'Μούσι Τριμάρισμα', price: 7.0, duration: 30 },
  { name: 'Total Grooming', price: 20.0, duration: 30 },
]

export async function GET() {
  try {
    // Booking holds FKs to Barber and Service, so it must be cleared first.
    await prisma.booking.deleteMany()
    await prisma.barber.deleteMany()
    await prisma.service.deleteMany()

    await prisma.barber.createMany({ data: barbers })
    await prisma.service.createMany({ data: services })

    return Response.json({
      success: true,
      message: 'Database seeded successfully',
      inserted: { barbers: barbers.length, services: services.length },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return Response.json(
      {
        success: false,
        message: 'Seeding failed',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

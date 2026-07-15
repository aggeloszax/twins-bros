import BookingForm from '@/app/_components/booking-form'
import { createBookingMetadata } from '@/lib/booking-metadata'
import { SHOP_QUERY_PARAM, resolveBookingPageShop } from '@/lib/shops'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

type HomePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getRequestedShop(searchParams: HomePageProps['searchParams']) {
  const query = await searchParams
  const headerStore = await headers()
  const shop = query[SHOP_QUERY_PARAM]

  return resolveBookingPageShop(
    typeof shop === 'string' ? shop : null,
    headerStore.get('x-forwarded-host') ?? headerStore.get('host'),
  )
}

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  const shop = await getRequestedShop(searchParams)
  return shop ? createBookingMetadata(shop) : {}
}

// The home page IS the booking system: no landing page, the visitor lands
// directly on Step 1 (Service → Barber → Date/Time → Details) of the form.
export default async function HomePage({
  searchParams,
}: HomePageProps) {
  const resolvedShop = await getRequestedShop(searchParams)

  if (!resolvedShop) notFound()

  return (
    <BookingForm
      shopSlug={resolvedShop.slug}
      shopName={resolvedShop.name}
      logoUrl={resolvedShop.logoUrl}
      primaryColor={resolvedShop.primaryColor}
      bookingSubtitle={resolvedShop.bookingSubtitle}
    />
  )
}

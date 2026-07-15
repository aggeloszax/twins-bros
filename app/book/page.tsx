import BookingForm from '@/app/_components/booking-form'
import { createBookingMetadata } from '@/lib/booking-metadata'
import { SHOP_QUERY_PARAM, resolveBookingPageShop } from '@/lib/shops'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

type BookPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getRequestedShop(searchParams: BookPageProps['searchParams']) {
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
}: BookPageProps): Promise<Metadata> {
  const shop = await getRequestedShop(searchParams)
  return shop ? createBookingMetadata(shop) : {}
}

export default async function BookPage({
  searchParams,
}: BookPageProps) {
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

import BookingForm from '@/app/_components/booking-form'
import { createBookingMetadata } from '@/lib/booking-metadata'
import { resolveBookingPageShop } from '@/lib/shops'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type ShopBookingPageProps = {
  params: Promise<{ shop: string }>
}

async function getRequestedShop(params: ShopBookingPageProps['params']) {
  const { shop } = await params
  return resolveBookingPageShop(shop, null)
}

export async function generateMetadata({
  params,
}: ShopBookingPageProps): Promise<Metadata> {
  const shop = await getRequestedShop(params)
  return shop ? createBookingMetadata(shop) : {}
}

export default async function ShopBookingPage({
  params,
}: ShopBookingPageProps) {
  const shop = await getRequestedShop(params)

  if (!shop) notFound()

  return (
    <BookingForm
      shopSlug={shop.slug}
      shopName={shop.name}
      logoUrl={shop.logoUrl}
      primaryColor={shop.primaryColor}
      bookingSubtitle={shop.bookingSubtitle}
    />
  )
}

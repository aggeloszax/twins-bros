import BookingForm from '@/app/_components/booking-form'
import { SHOP_QUERY_PARAM, resolveShop } from '@/lib/shops'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const query = await searchParams
  const headerStore = await headers()
  const shop = query[SHOP_QUERY_PARAM]
  const resolvedShop = await resolveShop({
    explicitSlug: typeof shop === 'string' ? shop : null,
    hostname:
      headerStore.get('x-forwarded-host') ??
      headerStore.get('host'),
  })

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

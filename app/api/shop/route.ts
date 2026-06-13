import { requireShop } from '@/lib/shops'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { shop, response } = await requireShop(request)
  if (response) return response

  return Response.json({
    slug: shop.slug,
    name: shop.name,
    logoUrl: shop.logoUrl,
    primaryColor: shop.primaryColor,
    bookingSubtitle: shop.bookingSubtitle,
    workingPeriods: shop.workingPeriods,
  })
}

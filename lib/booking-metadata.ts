import type { Metadata } from 'next'
import type { ShopContext } from '@/lib/shops'

export function createBookingMetadata(
  shop: Pick<ShopContext, 'slug' | 'name' | 'logoUrl'>,
): Metadata {
  const isSalut = shop.slug === 'salut'
  const title = isSalut
    ? 'Κλείσε ραντεβού | SALUT'
    : `Κλείσε ραντεβού | ${shop.name}`
  const description = isSalut
    ? 'Κλείσε online το ραντεβού σου στο SALUT στη Σαλαμίνα. Επίλεξε υπηρεσία, barber, ημέρα και ώρα.'
    : `Κλείσε online το ραντεβού σου στο ${shop.name}. Επίλεξε υπηρεσία, barber, ημέρα και ώρα.`

  return {
    title,
    description,
    applicationName: shop.name,
    icons: shop.logoUrl
      ? {
          icon: shop.logoUrl,
          apple: shop.logoUrl,
        }
      : undefined,
    openGraph: {
      type: 'website',
      locale: 'el_GR',
      siteName: shop.name,
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

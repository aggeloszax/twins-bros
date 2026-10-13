import type { Metadata } from 'next'
import { SHOP } from '@/lib/shop'

const title = `Κλείσε ραντεβού | ${SHOP.name}`
const description = `Κλείσε online το ραντεβού σου στο ${SHOP.name}. Επίλεξε υπηρεσία, barber, ημέρα και ώρα.`

export const bookingMetadata: Metadata = {
  title,
  description,
  applicationName: SHOP.name,
  icons: {
    icon: SHOP.logoUrl,
    apple: SHOP.logoUrl,
  },
  openGraph: {
    type: 'website',
    locale: 'el_GR',
    siteName: SHOP.name,
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
}

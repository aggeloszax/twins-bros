export type ShopVisitInfo = {
  id: string
  eyebrow: string
  title: string
  description: string
  locationTitle: string
  addressLines: string[]
  directionsUrl: string
  mapTitle: string
  mapEmbedUrl: string
  hoursTitle: string
  hours: {
    day: string
    times: string[]
  }[]
  phone: {
    label: string
    href: string
  }
  footerName: string
  footerAddress: string
}

export type ShopUiConfig = {
  compactMobileServiceList: boolean
  showLegalNotice: boolean
  visitInfo: ShopVisitInfo | null
}

const DEFAULT_SHOP_UI_CONFIG: ShopUiConfig = {
  compactMobileServiceList: false,
  showLegalNotice: false,
  visitInfo: null,
}

const SHOP_UI_CONFIGS: Record<string, ShopUiConfig> = {
  salut: {
    compactMobileServiceList: true,
    showLegalNotice: true,
    visitInfo: {
      id: 'salut-visit-title',
      eyebrow: 'Βρες μας',
      title: 'Επισκέψου το Salut',
      description:
        'Όλες οι πληροφορίες που χρειάζεσαι πριν από το ραντεβού σου.',
      locationTitle: 'Τοποθεσία',
      addressLines: ['Ακτή Καραϊσκάκη 49', 'Σαλαμίνα, 189 00'],
      directionsUrl:
        'https://www.google.com/maps/dir/?api=1&destination=%CE%91%CE%BA%CF%84%CE%AE+%CE%9A%CE%B1%CF%81%CE%B1%CF%8A%CF%83%CE%BA%CE%AC%CE%BA%CE%B7+49%2C+%CE%A3%CE%B1%CE%BB%CE%B1%CE%BC%CE%AF%CE%BD%CE%B1+189+00',
      mapTitle: 'Χάρτης τοποθεσίας Salut',
      mapEmbedUrl:
        'https://www.google.com/maps?q=%CE%91%CE%BA%CF%84%CE%AE+%CE%9A%CE%B1%CF%81%CE%B1%CF%8A%CF%83%CE%BA%CE%AC%CE%BA%CE%B7+49%2C+%CE%A3%CE%B1%CE%BB%CE%B1%CE%BC%CE%AF%CE%BD%CE%B1+189+00&output=embed',
      hoursTitle: 'Ώρες λειτουργίας',
      hours: [
        { day: 'Δευτέρα', times: ['Κλειστά'] },
        { day: 'Τρίτη', times: ['11:00–19:30'] },
        { day: 'Τετάρτη', times: ['09:30–13:30', '17:30–21:00'] },
        { day: 'Πέμπτη–Κυριακή', times: ['Κλειστά'] },
      ],
      phone: {
        label: '+30 210 465 4063',
        href: 'tel:+302104654063',
      },
      footerName: 'SALUT',
      footerAddress: 'Ακτή Καραϊσκάκη 49, Σαλαμίνα 189 00',
    },
  },
}

export function getShopUiConfig(shopSlug: string): ShopUiConfig {
  return SHOP_UI_CONFIGS[shopSlug] ?? DEFAULT_SHOP_UI_CONFIG
}

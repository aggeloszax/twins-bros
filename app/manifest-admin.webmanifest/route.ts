import { SHOP } from '@/lib/shop'

// Web app manifest for the admin, so it can be installed on a phone's home
// screen (required for push notifications on iPhone).
export function GET() {
  return Response.json(
    {
      name: `${SHOP.name} · Διαχείριση`,
      short_name: SHOP.name,
      start_url: '/admin',
      scope: '/admin',
      display: 'standalone',
      background_color: '#f5efe6',
      theme_color: '#f5efe6',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}

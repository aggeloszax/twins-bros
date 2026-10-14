import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SHOP } from '@/lib/shop'

// Lets the admin be added to a phone's home screen as an app.
export const metadata: Metadata = {
  manifest: '/manifest-admin.webmanifest',
  appleWebApp: { capable: true, title: SHOP.name, statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#f5efe6',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}

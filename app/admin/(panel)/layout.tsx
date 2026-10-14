import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { ADMIN_SESSION_COOKIE, isValidSessionToken } from '@/lib/admin-auth'
import { SHOP } from '@/lib/shop'
import { AdminShell } from '../_components/admin-shell'

export const metadata: Metadata = {
  title: `Διαχείριση | ${SHOP.name}`,
  robots: { index: false, follow: false },
}

// `proxy.ts` only checks that the session cookie exists; validate it here too.
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const store = await cookies()
  const token = store.get(ADMIN_SESSION_COOKIE)?.value

  if (!token || !(await isValidSessionToken(token))) {
    redirect('/admin/login')
  }

  return <AdminShell>{children}</AdminShell>
}

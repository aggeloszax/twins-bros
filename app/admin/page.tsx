import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminDashboard from './admin-dashboard'
import { ADMIN_SESSION_COOKIE, isValidSessionToken } from '@/lib/admin-auth'

// `proxy.ts` only checks that the session cookie exists; validate it here too.
export default async function AdminPage() {
  const store = await cookies()
  const raw = store.get(ADMIN_SESSION_COOKIE)?.value

  if (!raw || !(await isValidSessionToken(raw))) {
    redirect('/admin/login')
  }

  return <AdminDashboard />
}

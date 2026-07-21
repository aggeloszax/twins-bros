import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminDashboard from './admin-dashboard'
import { ADMIN_SESSION_COOKIE, isValidSessionToken } from '@/lib/admin-auth'
import {
  DEFAULT_SHOP_SLUG,
  getShopSlugFromSessionCookie,
  withShopParam,
} from '@/lib/shops'

// The active shop is bound to the admin session cookie (`shopSlug:token`), which
// `proxy.ts` guarantees is present before this route renders. Reading it here —
// instead of from a `?shop=` URL param on the client — means a dropped param can
// never silently fall back to the default shop and mix tenants' data.
export default async function AdminPage() {
  const store = await cookies()
  const raw = store.get(ADMIN_SESSION_COOKIE)?.value
  const shopSlug = getShopSlugFromSessionCookie(raw) ?? DEFAULT_SHOP_SLUG

  if (!raw || !(await isValidSessionToken(raw, shopSlug))) {
    redirect(
      shopSlug === DEFAULT_SHOP_SLUG
        ? '/admin/login'
        : withShopParam('/admin/login', shopSlug),
    )
  }

  return <AdminDashboard initialShopSlug={shopSlug} />
}

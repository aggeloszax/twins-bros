'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  computeSessionToken,
  encodeSessionCookieValue,
  verifyAdminPassword,
} from '@/lib/admin-auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { DEFAULT_SHOP_SLUG, getShopSlugFromFormData, withShopParam } from '@/lib/shops'

export type LoginState = { error: string }

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get('password') ?? '')
  const shopSlug = getShopSlugFromFormData(formData)
  const headerStore = await headers()
  const clientIp = getClientIp(headerStore)
  const limited = rateLimit(`admin-login:${shopSlug}:${clientIp}`, {
    limit: 5,
    windowMs: 15 * 60_000,
  })

  if (!limited.allowed) {
    return {
      error:
        'Πολλές αποτυχημένες προσπάθειες. Δοκίμασε ξανά σε λίγα λεπτά.',
    }
  }

  const result = await verifyAdminPassword(password, shopSlug)
  if (!result.valid || !result.tokenSecret) {
    return { error: 'Λάθος κωδικός' }
  }

  const token = await computeSessionToken(result.tokenSecret, shopSlug)
  const store = await cookies()
  store.set({
    name: ADMIN_SESSION_COOKIE,
    value: encodeSessionCookieValue(shopSlug, token),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  })

  // redirect throws a control-flow signal; nothing after it runs.
  redirect(shopSlug === DEFAULT_SHOP_SLUG ? '/admin' : withShopParam('/admin', shopSlug))
}

export async function logout() {
  const store = await cookies()
  store.delete(ADMIN_SESSION_COOKIE)
  redirect('/admin/login')
}

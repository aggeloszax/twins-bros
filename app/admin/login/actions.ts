'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  computeSessionToken,
  verifyAdminPassword,
} from '@/lib/admin-auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export type LoginState = { error: string }

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get('password') ?? '')
  const headerStore = await headers()
  const clientIp = getClientIp(headerStore)
  const limited = rateLimit(`admin-login:${clientIp}`, {
    limit: 5,
    windowMs: 15 * 60_000,
  })

  if (!limited.allowed) {
    return {
      error:
        'Πολλές αποτυχημένες προσπάθειες. Δοκίμασε ξανά σε λίγα λεπτά.',
    }
  }

  const result = await verifyAdminPassword(password)
  if (!result.valid || !result.tokenSecret) {
    return { error: 'Λάθος κωδικός' }
  }

  const token = await computeSessionToken(result.tokenSecret)
  const store = await cookies()
  store.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  })

  // redirect throws a control-flow signal; nothing after it runs.
  redirect('/admin')
}

export async function logout() {
  const store = await cookies()
  store.delete(ADMIN_SESSION_COOKIE)
  redirect('/admin/login')
}

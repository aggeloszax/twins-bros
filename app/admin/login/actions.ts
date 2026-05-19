'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  computeSessionToken,
} from '@/lib/admin-auth'

export type LoginState = { error: string }

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get('password') ?? '')
  const expected = process.env.ADMIN_PASSWORD

  if (!expected) {
    return {
      error:
        'Ο διακομιστής δεν έχει ρυθμισμένο κωδικό. Όρισε το ADMIN_PASSWORD.',
    }
  }
  if (!password || password !== expected) {
    return { error: 'Λάθος κωδικός' }
  }

  const token = await computeSessionToken(expected)
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

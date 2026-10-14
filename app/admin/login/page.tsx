'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { ADMIN_THEME, SHOP } from '@/lib/shop'
import { login, type LoginState } from './actions'

const initialState: LoginState = { error: '' }

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <main
      className="admin-ui flex min-h-screen items-center justify-center bg-[var(--admin-bg)] px-5 font-sans text-[var(--admin-text)]"
      style={ADMIN_THEME}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image
            src={SHOP.logoUrl}
            alt={SHOP.name}
            width={76}
            height={76}
            priority
            className="rounded-full border border-[var(--admin-border)] bg-white object-cover shadow-sm"
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--admin-muted)]">
            {SHOP.name}
          </p>
        </div>

        <form
          action={formAction}
          className="rounded-2xl border border-[var(--admin-border)] bg-white p-7 shadow-[0_1px_2px_rgba(60,40,20,0.04),0_12px_32px_-12px_rgba(60,40,20,0.12)]"
        >
          <h1 className="text-xl font-semibold tracking-tight">Σύνδεση στη διαχείριση</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Βάλε τον κωδικό διαχείρισης.</p>

          <label className="mt-6 block">
            <span className="text-[13px] font-medium">Κωδικός</span>
            <input
              type="password"
              name="password"
              autoFocus
              autoComplete="current-password"
              maxLength={128}
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--admin-border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent-soft)]"
            />
          </label>

          {state.error && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 h-11 w-full rounded-xl bg-[var(--admin-accent)] text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--admin-accent-hover)] disabled:opacity-50"
          >
            {pending ? 'Έλεγχος...' : 'Σύνδεση'}
          </button>
        </form>
      </div>
    </main>
  )
}

'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { ADMIN_THEME, SHOP } from '@/lib/shop'
import { login, type LoginState } from './actions'

const initialState: LoginState = { error: '' }

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.95l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

export function LoginForm({
  googleEnabled,
  googleError,
}: {
  googleEnabled: boolean
  googleError: string | null
}) {
  const [state, formAction, pending] = useActionState(login, initialState)
  const error = state.error || googleError

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

          {googleEnabled && (
            <>
              <a
                href="/api/admin/auth/google"
                className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--admin-border)] bg-white text-sm font-medium shadow-sm transition-colors hover:bg-[var(--admin-surface-2)]"
              >
                <GoogleIcon className="h-[18px] w-[18px]" />
                Σύνδεση με Google
              </a>
              <div className="mt-6 flex items-center gap-3 text-xs text-[var(--admin-muted)]">
                <span className="h-px flex-1 bg-[var(--admin-border)]" />
                ή με κωδικό
                <span className="h-px flex-1 bg-[var(--admin-border)]" />
              </div>
            </>
          )}

          <label className={`${googleEnabled ? 'mt-4' : 'mt-6'} block`}>
            <span className="text-[13px] font-medium">Κωδικός</span>
            <input
              type="password"
              name="password"
              autoFocus={!googleEnabled}
              autoComplete="current-password"
              maxLength={128}
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--admin-border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent-soft)]"
            />
          </label>

          {error && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              {error}
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

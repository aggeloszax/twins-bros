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
      className="admin-ui flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,var(--admin-deep)_0%,var(--admin-bg)_42%,#050505_100%)] px-6 text-white"
      style={ADMIN_THEME}
    >
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-[var(--admin-deep)] bg-black/45 p-8 shadow-2xl shadow-[var(--admin-accent)]/10 backdrop-blur"
      >
        <div className="mb-7 flex flex-col items-center gap-4">
          <Image
            src={SHOP.logoUrl}
            alt={SHOP.name}
            width={86}
            height={86}
            className="rounded-full border border-white/15 bg-black object-cover"
            priority
          />
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--admin-accent)]">
              {SHOP.name}
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">
              Admin Security
            </p>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Admin Security Password
          </span>
          <input
            type="password"
            name="password"
            autoFocus
            autoComplete="current-password"
            maxLength={128}
            className="mt-2 w-full rounded-xl border border-[var(--admin-deep)] bg-black/70 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent)]/25"
            placeholder="••••••••"
          />
        </label>

        {state.error && (
          <p className="mt-3 text-sm text-[var(--admin-accent-soft)]">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-xl bg-[var(--admin-accent)] py-3 text-sm font-black text-white shadow-lg shadow-[var(--admin-accent)]/20 transition hover:bg-[var(--admin-accent-hover)] disabled:opacity-50"
        >
          {pending ? 'Έλεγχος...' : 'Είσοδος'}
        </button>
      </form>
    </main>
  )
}

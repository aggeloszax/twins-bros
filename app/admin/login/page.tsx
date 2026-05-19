'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { login, type LoginState } from './actions'

const initialState: LoginState = { error: '' }

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#4b0710_0%,#120306_42%,#050505_100%)] px-6 text-white">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-[#4b0710] bg-black/45 p-8 shadow-2xl shadow-[#ff1f2d]/10 backdrop-blur"
      >
        <div className="mb-7 flex flex-col items-center gap-4">
          <Image
            src="/logo.webp"
            alt="Twins Bros"
            width={86}
            height={86}
            className="rounded-full border border-white/15 bg-black object-cover"
            priority
          />
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ff1f2d]">
              Twins Bros
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
            className="mt-2 w-full rounded-xl border border-[#4b0710] bg-black/70 px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff1f2d] focus:ring-2 focus:ring-[#ff1f2d]/25"
            placeholder="••••••••"
          />
        </label>

        {state.error && (
          <p className="mt-3 text-sm text-[#ff6b75]">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-xl bg-[#ff1f2d] py-3 text-sm font-black text-white shadow-lg shadow-[#ff1f2d]/20 transition hover:bg-[#d80d19] disabled:opacity-50"
        >
          {pending ? 'Έλεγχος...' : 'Είσοδος'}
        </button>
      </form>
    </main>
  )
}

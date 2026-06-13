'use client'

import Image from 'next/image'
import { useActionState, useEffect, useState, type CSSProperties } from 'react'
import { login, type LoginState } from './actions'

const initialState: LoginState = { error: '' }
const DEFAULT_SHOP_SLUG = 'twins-bros'
const SHOP_QUERY_PARAM = 'shop'
const SHOP_BY_HOSTNAME: Record<string, string> = {
  'twinsbros.gr': 'twins-bros',
  'www.twinsbros.gr': 'twins-bros',
  'salut.gr': 'salut',
  'www.salut.gr': 'salut',
}
const SHOP_NAME_BY_SLUG: Record<string, string> = {
  'twins-bros': 'Twins Bros',
  salut: 'SALUT',
}
const SHOP_LOGO_BY_SLUG: Record<string, string> = {
  'twins-bros': '/logo.webp',
  salut: '/barbers/salut.logo.png',
}
const SHOP_THEME_BY_SLUG: Record<string, CSSProperties> = {
  'twins-bros': {
    '--admin-accent': '#ff1f2d',
    '--admin-accent-hover': '#d80d19',
    '--admin-accent-soft': '#ff6b75',
    '--admin-accent-muted': '#ffb3b8',
    '--admin-deep': '#4b0710',
    '--admin-bg': '#120306',
    '--admin-surface': '#3a050c',
    '--admin-surface-2': '#180307',
  } as CSSProperties,
  salut: {
    '--admin-accent': '#22b8d8',
    '--admin-accent-hover': '#0ea5c6',
    '--admin-accent-soft': '#7ddff0',
    '--admin-accent-muted': '#c7f4fb',
    '--admin-deep': '#064150',
    '--admin-bg': '#03151a',
    '--admin-surface': '#073847',
    '--admin-surface-2': '#05252e',
  } as CSSProperties,
}

function getCurrentShopSlug() {
  if (typeof window === 'undefined') return DEFAULT_SHOP_SLUG
  const params = new URLSearchParams(window.location.search)
  return (
    params.get(SHOP_QUERY_PARAM) ??
    SHOP_BY_HOSTNAME[window.location.hostname.toLowerCase()] ??
    DEFAULT_SHOP_SLUG
  )
}

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)
  const [shopSlug, setShopSlug] = useState(() => {
    return getCurrentShopSlug()
  })
  const shopName = SHOP_NAME_BY_SLUG[shopSlug] ?? 'Twins Bros'
  const shopLogo = SHOP_LOGO_BY_SLUG[shopSlug] ?? '/logo.webp'
  const shopTheme = SHOP_THEME_BY_SLUG[shopSlug] ?? SHOP_THEME_BY_SLUG['twins-bros']

  useEffect(() => {
    setShopSlug(getCurrentShopSlug())
  }, [])

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,var(--admin-deep)_0%,var(--admin-bg)_42%,#050505_100%)] px-6 text-white"
      style={shopTheme}
    >
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-[var(--admin-deep)] bg-black/45 p-8 shadow-2xl shadow-[var(--admin-accent)]/10 backdrop-blur"
      >
        <input type="hidden" name={SHOP_QUERY_PARAM} value={shopSlug} />
        <div className="mb-7 flex flex-col items-center gap-4">
          <Image
            src={shopLogo}
            alt={shopName}
            width={86}
            height={86}
            className="rounded-full border border-white/15 bg-black object-cover"
            priority
          />
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--admin-accent)]">
              {shopName}
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

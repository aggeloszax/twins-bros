'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ADMIN_THEME, SHOP } from '@/lib/shop'
import { logout } from '../login/actions'
import { LogoutIcon } from './ui'

const NAV_ITEMS = [
  { href: '/admin', label: 'Ραντεβού' },
  { href: '/admin/customers', label: 'Πελάτες' },
  { href: '/admin/barbers', label: 'Κουρείς' },
  { href: '/admin/services', label: 'Υπηρεσίες' },
  { href: '/admin/schedule', label: 'Ωράριο' },
  { href: '/admin/revenue', label: 'Έσοδα' },
  { href: '/admin/settings', label: 'Ρυθμίσεις' },
]

export function AdminShell({
  children,
  signedInAs,
}: {
  children: ReactNode
  signedInAs: string | null
}) {
  const pathname = usePathname()

  return (
    <div
      className="admin-ui min-h-screen bg-[var(--admin-bg)] font-sans text-[var(--admin-text)]"
      style={ADMIN_THEME}
    >
      <header className="border-b border-[var(--admin-border)] bg-[var(--admin-bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--admin-bg)]/80">
        <div className="relative mx-auto max-w-[1400px] px-4 pt-5 sm:px-6">
          <div className="flex flex-col items-center">
            <Link href="/admin" className="flex flex-col items-center gap-2">
              <Image
                src={SHOP.logoUrl}
                alt={SHOP.name}
                width={60}
                height={60}
                priority
                className="rounded-full border border-[var(--admin-border)] bg-white object-cover shadow-sm"
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--admin-muted)]">
                {SHOP.name}
              </span>
            </Link>
            {signedInAs && (
              <p className="mt-1.5 max-w-full truncate text-xs text-[var(--admin-muted)]">
                <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
                Συνδεδεμένος ως <span className="font-medium text-[var(--admin-text)]">{signedInAs}</span>
              </p>
            )}
          </div>

          <form action={logout} className="absolute right-4 top-5 sm:right-6">
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-[var(--admin-muted)] transition-colors hover:bg-[#efe7dc] hover:text-[var(--admin-text)]"
            >
              <LogoutIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Αποσύνδεση</span>
            </button>
          </form>

          <nav
            aria-label="Κύριο μενού"
            className="-mx-4 mt-4 flex justify-start gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden"
          >
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative shrink-0 px-3.5 pb-3 pt-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'text-[var(--admin-text)]'
                      : 'text-[var(--admin-muted)] hover:text-[var(--admin-text)]'
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-colors ${
                      active ? 'bg-[var(--admin-accent)]' : 'bg-transparent'
                    }`}
                  />
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}

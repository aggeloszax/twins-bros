'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Lang = 'el' | 'en'

// Greek is the default copy of the page itself; the language toggle currently
// only switches the menu's own labels per the spec ("For now, the toggle can
// change local UI state variables"). Wiring full-page translations is a
// separate, larger change.
const NAV_LABELS: Record<Lang, { href: string; label: string }[]> = {
  el: [
    { href: '#top', label: 'Αρχική' },
    { href: '#services', label: 'Υπηρεσίες' },
    { href: '#barbers', label: 'Οι Μπαρμπέρηδες' },
    { href: '#reviews', label: 'Κριτικές' },
    { href: '#contact', label: 'Επικοινωνία' },
  ],
  en: [
    { href: '#top', label: 'Home' },
    { href: '#services', label: 'Services' },
    { href: '#barbers', label: 'Our Barbers' },
    { href: '#reviews', label: 'Reviews' },
    { href: '#contact', label: 'Contact' },
  ],
}

const BOOK_CTA: Record<Lang, string> = {
  el: 'Κλείσε Ραντεβού',
  en: 'Book an Appointment',
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export default function NavHeader() {
  const [open, setOpen] = useState(false)
  // Greek by default; toggle only persists in component state for now.
  const [lang, setLang] = useState<Lang>('el')

  // Lock body scroll while the drawer is open + close on Escape.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = NAV_LABELS[lang]

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:h-18 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="relative h-9 w-9 overflow-hidden rounded-full border border-[#ff1f2d]/60 bg-black">
              <Image
                src="/logo.webp"
                alt="Twins Bros"
                fill
                sizes="36px"
                priority
                className="object-cover"
              />
            </span>
            <span className="text-sm font-black uppercase tracking-[0.28em] text-[#ff1f2d] sm:text-base">
              Twins Bros
            </span>
          </Link>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="nav-drawer"
            onClick={() => setOpen(true)}
            className="flex h-11 items-center gap-2 border border-white/10 bg-black/40 px-3 text-xs font-black uppercase tracking-[0.2em] text-zinc-100 transition hover:border-[#ff1f2d]/60 hover:bg-[#ff1f2d]/15 sm:px-4"
          >
            <HamburgerIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </header>

      {/* DRAWER + BACKDROP */}
      <div
        id="nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          aria-label="Κλείσιμο μενού"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-black/95 backdrop-blur-lg"
        />
        <aside
          className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0a0a0a]/95 p-6 backdrop-blur-lg shadow-[0_0_60px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out sm:p-8 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3"
            >
              <span className="relative h-9 w-9 overflow-hidden rounded-full border border-[#ff1f2d]/60 bg-black">
                <Image
                  src="/logo.webp"
                  alt="Twins Bros"
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </span>
              <span className="text-sm font-black uppercase tracking-[0.28em] text-white">
                Twins Bros
              </span>
            </Link>
            <button
              type="button"
              aria-label="Κλείσιμο μενού"
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-100 transition hover:border-[#ff0000]/60 hover:bg-[#ff0000]/15"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-10 flex-1">
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    tabIndex={open ? 0 : -1}
                    style={{
                      transitionDelay: open ? `${index * 60 + 80}ms` : '0ms',
                    }}
                    className={`flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4 text-base font-black uppercase tracking-[0.18em] text-zinc-100 transition-all duration-300 ease-out hover:border-[#ff1f2d]/60 hover:bg-[#ff1f2d]/15 hover:text-white ${
                      open
                        ? 'translate-x-0 opacity-100'
                        : 'translate-x-6 opacity-0'
                    }`}
                  >
                    {item.label}
                    <span aria-hidden className="text-[#ff1f2d]">
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <Link
              href="/book"
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
              className="mt-8 flex items-center justify-center gap-2 rounded-full bg-[#ff1f2d] px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-[0_24px_60px_rgba(255,31,45,0.35)] transition hover:bg-[#d80d19]"
            >
              {BOOK_CTA[lang]}
              <span aria-hidden>→</span>
            </Link>
          </nav>

          {/* Language toggle */}
          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
              Γλώσσα · Language
            </p>
            <div
              role="group"
              aria-label="Language"
              className="mt-3 flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1"
            >
              <button
                type="button"
                onClick={() => setLang('el')}
                tabIndex={open ? 0 : -1}
                aria-pressed={lang === 'el'}
                className={`flex-1 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                  lang === 'el'
                    ? 'bg-[#ff1f2d] text-white shadow-[0_8px_24px_rgba(255,31,45,0.35)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Ελληνικά
              </button>
              <span aria-hidden className="text-zinc-700">
                |
              </span>
              <button
                type="button"
                onClick={() => setLang('en')}
                tabIndex={open ? 0 : -1}
                aria-pressed={lang === 'en'}
                className={`flex-1 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                  lang === 'en'
                    ? 'bg-[#ff1f2d] text-white shadow-[0_8px_24px_rgba(255,31,45,0.35)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

// Mock data for now — wired to the database in a later phase.
const BARBERS = [
  { name: 'REDI', image: '/barbers/redi.png' },
  { name: 'DONALDO', image: '/barbers/donaldo.png' },
  { name: 'KLEIDI', image: '/barbers/kleidi.png' },
]

// Clean 3-line hamburger — custom SVG so every pixel of the silhouette is
// ours, no third-party icon weight.
function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" fill="none" aria-hidden className={className}>
      <line
        x1="2"
        y1="5"
        x2="30"
        y2="5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="12"
        x2="30"
        y2="12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="19"
        x2="30"
        y2="19"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  // Greek is the default loaded language; the selector flips local UI state
  // only — full-page translations remain a later phase.
  const [lang, setLang] = useState<'el' | 'en'>('el')

  // Phase 1: the real slide-out drawer comes in a later phase. For now this
  // just flips state and logs, per spec.
  function toggleMenu() {
    setMenuOpen((prev) => {
      const next = !prev
      console.log(next ? 'open' : 'closed')
      return next
    })
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* HEADER — sticky, semi-opaque with blur so it sits over the hero cleanly */}
      <header className="sticky top-0 z-50 bg-black px-4 py-3 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-black/95">
        <Link href="/" aria-label="Twins Bros" className="flex items-center">
          <Image
            src="/logo.webp"
            alt="Twins Bros"
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-full brightness-110 contrast-110"
          />
        </Link>

        <div className="flex items-center gap-3">
          {/* Minimal segmented language switch */}
          <div
            role="group"
            aria-label="Language"
            className="flex items-center gap-0 border border-neutral-700 rounded-md overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setLang('el')}
              aria-pressed={lang === 'el'}
              className={`px-2.5 py-1 uppercase text-sm transition border-r border-neutral-700 ${
                lang === 'el'
                  ? 'text-white font-black'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              ΕΛ
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              className={`px-2.5 py-1 uppercase text-sm transition ${
                lang === 'en'
                  ? 'text-white font-black'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={toggleMenu}
            className="flex h-10 w-10 items-center justify-center text-white transition-transform duration-200 hover:scale-110 active:scale-90"
          >
            <HamburgerIcon className="h-6 w-7" />
          </button>
        </div>
      </header>

      {/* HERO — asymmetric, bottom-left Reels/TikTok layout (video loop lands here later) */}
      <section className="relative w-full h-[calc(100vh-60px)] bg-black overflow-hidden flex items-end justify-start px-6 pb-12">
        {/* Heavy bottom-weighted gradient keeps the lower text readable */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10 pointer-events-none"
        />

        <div className="relative z-20 flex flex-col items-start text-left max-w-sm gap-3">
          <h1 className="text-3xl font-black uppercase tracking-[-0.02em] leading-none text-white">
            TWINS BROS
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            The Art of Grooming
          </p>
          <Link
            href="/book"
            className="mt-2 inline-block bg-[#800020] px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition-transform duration-150 hover:scale-[1.03] active:scale-95"
          >
            Κλείσε Ραντεβού
          </Link>
        </div>
      </section>

      {/* BARBERS — horizontal snap-scroll */}
      <section className="bg-[#000000] py-12 px-6">
        <h2 className="text-2xl font-black uppercase tracking-tight mb-6 text-left text-white">
          ΟΙ ΜΠΑΡΜΠΕΡΗΔΕΣ ΜΑΣ
        </h2>

        <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {BARBERS.map((barber) => (
            <article
              key={barber.name}
              className="min-w-[75vw] sm:min-w-[300px] snap-start bg-neutral-900/60 border border-white/10 p-6 flex flex-col justify-end h-[350px] relative overflow-hidden"
            >
              <Image
                src={barber.image}
                alt={barber.name}
                fill
                sizes="(max-width: 640px) 75vw, 300px"
                className="object-cover object-center"
              />
              {/* Subtle dark overlay so the image blends and the name stays readable */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"
              />
              <h3 className="relative z-10 text-4xl font-black uppercase tracking-tight leading-none text-white">
                {barber.name}
              </h3>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

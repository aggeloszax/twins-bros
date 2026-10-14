import { SHOP } from '@/lib/shop'

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 3c.3 2.3 1.7 3.9 4 4.1v3.1c-1.5.1-2.8-.4-4-1.2v6.1c0 3.6-2.7 5.9-5.8 5.9-3.4 0-5.9-2.8-5.4-6.3.4-2.8 2.9-4.8 5.9-4.5v3.2c-.4-.1-.8-.2-1.2-.1-1.3.2-2.2 1.3-2 2.6.2 1.2 1.2 2 2.4 1.9 1.3-.1 2.1-1.1 2.1-2.5V3h4Z" />
    </svg>
  )
}

const LINK_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-[var(--brand)] hover:text-[var(--brand)]'

// The shop's social profiles; each shows only when set in lib/shop.ts.
export function SocialLinks({ className = '' }: { className?: string }) {
  if (!SHOP.instagram && !SHOP.tiktok) return null
  return (
    <div className={`flex gap-2 ${className}`}>
      {SHOP.instagram && (
        <a
          href={`https://www.instagram.com/${SHOP.instagram}/`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Instagram: @${SHOP.instagram}`}
          className={LINK_CLASS}
        >
          <InstagramIcon className="h-5 w-5" />
        </a>
      )}
      {SHOP.tiktok && (
        <a
          href={`https://www.tiktok.com/@${SHOP.tiktok}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`TikTok: @${SHOP.tiktok}`}
          className={LINK_CLASS}
        >
          <TikTokIcon className="h-[18px] w-[18px]" />
        </a>
      )}
    </div>
  )
}

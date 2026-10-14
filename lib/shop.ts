import type { CSSProperties } from 'react'

// Single source of truth for the shop's identity. The app serves only
// Twins Bros, so branding and contact details live in code, not the database.
export const SHOP = {
  name: 'Twins Bros',
  logoUrl: '/logo.webp',
  primaryColor: '#800020',
  bookingSubtitle: 'Καθαρή επιλογή, ακριβής διάρκεια, premium αποτέλεσμα.',
  // Shown on the privacy policy and booking terms pages.
  address: 'Αναπαύσεως 14, Περιστέρι',
  phone: {
    label: '+30 211 218 0304',
    href: 'tel:+302112180304',
  },
  // Social usernames without @, or null to hide the icon (top left of the
  // booking page).
  instagram: 'twins_br0s' as string | null,
  tiktok: 'twins_br0s' as string | null,
  adminEmail: 'admin@twins-bros.gr',
  // Public URL of the deployed app, used for links in emails.
  // NEXT_PUBLIC_APP_URL overrides it (e.g. for local testing).
  appUrl: 'https://barber-booking-gr.vercel.app',
  // Sender address for emails. It must be on a domain verified in Resend;
  // onboarding@resend.dev only delivers to the Resend account owner.
  // RESEND_FROM_EMAIL overrides it.
  emailFrom: 'onboarding@resend.dev',
} as const

// CSS custom properties for the admin UI (login and dashboard): a light beige
// workspace with the shop's brand colour as the accent.
export const ADMIN_THEME = {
  '--admin-bg': '#f5efe6',
  '--admin-surface': '#ffffff',
  '--admin-surface-2': '#fbf8f3',
  '--admin-border': '#e6dccd',
  '--admin-text': '#1f1a17',
  '--admin-muted': '#7a6f64',
  '--admin-accent': SHOP.primaryColor,
  '--admin-accent-hover': `color-mix(in srgb, ${SHOP.primaryColor} 82%, black)`,
  '--admin-accent-soft': `color-mix(in srgb, ${SHOP.primaryColor} 9%, white)`,
} as CSSProperties

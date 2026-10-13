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
  adminEmail: 'admin@twins-bros.gr',
} as const

// CSS custom properties for the dark admin UI (login and dashboard).
export const ADMIN_THEME = {
  '--admin-accent': '#ff1f2d',
  '--admin-accent-hover': '#d80d19',
  '--admin-accent-soft': '#ff6b75',
  '--admin-accent-muted': '#ffb3b8',
  '--admin-deep': '#4b0710',
  '--admin-bg': '#120306',
  '--admin-surface': '#3a050c',
  '--admin-surface-2': '#180307',
} as CSSProperties

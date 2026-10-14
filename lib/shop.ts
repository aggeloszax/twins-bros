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
  // Public URL of the deployed app, used for links in emails.
  // NEXT_PUBLIC_APP_URL overrides it (e.g. for local testing).
  appUrl: 'https://barber-booking-gr.vercel.app',
  // Inbox that receives a notification for every new booking.
  notificationEmail: 'aggelos2ker@gmail.com',
  // Sender address for emails. It must be on a domain verified in Resend;
  // onboarding@resend.dev only delivers to the Resend account owner.
  // RESEND_FROM_EMAIL overrides it.
  emailFrom: 'onboarding@resend.dev',
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

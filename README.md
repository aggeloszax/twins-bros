This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Admin passkey lock

Before deploying the passkey feature, apply the committed migration with
`npx prisma migrate deploy` against the intended database, then run `npm run build`.
The migration adds three tables with row-level security enabled; it does not
change existing bookings or enable the lock automatically.

The trusted WebAuthn origin defaults to `https://barber-booking-gr.vercel.app`.
For another production domain, set `ADMIN_PASSKEY_ORIGIN` to its exact HTTPS
origin (without a trailing slash) before enrolling passkeys. Local development
supports `http://localhost:<port>`. Passkeys are bound to their original domain.

In Admin → Settings → Face ID / passkey, enter the existing admin password and
register a passkey on the device. Once enabled, all admin browsers require a
fresh unlock when loading the admin, returning from a hidden tab/app, or restoring
it from the back-forward cache. Internal admin navigation remains unlocked.
The unlock button invokes the device's passkey prompt; the OS chooses Face ID,
fingerprint, or its device-code fallback. A website cannot require Face ID alone.
Biometric data never reaches this application.

The existing admin login is still required. A password-based unlock is available
if the passkey is unavailable. Additional devices may enroll their own passkeys.
Disabling the lock in Settings requires an unlocked session and the admin password
and removes all registered admin passkeys from the server.

Unlock grants live only in tab memory, expire after 12 hours at most, and are
revoked on hide/pagehide when the browser can send the request. Reopening or
reloading never restores them. Admin APIs enforce the grant independently of the
UI. Challenges are session-bound, expire after five minutes and are consumed
atomically. Recovery never disables the lock merely by logging out and back in.

Run `npm test` for cryptographic verification, replay/expiry/origin rejection,
server authorization, and UI lifecycle tests. Final device QA should cover iPhone
Safari and the home-screen app: enroll, unlock, cancel, switch apps, lock the
phone, reload, reopen, and verify password recovery. Real biometric prompts must
be tested on the device.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

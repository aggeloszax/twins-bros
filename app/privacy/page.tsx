import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import { SHOP_QUERY_PARAM, resolveShop } from '@/lib/shops'

export const dynamic = 'force-dynamic'

const LAST_UPDATED = '15 Ιουλίου 2026'

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const query = await searchParams
  const headerStore = await headers()
  const requestedShop = query[SHOP_QUERY_PARAM]
  const shop = await resolveShop({
    explicitSlug: typeof requestedShop === 'string' ? requestedShop : null,
    hostname:
      headerStore.get('x-forwarded-host') ?? headerStore.get('host'),
  })

  if (!shop || shop.slug !== 'salut') notFound()

  const bookingUrl = `/?${new URLSearchParams({
    [SHOP_QUERY_PARAM]: shop.slug,
  }).toString()}`

  return (
    <main
      className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-900 sm:px-6 sm:py-12"
      style={{ '--brand': shop.primaryColor } as CSSProperties}
    >
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-200 px-6 py-7 sm:px-10 sm:py-9">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-full border border-neutral-200 bg-white">
              <Image
                src={shop.logoUrl ?? '/logo.webp'}
                alt={`${shop.name} logo`}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)]">
                {shop.name}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Πολιτική Απορρήτου
              </h1>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-neutral-500">
            Τελευταία ενημέρωση: {LAST_UPDATED}
          </p>
        </header>

        <div className="space-y-9 px-6 py-8 text-sm leading-7 text-neutral-700 sm:px-10 sm:py-10 sm:text-base">
          <section>
            <h2 className="text-lg font-black text-neutral-900">
              1. Υπεύθυνος επεξεργασίας
            </h2>
            <p className="mt-3">
              Υπεύθυνος για την επεξεργασία των προσωπικών δεδομένων που
              συλλέγονται μέσω της υπηρεσίας online κρατήσεων είναι το{' '}
              <strong>Salut</strong>.
            </p>
            <address className="mt-3 not-italic">
              Ακτή Καραϊσκάκη 49, Σαλαμίνα 189 00
              <br />
              Τηλέφωνο:{' '}
              <a
                href="tel:+302104654063"
                className="font-bold text-[var(--brand)] underline underline-offset-4"
              >
                +30 210 465 4063
              </a>
            </address>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              2. Δεδομένα που συλλέγουμε
            </h2>
            <p className="mt-3">
              Για την καταχώριση και διαχείριση του ραντεβού συλλέγουμε το
              ονοματεπώνυμο, τον αριθμό κινητού τηλεφώνου, προαιρετικά τη
              διεύθυνση email, καθώς και τα στοιχεία της κράτησης: επιλεγμένη
              υπηρεσία, barber, ημερομηνία και ώρα.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              3. Σκοπός και νομική βάση
            </h2>
            <p className="mt-3">
              Τα δεδομένα χρησιμοποιούνται αποκλειστικά για τη δημιουργία,
              επιβεβαίωση, υπενθύμιση, αλλαγή ή ακύρωση του ραντεβού και για την
              επικοινωνία που είναι αναγκαία για την εξυπηρέτησή του. Η νομική
              βάση είναι η λήψη μέτρων κατόπιν αιτήματος του πελάτη και η
              εκτέλεση της σχετικής υπηρεσίας κράτησης.
            </p>
            <p className="mt-3">
              Τα στοιχεία κράτησης δεν χρησιμοποιούνται για διαφημιστικά email
              ή SMS χωρίς ξεχωριστή νόμιμη βάση και, όπου απαιτείται,
              προηγούμενη συγκατάθεση.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              4. Αποδέκτες και τεχνικοί πάροχοι
            </h2>
            <p className="mt-3">
              Πρόσβαση έχουν μόνο εξουσιοδοτημένα πρόσωπα του Salut και οι
              τεχνικοί πάροχοι που είναι απαραίτητοι για τη φιλοξενία της
              εφαρμογής, τη βάση δεδομένων και την αποστολή email, όπως οι
              Vercel, Supabase και Resend. Οι πάροχοι ενεργούν στο πλαίσιο των
              υπηρεσιών τους και των εφαρμοζόμενων συμβατικών εγγυήσεων
              προστασίας δεδομένων.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              5. Χρόνος διατήρησης
            </h2>
            <p className="mt-3">
              Τα προσωπικά δεδομένα των ραντεβού διατηρούνται για έως{' '}
              <strong>12 μήνες</strong> από την ημερομηνία του ραντεβού και στη
              συνέχεια διαγράφονται ή ανωνυμοποιούνται, εκτός αν απαιτείται
              μεγαλύτερη διατήρηση για την εκπλήρωση νόμιμης υποχρέωσης ή την
              υποστήριξη νομικής αξίωσης.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              6. Δικαιώματα
            </h2>
            <p className="mt-3">
              Μπορείτε να ζητήσετε ενημέρωση, πρόσβαση, διόρθωση, διαγραφή ή
              περιορισμό της επεξεργασίας των δεδομένων σας και, όπου
              εφαρμόζεται, να ασκήσετε δικαίωμα εναντίωσης ή φορητότητας.
              Μπορείτε να υποβάλετε αίτημα τηλεφωνικά ή ταχυδρομικά στα στοιχεία
              επικοινωνίας της ενότητας 1.
            </p>
            <p className="mt-3">
              Έχετε επίσης δικαίωμα υποβολής καταγγελίας στην{' '}
              <a
                href="https://www.dpa.gr/"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[var(--brand)] underline underline-offset-4"
              >
                Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              7. Ασφάλεια και cookies
            </h2>
            <p className="mt-3">
              Εφαρμόζονται κατάλληλα τεχνικά και οργανωτικά μέτρα για την
              προστασία των δεδομένων από μη εξουσιοδοτημένη πρόσβαση, απώλεια
              ή αλλοίωση. Η δημόσια φόρμα κράτησης δεν χρησιμοποιεί
              διαφημιστικά cookies. Τυχόν απολύτως απαραίτητα τεχνικά στοιχεία
              χρησιμοποιούνται μόνο για την ασφάλεια και λειτουργία της
              υπηρεσίας.
            </p>
          </section>
        </div>

        <footer className="border-t border-neutral-200 bg-neutral-50 px-6 py-6 text-center sm:px-10">
          <Link
            href={bookingUrl}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
          >
            Επιστροφή στην κράτηση
          </Link>
        </footer>
      </article>
    </main>
  )
}

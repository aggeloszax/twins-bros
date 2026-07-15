import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import { SHOP_QUERY_PARAM, resolveShop } from '@/lib/shops'

export const dynamic = 'force-dynamic'

const LAST_UPDATED = '15 Ιουλίου 2026'

export default async function BookingTermsPage({
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

  const shopParams = new URLSearchParams({ [SHOP_QUERY_PARAM]: shop.slug })
  const bookingUrl = `/?${shopParams.toString()}`
  const privacyUrl = `/privacy?${shopParams.toString()}`

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
                Όροι Κράτησης
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
              1. Στοιχεία καταστήματος
            </h2>
            <p className="mt-3">
              Οι online κρατήσεις αφορούν υπηρεσίες που παρέχονται από το{' '}
              <strong>Salut</strong>, Ακτή Καραϊσκάκη 49, Σαλαμίνα 189 00.
            </p>
            <p className="mt-2">
              Τηλέφωνο επικοινωνίας:{' '}
              <a
                href="tel:+302104654063"
                className="font-bold text-[var(--brand)] underline underline-offset-4"
              >
                +30 210 465 4063
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              2. Καταχώριση και επιβεβαίωση
            </h2>
            <p className="mt-3">
              Ο πελάτης επιλέγει υπηρεσία, barber, διαθέσιμη ημερομηνία και ώρα
              και καταχωρίζει τα απαραίτητα στοιχεία επικοινωνίας. Το ραντεβού
              θεωρείται επιβεβαιωμένο όταν εμφανιστεί η επιτυχής ολοκλήρωση της
              κράτησης στην οθόνη. Αν έχει δηλωθεί email, αποστέλλεται και
              σχετικό μήνυμα επιβεβαίωσης.
            </p>
            <p className="mt-3">
              Ο πελάτης είναι υπεύθυνος για την ακρίβεια του τηλεφώνου και του
              email που καταχωρίζει.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              3. Υπηρεσίες, διάρκεια και τιμές
            </h2>
            <p className="mt-3">
              Πριν την επιβεβαίωση εμφανίζονται η επιλεγμένη υπηρεσία, η
              ενδεικτική διάρκειά της και η τελική τιμή. Η πληρωμή
              πραγματοποιείται στο κατάστημα. Αλλαγή υπηρεσίας κατά την άφιξη
              είναι δυνατή μόνο εφόσον υπάρχει ο απαιτούμενος διαθέσιμος χρόνος.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              4. Ακύρωση και αλλαγή ραντεβού
            </h2>
            <p className="mt-3">
              Η online ακύρωση είναι διαθέσιμη χωρίς χρέωση έως και{' '}
              <strong>2,5 ώρες πριν</strong> από την προγραμματισμένη ώρα. Για
              εκπρόθεσμη ακύρωση ή αίτημα αλλαγής, ο πελάτης πρέπει να
              επικοινωνήσει τηλεφωνικά με το κατάστημα. Η αλλαγή εξαρτάται από
              τη διαθεσιμότητα.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              5. Καθυστέρηση
            </h2>
            <p className="mt-3">
              Παρέχεται περιθώριο καθυστέρησης έως <strong>10 λεπτά</strong>.
              Σε μεγαλύτερη καθυστέρηση, το Salut μπορεί να προσαρμόσει τη
              διάρκεια ή να ακυρώσει το ραντεβού, εφόσον διαφορετικά
              επηρεάζονται τα επόμενα προγραμματισμένα ραντεβού. Συνιστάται η
              έγκαιρη τηλεφωνική ενημέρωση.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">6. No-show</h2>
            <p className="mt-3">
              Αν ο πελάτης δεν προσέλθει και δεν έχει ακυρώσει ή ενημερώσει το
              κατάστημα, το περιστατικό καταγράφεται ως no-show. Μετά από{' '}
              <strong>δύο no-shows</strong>, το Salut μπορεί να ζητήσει
              τηλεφωνική επιβεβαίωση πριν αποδεχτεί επόμενη online κράτηση. Δεν
              επιβάλλεται χρηματική χρέωση no-show μέσω της παρούσας υπηρεσίας.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              7. Αλλαγή ή ακύρωση από το κατάστημα
            </h2>
            <p className="mt-3">
              Αν το Salut δεν μπορεί να εξυπηρετήσει ένα επιβεβαιωμένο
              ραντεβού, θα προσπαθήσει να ενημερώσει τον πελάτη το συντομότερο
              δυνατό και να προτείνει νέα διαθέσιμη ώρα, χωρίς χρέωση.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              8. Κρατήσεις για παιδιά
            </h2>
            <p className="mt-3">
              Η κράτηση παιδικής υπηρεσίας πρέπει να πραγματοποιείται από
              γονέα ή κηδεμόνα, ο οποίος παρέχει τα δικά του στοιχεία
              επικοινωνίας και συνοδεύει το παιδί όπου απαιτείται.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              9. Προσωπικά δεδομένα και αλλαγές όρων
            </h2>
            <p className="mt-3">
              Η επεξεργασία των στοιχείων κράτησης περιγράφεται στην{' '}
              <Link
                href={privacyUrl}
                className="font-bold text-[var(--brand)] underline underline-offset-4"
              >
                Πολιτική Απορρήτου
              </Link>
              . Οι παρόντες όροι μπορεί να ενημερώνονται για μελλοντικές
              κρατήσεις. Σε κάθε κράτηση εφαρμόζεται η έκδοση που ήταν
              διαθέσιμη κατά την καταχώρισή της.
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

import Image from 'next/image'
import Link from 'next/link'
import { SHOP, SITE_THEME } from '@/lib/shop'

const LAST_UPDATED = '13 Οκτωβρίου 2026'

export default function BookingTermsPage() {
  return (
    <main
      className="min-h-screen bg-[var(--page-bg)] px-4 py-8 text-neutral-900 sm:px-6 sm:py-12"
      style={SITE_THEME}
    >
        <nav aria-label="Επιστροφή" className="sticky top-0 z-10 mx-auto mb-4 max-w-3xl bg-[var(--page-bg)] py-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
          >
            Επιστροφή στην κράτηση
          </Link>
        </nav>
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-[var(--page-border)] bg-white shadow-sm">
        <header className="border-b border-[var(--page-border)] px-6 py-7 sm:px-10 sm:py-9">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-full border border-[var(--page-border)] bg-white">
              <Image
                src={SHOP.logoUrl}
                alt={`${SHOP.name} logo`}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)]">
                {SHOP.name}
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
              <strong>{SHOP.name}</strong>, {SHOP.address}.
            </p>
            <p className="mt-2">
              Τηλέφωνο επικοινωνίας:{' '}
              <a
                href={SHOP.phone.href}
                className="font-bold text-[var(--brand)] underline underline-offset-4"
              >
                {SHOP.phone.label}
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
              Σε μεγαλύτερη καθυστέρηση, το {SHOP.name} μπορεί να προσαρμόσει τη
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
              <strong>δύο no-shows</strong>, το {SHOP.name} μπορεί να ζητήσει
              τηλεφωνική επιβεβαίωση πριν αποδεχτεί επόμενη online κράτηση. Δεν
              επιβάλλεται χρηματική χρέωση no-show μέσω της παρούσας υπηρεσίας.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900">
              7. Αλλαγή ή ακύρωση από το κατάστημα
            </h2>
            <p className="mt-3">
              Αν το {SHOP.name} δεν μπορεί να εξυπηρετήσει ένα επιβεβαιωμένο
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
                href="/privacy"
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


      </article>
    </main>
  )
}

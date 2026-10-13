import BookingForm from '@/app/_components/booking-form'
import { bookingMetadata } from '@/lib/booking-metadata'

export const metadata = bookingMetadata

// The home page IS the booking system: no landing page, the visitor lands
// directly on Step 1 (Service → Barber → Date/Time → Details) of the form.
export default function HomePage() {
  return <BookingForm />
}

import BookingForm from '@/app/_components/booking-form'

// The home page IS the booking system: no landing page, the visitor lands
// directly on Step 1 (Service → Barber → Date/Time → Details) of the form.
export default function HomePage() {
  return <BookingForm />
}

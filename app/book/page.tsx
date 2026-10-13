import BookingForm from '@/app/_components/booking-form'
import { bookingMetadata } from '@/lib/booking-metadata'

export const metadata = bookingMetadata

export default function BookPage() {
  return <BookingForm />
}

import { getGoogleConfig } from '@/lib/google-auth'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

const GOOGLE_ERRORS: Record<string, string> = {
  google_denied: 'Αυτός ο λογαριασμός Google δεν έχει πρόσβαση στη διαχείριση.',
  google_failed: 'Η σύνδεση με Google δεν ολοκληρώθηκε. Δοκίμασε ξανά.',
  rate_limited: 'Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγα λεπτά.',
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <LoginForm
      googleEnabled={getGoogleConfig() !== null}
      googleError={(error && GOOGLE_ERRORS[error]) || null}
    />
  )
}

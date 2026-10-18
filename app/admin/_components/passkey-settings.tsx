'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { browserSupportsWebAuthn, startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { passkeyRequest, passkeyError, setUnlockToken } from '../_lib/passkey-client'
import { adminFetch } from '../_lib/admin-data'
import { Button, Card, CardHeader, Field, FormError, TextInput } from './ui'

export function PasskeySettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [supported, setSupported] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    queueMicrotask(() => setSupported(browserSupportsWebAuthn()))
    void adminFetch<{ enabled: boolean }>('/api/admin/passkeys').then(r => setEnabled(r.enabled)).catch(e => setError(passkeyError(e)))
  }, [])

  async function register(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(null); setNotice('')
    try {
      const optionsJSON = await passkeyRequest<PublicKeyCredentialCreationOptionsJSON>('register-options', { password })
      const response = await startRegistration({ optionsJSON })
      const result = await passkeyRequest<{ token: string }>('register-verify', { response })
      setEnabled(true)
      setNotice('Ενεργοποιήθηκε. Το admin κλειδώνει κάθε φορά που το ανοίγεις ή επιστρέφεις σε αυτό.')
      setUnlockToken(result.token)
    } catch (err) { setError(passkeyError(err)) }
    finally { setBusy(false); setPassword('') }
  }

  async function disable() {
    setBusy(true); setError(null); setNotice('')
    try {
      await passkeyRequest('disable', { password })
      setEnabled(false)
      setNotice('Το αυτόματο κλείδωμα απενεργοποιήθηκε για τη διαχείριση.')
    } catch (err) { setError(passkeyError(err)) }
    finally { setBusy(false); setPassword('') }
  }

  return <Card className="self-start">
    <CardHeader title="Face ID / passkey" description="Κλείδωμα της διαχείρισης σε κάθε άνοιγμα και επιστροφή από άλλη εφαρμογή ή καρτέλα." />
    <form onSubmit={event => void register(event)} className="space-y-4 p-5">
      <p className="text-sm text-[var(--admin-muted)]">{enabled === null ? 'Έλεγχος…' : enabled ? 'Το κλείδωμα είναι ενεργό. Μπορείς να προσθέσεις passkey και σε αυτή τη συσκευή.' : 'Ενεργοποίησε το κλείδωμα με το Face ID ή το δακτυλικό αποτύπωμα της συσκευής σου.'} Ισχύει για τη διαχείριση σε όλες τις συσκευές. Ο κωδικός διαχείρισης παραμένει διαθέσιμος για ξεκλείδωμα.</p>
      {!supported && <p className="text-sm text-[var(--admin-muted)]">Για δημιουργία passkey, άνοιξε τη σελίδα σε συμβατό browser μέσω HTTPS.</p>}
      <Field label="Κωδικός διαχείρισης" hint="Απαιτείται για ενεργοποίηση, προσθήκη passkey ή απενεργοποίηση.">
        <TextInput type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={128} required />
      </Field>
      <FormError message={error} />
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={busy || !supported || enabled === null || !password}>{busy ? 'Επαλήθευση…' : enabled ? 'Προσθήκη passkey' : 'Ενεργοποίηση Face ID / passkey'}</Button>
        {enabled && <Button type="button" disabled={busy || !password} onClick={() => void disable()}>Απενεργοποίηση κλειδώματος</Button>}
      </div>
    </form>
  </Card>
}

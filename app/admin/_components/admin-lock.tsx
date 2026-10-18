'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { ADMIN_THEME } from '@/lib/shop'
import { getUnlockToken, lockAdmin, LOCK_EVENT, UNLOCK_EVENT, passkeyRequest, passkeyError, setUnlockToken } from '../_lib/passkey-client'
import { logout } from '../login/actions'
import { Button, FormError, LockIcon, TextInput } from './ui'

export function AdminLock({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'locked' | 'open'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const enabled = useRef(true)
  const generation = useRef(0)

  const check = useCallback(async () => {
    const current = ++generation.current
    try {
      const response = await fetch('/api/admin/passkeys', { cache: 'no-store' })
      if (response.status === 401) { router.replace('/admin/login'); return }
      if (!response.ok) throw new Error('Δεν ήταν δυνατός ο έλεγχος σύνδεσης. Δοκίμασε ξανά.')
      const data = await response.json() as { enabled: boolean }
      if (current !== generation.current) return
      enabled.current = data.enabled
      setState(data.enabled && !getUnlockToken() ? 'locked' : 'open')
      setError(null)
    } catch (err) {
      if (current !== generation.current) return
      setState('locked')
      setError(passkeyError(err))
    }
  }, [router])

  useEffect(() => {
    // A fresh admin layout must never inherit a grant from an earlier visit.
    lockAdmin()
    queueMicrotask(() => void check())
    const requests = generation
    const onLock = () => {
      requests.current++
      setPassword('')
      setState('locked')
    }
    const onUnlock = () => {
      enabled.current = true
      if (document.visibilityState === 'hidden') { lockAdmin(); return }
      setError(null)
      setPassword('')
      setState('open')
    }
    const hide = () => {
      if (enabled.current) flushSync(() => lockAdmin())
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden') hide()
      else void check()
    }
    const pageshow = () => { void check() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', pageshow)
    window.addEventListener(LOCK_EVENT, onLock)
    window.addEventListener(UNLOCK_EVENT, onUnlock)
    return () => {
      requests.current++
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', pageshow)
      window.removeEventListener(LOCK_EVENT, onLock)
      window.removeEventListener(UNLOCK_EVENT, onUnlock)
      lockAdmin()
    }
  }, [check])

  async function unlock(event?: FormEvent) {
    event?.preventDefault()
    setError(null)
    setBusy(true)
    try {
      let result: { token: string }
      if (usePassword) {
        result = await passkeyRequest('password', { password })
      } else {
        const optionsJSON = await passkeyRequest<PublicKeyCredentialRequestOptionsJSON>('authenticate-options')
        const response = await startAuthentication({ optionsJSON })
        result = await passkeyRequest('authenticate-verify', { response })
      }
      setUnlockToken(result.token)
    } catch (err) { setError(passkeyError(err)) }
    finally { setBusy(false); setPassword('') }
  }

  if (state === 'open') return children
  return (
    <main className="admin-ui flex min-h-screen items-center justify-center bg-[var(--admin-bg)] px-5 text-[var(--admin-text)]" style={ADMIN_THEME}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--admin-border)] bg-white p-6 text-center shadow-sm">
        <LockIcon className="mx-auto mb-3 h-8 w-8 text-[var(--admin-accent)]" />
        <h1 className="text-xl font-semibold">{state === 'loading' ? 'Έλεγχος σύνδεσης…' : 'Η διαχείριση είναι κλειδωμένη'}</h1>
        {state !== 'loading' && <>
          <p className="mb-5 mt-2 text-sm text-[var(--admin-muted)]">Ξεκλείδωσε με Face ID, δακτυλικό αποτύπωμα ή τον κωδικό της συσκευής σου.</p>
          <form onSubmit={(event) => void unlock(event)} className="space-y-3">
            {usePassword && <label className="block text-left text-sm">Κωδικός διαχείρισης<TextInput className="mt-1" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} maxLength={128} /></label>}
            <FormError message={error} />
            <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center">{busy ? 'Επαλήθευση…' : usePassword ? 'Ξεκλείδωμα με κωδικό' : 'Ξεκλείδωμα με Face ID / passkey'}</Button>
          </form>
          <button type="button" disabled={busy} className="mt-4 text-sm underline" onClick={() => { setUsePassword(v => !v); setError(null) }}>{usePassword ? 'Χρήση passkey' : 'Χρήση κωδικού διαχείρισης'}</button>
          <form action={logout} className="mt-4"><button type="submit" className="text-sm text-[var(--admin-muted)]">Αποσύνδεση</button></form>
        </>}
      </div>
    </main>
  )
}

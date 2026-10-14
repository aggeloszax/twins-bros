'use client'

import { type FormEvent, useState } from 'react'
import { SHOP } from '@/lib/shop'
import { adminFetch, errorMessage } from '../_lib/admin-data'
import { Button, Card, CardHeader, Field, FormError, LockIcon, PageHeader, TextInput } from './ui'

const MIN_PASSWORD_LENGTH = 15

export function SettingsPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Ο κωδικός πρέπει να έχει τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες.`)
    }
    if (password !== confirm) return setError('Οι δύο κωδικοί δεν ταιριάζουν.')

    setSubmitting(true)
    setError(null)
    try {
      await adminFetch('/api/admin/password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setPassword('')
      setConfirm('')
      setSaved(true)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  const details = [
    ['Επωνυμία', SHOP.name],
    ['Διεύθυνση', SHOP.address],
    ['Τηλέφωνο', SHOP.phone.label],
    ['Email ειδοποιήσεων', SHOP.notificationEmail],
  ]

  return (
    <>
      <PageHeader title="Ρυθμίσεις" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="self-start">
          <CardHeader
            title="Στοιχεία καταστήματος"
            description="Εμφανίζονται στη σελίδα κράτησης, στα email και στους όρους."
          />
          <dl className="divide-y divide-[var(--admin-border)]">
            {details.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <dt className="text-[var(--admin-muted)]">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="self-start">
          <CardHeader
            title="Κωδικός διαχείρισης"
            description={`Τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες. Μετά την αλλαγή, οι άλλες συσκευές αποσυνδέονται.`}
          />
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 p-5">
            <Field label="Νέος κωδικός">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                maxLength={128}
              />
            </Field>
            <Field label="Επανάληψη κωδικού">
              <TextInput
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                maxLength={128}
              />
            </Field>
            <FormError message={error} />
            {saved && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                Ο νέος κωδικός αποθηκεύτηκε.
              </p>
            )}
            <Button type="submit" variant="primary" disabled={submitting}>
              <LockIcon className="h-4 w-4" />
              {submitting ? 'Αποθήκευση...' : 'Αλλαγή κωδικού'}
            </Button>
          </form>
        </Card>
      </div>
    </>
  )
}

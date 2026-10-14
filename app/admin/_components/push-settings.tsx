'use client'

import { useEffect, useState } from 'react'
import { type Barber, adminFetch, errorMessage, formatDateShort } from '../_lib/admin-data'
import { Button, Card, CardHeader, Field, FormError, SelectInput } from './ui'

type Device = {
  id: string
  endpoint: string
  label: string | null
  barberId: string | null
  createdAt: string
}

type Support = 'checking' | 'supported' | 'ios-browser' | 'unsupported'

const SW_SCOPE = '/admin'

// The browser wants the VAPID public key as bytes.
function keyToBytes(base64Url: string) {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function deviceLabel() {
  const ua = navigator.userAgent
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Συσκευή'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  return browser ? `${device} · ${browser}` : device
}

function detectSupport(): Support {
  const ios = /iPhone|iPad/.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'supported'
  }
  return ios && !standalone ? 'ios-browser' : 'unsupported'
}

export function PushSettings() {
  const [support, setSupport] = useState<Support>('checking')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [barberId, setBarberId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const thisDevice = devices.find((device) => device.endpoint === endpoint) ?? null

  useEffect(() => {
    const detected = detectSupport()
    queueMicrotask(() => setSupport(detected))

    void (async () => {
      try {
        const [data, barberList] = await Promise.all([
          adminFetch<{ publicKey: string; devices: Device[] }>('/api/admin/push'),
          adminFetch<Barber[]>('/api/barbers'),
        ])
        setPublicKey(data.publicKey)
        setDevices(data.devices)
        setBarbers(barberList)

        if (detected !== 'supported') return
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: SW_SCOPE })
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          setEndpoint(subscription.endpoint)
          const known = data.devices.find((device) => device.endpoint === subscription.endpoint)
          setBarberId(known?.barberId ?? '')
        }
      } catch (loadError) {
        setError(errorMessage(loadError))
      }
    })()
  }, [])

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await task()
    } catch (taskError) {
      setError(errorMessage(taskError))
    } finally {
      setBusy(false)
    }
  }

  async function saveDevice(subscription: PushSubscription, followBarberId: string) {
    const saved = await adminFetch<Device>('/api/admin/push', {
      method: 'POST',
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        barberId: followBarberId || null,
        label: deviceLabel(),
      }),
    })
    setEndpoint(saved.endpoint)
    setDevices((current) => [...current.filter((device) => device.id !== saved.id), saved])
  }

  function enable() {
    void run(async () => {
      if (!publicKey) throw new Error('Δεν φορτώθηκαν οι ρυθμίσεις. Ανανέωσε τη σελίδα.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error(
          'Οι ειδοποιήσεις είναι απενεργοποιημένες για αυτή την εφαρμογή. Ενεργοποίησέ τες από τις ρυθμίσεις του κινητού και ξαναδοκίμασε.',
        )
      }
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: SW_SCOPE })
      await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyToBytes(publicKey),
        }))
      await saveDevice(subscription, barberId)
      setMessage('Οι ειδοποιήσεις ενεργοποιήθηκαν σε αυτή τη συσκευή.')
    })
  }

  function changeBarber(value: string) {
    setBarberId(value)
    if (!thisDevice) return
    void run(async () => {
      const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE)
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) await saveDevice(subscription, value)
      setMessage('Αποθηκεύτηκε.')
    })
  }

  function sendTest() {
    if (!endpoint) return
    void run(async () => {
      await adminFetch('/api/admin/push/test', { method: 'POST', body: JSON.stringify({ endpoint }) })
      setMessage('Στάλθηκε. Θα εμφανιστεί σε λίγα δευτερόλεπτα.')
    })
  }

  function removeDevice(device: Device) {
    void run(async () => {
      await adminFetch(`/api/admin/push?id=${device.id}`, { method: 'DELETE' })
      if (device.endpoint === endpoint) {
        const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE)
        await (await registration?.pushManager.getSubscription())?.unsubscribe()
        setEndpoint(null)
      }
      setDevices((current) => current.filter((item) => item.id !== device.id))
    })
  }

  const barberName = (id: string | null) =>
    id ? (barbers.find((barber) => barber.id === id)?.name ?? 'Κουρέας') : 'Όλοι οι κουρείς'

  return (
    <Card className="self-start">
      <CardHeader
        title="Ειδοποιήσεις στο κινητό"
        description="Ειδοποίηση για κάθε νέα κράτηση, αλλαγή ώρας ή ακύρωση από πελάτη."
      />
      <div className="space-y-4 p-5">
        {support === 'ios-browser' && (
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3.5 py-3 text-sm leading-6">
            <p className="font-medium">Στο iPhone χρειάζεται πρώτα εγκατάσταση:</p>
            <ol className="mt-1 list-decimal pl-5 text-[var(--admin-muted)]">
              <li>Πάτα το κουμπί Κοινοποίηση του Safari (τετράγωνο με βελάκι).</li>
              <li>Διάλεξε «Προσθήκη στην οθόνη Αφετηρίας».</li>
              <li>Άνοιξε την εφαρμογή από την αρχική οθόνη και έλα ξανά εδώ.</li>
            </ol>
          </div>
        )}
        {support === 'unsupported' && (
          <p className="text-sm text-[var(--admin-muted)]">
            Αυτός ο browser δεν υποστηρίζει ειδοποιήσεις. Δοκίμασε Chrome ή Safari (iOS 16.4+).
          </p>
        )}

        {support === 'supported' && (
          <>
            <Field
              label="Ειδοποιήσεις για"
              hint="Ο κάθε κουρέας μπορεί να βλέπει μόνο τα δικά του ραντεβού στο κινητό του."
            >
              <SelectInput value={barberId} onChange={(event) => changeBarber(event.target.value)} disabled={busy}>
                <option value="">Όλους τους κουρείς</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    Μόνο {barber.name}
                  </option>
                ))}
              </SelectInput>
            </Field>

            {thisDevice ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Ενεργές σε αυτή τη συσκευή
                </span>
                <Button size="sm" disabled={busy} onClick={sendTest}>
                  Δοκιμαστική ειδοποίηση
                </Button>
              </div>
            ) : (
              <Button variant="primary" disabled={busy || !publicKey} onClick={enable}>
                {busy ? 'Ενεργοποίηση…' : 'Ενεργοποίηση σε αυτή τη συσκευή'}
              </Button>
            )}
          </>
        )}

        {message && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            {message}
          </p>
        )}
        <FormError message={error} />

        {devices.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-[var(--admin-muted)]">Συσκευές με ειδοποιήσεις</p>
            <ul className="divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)]">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {device.label ?? 'Συσκευή'}
                      {device.endpoint === endpoint ? ' (αυτή)' : ''}
                    </p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {barberName(device.barberId)} · από {formatDateShort(device.createdAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => removeDevice(device)}>
                    Αφαίρεση
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}

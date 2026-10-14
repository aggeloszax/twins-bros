'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { type Service, adminFetch, errorMessage, formatPrice } from '../_lib/admin-data'
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorNotice,
  Field,
  FormError,
  IconButton,
  Modal,
  PageHeader,
  PencilIcon,
  PlusIcon,
  Skeleton,
  TextInput,
} from './ui'

type Editing = { service: Service | null }

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setServices(await adminFetch<Service[]>('/api/services'))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  async function handleDelete(service: Service) {
    setDeletingId(service.id)
    setError(null)
    try {
      await adminFetch(`/api/services?id=${encodeURIComponent(service.id)}`, { method: 'DELETE' })
      setServices((current) => current.filter((item) => item.id !== service.id))
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Υπηρεσίες"
        description="Ο τιμοκατάλογος που βλέπουν οι πελάτες στην κράτηση."
        actions={
          <Button variant="primary" onClick={() => setEditing({ service: null })}>
            <PlusIcon className="h-4 w-4" />
            Νέα υπηρεσία
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNotice message={error} />
        </div>
      )}

      <Card>
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Δεν υπάρχουν υπηρεσίες ακόμα." />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {services.map((service) => (
              <li key={service.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{service.name}</p>
                  <p className="text-[13px] text-[var(--admin-muted)]">{service.duration} λεπτά</p>
                </div>
                <p className="text-base font-semibold tabular-nums">{formatPrice(service.price)}</p>
                <div className="flex items-center gap-1">
                  <IconButton label={`Επεξεργασία ${service.name}`} onClick={() => setEditing({ service })}>
                    <PencilIcon className="h-4 w-4" />
                  </IconButton>
                  <ConfirmButton
                    label="Διαγραφή"
                    confirmLabel="Σίγουρα;"
                    busy={deletingId === service.id}
                    onConfirm={() => void handleDelete(service)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-[var(--admin-muted)]">
        Μια υπηρεσία με ραντεβού δεν διαγράφεται, για να μείνει σωστό το ιστορικό. Οι αλλαγές σε
        διάρκεια και τιμή ισχύουν για τις νέες κρατήσεις.
      </p>

      {editing && (
        <ServiceModal
          service={editing.service}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setServices((current) =>
              (editing.service
                ? current.map((item) => (item.id === saved.id ? saved : item))
                : [...current, saved]
              ).sort((a, b) => a.price - b.price),
            )
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function ServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null
  onClose: () => void
  onSaved: (service: Service) => void
}) {
  const [name, setName] = useState(service?.name ?? '')
  const [duration, setDuration] = useState(String(service?.duration ?? 30))
  const [price, setPrice] = useState(String(service?.price ?? 15))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const saved = await adminFetch<Service>('/api/services', {
        method: service ? 'PATCH' : 'POST',
        body: JSON.stringify({
          id: service?.id,
          name: name.trim(),
          duration: Number(duration),
          price: Number(price.replace(',', '.')),
        }),
      })
      onSaved(saved)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={service ? 'Επεξεργασία υπηρεσίας' : 'Νέα υπηρεσία'}
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel={service ? 'Αποθήκευση' : 'Προσθήκη'}
      submitting={submitting}
    >
      <Field label="Όνομα">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="π.χ. Κούρεμα & γένια" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Διάρκεια (λεπτά)">
          <TextInput type="number" min={5} step={5} value={duration} onChange={(event) => setDuration(event.target.value)} />
        </Field>
        <Field label="Τιμή (€)">
          <TextInput inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
      </div>
      <FormError message={error} />
    </Modal>
  )
}

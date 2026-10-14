'use client'

import { useState } from 'react'
import { errorMessage } from '../_lib/admin-data'
import { Button, FormError, TextArea } from './ui'

// A short text shown read-only, edited in place, e.g. customer notes.
export function EditableNote({
  label,
  value,
  emptyText,
  placeholder,
  maxLength,
  onSave,
}: {
  label: string
  value: string | null
  emptyText: string
  placeholder?: string
  maxLength: number
  onSave: (value: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEditing() {
    setDraft(value ?? '')
    setError(null)
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft.trim() || null)
      setEditing(false)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--admin-muted)]">{label}</p>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="text-[13px] font-medium text-[var(--admin-accent)] hover:underline"
          >
            {value ? 'Αλλαγή' : 'Προσθήκη'}
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <TextArea
            autoFocus
            rows={3}
            maxLength={maxLength}
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            className="!mt-0"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
              Άκυρο
            </Button>
            <Button size="sm" variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </Button>
          </div>
          <div className="mt-2">
            <FormError message={error} />
          </div>
        </div>
      ) : value ? (
        <p className="whitespace-pre-line rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3.5 py-2.5 text-sm">
          {value}
        </p>
      ) : (
        <p className="text-sm text-[var(--admin-muted)]">{emptyText}</p>
      )}
    </div>
  )
}

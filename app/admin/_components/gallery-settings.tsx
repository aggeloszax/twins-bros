'use client'

import Image from 'next/image'
import { type ChangeEvent, useEffect, useState } from 'react'
import { adminFetch, errorMessage } from '../_lib/admin-data'
import { MAX_UPLOAD_BYTES, resizeImage } from '../_lib/resize-image'
import { Card, CardHeader, ChevronLeftIcon, ChevronRightIcon, FormError, IconButton, TrashIcon } from './ui'

type Photo = { id: string; url: string; caption: string | null }

const MAX_PHOTOS = 12

export function GallerySettings() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminFetch<Photo[]>('/api/gallery')
      .then(setPhotos)
      .catch((loadError) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false))
  }, [])

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const file of files.slice(0, MAX_PHOTOS - photos.length)) {
        if (!file.type.startsWith('image/') || file.size > MAX_UPLOAD_BYTES) {
          setError('Κάποιο αρχείο δεν είναι εικόνα ή είναι μεγαλύτερο από 8MB.')
          continue
        }
        const image = await resizeImage(file, 1400)
        const saved = await adminFetch<Photo>('/api/gallery', {
          method: 'POST',
          body: JSON.stringify({ image }),
        })
        setPhotos((current) => [...current, saved])
      }
    } catch (uploadError) {
      setError(errorMessage(uploadError))
    } finally {
      setBusy(false)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...photos]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setPhotos(next)
    try {
      await adminFetch('/api/gallery', {
        method: 'PATCH',
        body: JSON.stringify({ order: next.map((photo) => photo.id) }),
      })
    } catch (moveError) {
      setError(errorMessage(moveError))
    }
  }

  async function remove(photo: Photo) {
    setBusy(true)
    setError(null)
    try {
      await adminFetch(`/api/gallery?id=${encodeURIComponent(photo.id)}`, { method: 'DELETE' })
      setPhotos((current) => current.filter((item) => item.id !== photo.id))
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="self-start">
      <CardHeader
        title="Φωτογραφίες μαγαζιού"
        description={`Εμφανίζονται στη σελίδα κράτησης, με αυτή τη σειρά. Έως ${MAX_PHOTOS}.`}
      />
      <div className="space-y-4 p-5">
        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">Φόρτωση…</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-[#ece2d4]">
                <Image src={photo.url} alt="" fill unoptimized sizes="150px" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-1">
                  <div className="flex">
                    <IconButton label="Πιο νωρίς" onClick={() => void move(index, -1)} className="!h-7 !w-7 !text-white hover:!bg-white/20">
                      <ChevronLeftIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Πιο μετά" onClick={() => void move(index, 1)} className="!h-7 !w-7 !text-white hover:!bg-white/20">
                      <ChevronRightIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <IconButton label="Διαγραφή φωτογραφίας" onClick={() => void remove(photo)} className="!h-7 !w-7 !text-white hover:!bg-white/20">
                    <TrashIcon className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--admin-border)] text-center text-xs font-medium text-[var(--admin-muted)] transition-colors hover:border-[var(--admin-accent)] hover:text-[var(--admin-accent)]">
                <span className="text-2xl leading-none">+</span>
                {busy ? 'Ανέβασμα…' : 'Προσθήκη'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={busy}
                  className="sr-only"
                  onChange={(event) => void handleFiles(event)}
                />
              </label>
            )}
          </div>
        )}
        <FormError message={error} />
      </div>
    </Card>
  )
}

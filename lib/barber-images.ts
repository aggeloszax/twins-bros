// Barber photos are uploaded as base64 data URLs (resized in the admin UI),
// stored as bytes in the database and served from /api/barbers/{id}/image.

const MAX_IMAGE_BYTES = 1_000_000
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i

export type BarberImageInput =
  | { kind: 'none' }
  | { kind: 'path'; path: string }
  | { kind: 'upload'; bytes: Uint8Array<ArrayBuffer>; type: string }
  | { kind: 'invalid' }

export function parseBarberImage(image: unknown): BarberImageInput {
  if (typeof image !== 'string' || !image.trim()) return { kind: 'none' }

  const value = image.trim()
  if (value.startsWith('/barbers/')) return { kind: 'path', path: value }

  const match = DATA_URL_PATTERN.exec(value)
  if (!match) return { kind: 'invalid' }

  const bytes = new Uint8Array(Buffer.from(match[2], 'base64'))
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return { kind: 'invalid' }
  }

  const type = match[1].toLowerCase().replace('image/jpg', 'image/jpeg')
  return { kind: 'upload', bytes, type }
}

// The version query changes on every upload, so browsers and the CDN can cache
// each URL forever.
export function barberImageUrl(barberId: string) {
  return `/api/barbers/${barberId}/image?v=${Date.now()}`
}

export const PUBLIC_BARBER_SELECT = { id: true, name: true, image: true, bio: true } as const

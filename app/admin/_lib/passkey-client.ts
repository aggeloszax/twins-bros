// Memory only: never persist an unlocked state across reloads or new tabs.
let unlockToken: string | null = null
export const LOCK_EVENT = 'admin:lock'
export const UNLOCK_EVENT = 'admin:unlock'
export function getUnlockToken() { return unlockToken }
export function setUnlockToken(token: string) {
  unlockToken = token
  window.dispatchEvent(new Event(UNLOCK_EVENT))
}
export function lockAdmin() {
  const previous = unlockToken
  unlockToken = null
  if (previous) void fetch('/api/admin/passkeys', {
    method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json', 'x-admin-unlock': previous },
    body: JSON.stringify({ action: 'lock' }),
  }).catch(() => {})
  window.dispatchEvent(new Event(LOCK_EVENT))
}

export async function passkeyRequest<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('/api/admin/passkeys', {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(unlockToken ? { 'x-admin-unlock': unlockToken } : {}) },
    body: JSON.stringify({ ...body, action }),
  })
  const data = await response.json()
  if (response.status === 401) window.location.assign('/admin/login')
  if (!response.ok) throw new Error(data.error || 'Δεν ολοκληρώθηκε η επαλήθευση.')
  return data as T
}

export function passkeyError(error: unknown) {
  if (error && typeof error === 'object' && 'name' in error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
    return 'Το ξεκλείδωμα ακυρώθηκε ή έληξε. Δοκίμασε ξανά ή χρησιμοποίησε τον κωδικό.'
  }
  return error instanceof Error ? error.message : 'Δεν ολοκληρώθηκε η επαλήθευση.'
}

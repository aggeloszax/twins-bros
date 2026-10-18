// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ router: { replace: vi.fn() }, authenticate: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }))
vi.mock('@/app/admin/login/actions', () => ({ logout: vi.fn() }))
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: mocks.authenticate }))
import { AdminLock } from '@/app/admin/_components/admin-lock'
import { getUnlockToken, lockAdmin, setUnlockToken } from '@/app/admin/_lib/passkey-client'

let root: Root
let container: HTMLDivElement
let enabled: boolean
let visibility: DocumentVisibilityState
let requestMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  enabled = true
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  requestMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const action = init?.body ? JSON.parse(String(init.body)).action : 'status'
    const result = action === 'status' ? { enabled } : action === 'authenticate-options' ? { challenge: 'example' } : action === 'authenticate-verify' ? { token: 'b'.repeat(64) } : { ok: true }
    return new Response(JSON.stringify(result), { status: 200 })
  })
  vi.stubGlobal('fetch', requestMock)
  mocks.authenticate.mockReset()
  mocks.authenticate.mockResolvedValue({ id: 'assertion' })
  lockAdmin()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
async function mount() {
  await act(async () => root.render(<AdminLock><div data-private>PRIVATE APPOINTMENTS</div></AdminLock>))
}
async function submit() {
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
}
async function switchVisibility(value: DocumentVisibilityState) {
  await act(async () => {
    visibility = value
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

it('does not mount private content until server verification succeeds', async () => {
  await mount()
  expect(container.querySelector('[data-private]')).toBeNull()
  expect(container.textContent).toContain('Η διαχείριση είναι κλειδωμένη')
  await submit()
  expect(mocks.authenticate).toHaveBeenCalledOnce()
  expect(getUnlockToken()).toBe('b'.repeat(64))
  expect(container.querySelector('[data-private]')).not.toBeNull()
})

it('requires a fresh unlock on a new admin visit even with an old in-memory grant', async () => {
  setUnlockToken('a'.repeat(64))
  await mount()
  expect(getUnlockToken()).toBeNull()
  expect(container.querySelector('[data-private]')).toBeNull()
})

it('clears the grant, removes private content, and stays locked on return', async () => {
  await mount()
  await submit()
  await switchVisibility('hidden')
  expect(getUnlockToken()).toBeNull()
  expect(container.querySelector('[data-private]')).toBeNull()
  expect(requestMock.mock.calls.some(([, init]) => init?.keepalive && String(init.body).includes('lock'))).toBe(true)
  await switchVisibility('visible')
  expect(container.querySelector('[data-private]')).toBeNull()
  await submit()
  expect(container.querySelector('[data-private]')).not.toBeNull()
})

it('locks pagehide and back-forward cache restoration', async () => {
  await mount()
  await submit()
  await act(async () => window.dispatchEvent(new Event('pagehide')))
  await act(async () => window.dispatchEvent(new Event('pageshow')))
  expect(getUnlockToken()).toBeNull()
  expect(container.querySelector('[data-private]')).toBeNull()
})

it('does not loop if the native Face ID dialog changes visibility', async () => {
  await mount()
  mocks.authenticate.mockImplementationOnce(async () => {
    visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'))
    visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange'))
    return { id: 'assertion' }
  })
  await submit()
  expect(container.querySelector('[data-private]')).not.toBeNull()
  expect(mocks.authenticate).toHaveBeenCalledOnce()
})

it('keeps cancellation locked and offers retry', async () => {
  await mount()
  mocks.authenticate.mockRejectedValueOnce(new DOMException('Cancelled', 'NotAllowedError'))
  await submit()
  expect(container.querySelector('[data-private]')).toBeNull()
  expect(container.textContent).toContain('Το ξεκλείδωμα ακυρώθηκε')
  expect(getUnlockToken()).toBeNull()
  await submit()
  expect(container.querySelector('[data-private]')).not.toBeNull()
})

it('does not expose content if verification finishes while the tab is hidden', async () => {
  await mount()
  await switchVisibility('hidden')
  await act(async () => setUnlockToken('b'.repeat(64)))
  expect(getUnlockToken()).toBeNull()
  expect(container.querySelector('[data-private]')).toBeNull()
})

it('retains existing access before enrollment and fails closed on network error', async () => {
  enabled = false
  await mount()
  expect(container.querySelector('[data-private]')).not.toBeNull()
  requestMock.mockRejectedValueOnce(new Error('offline'))
  await act(async () => window.dispatchEvent(new Event('pageshow')))
  expect(container.querySelector('[data-private]')).toBeNull()
})

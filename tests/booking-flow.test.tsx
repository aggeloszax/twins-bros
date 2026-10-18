// @vitest-environment jsdom
import { act, type ImgHTMLAttributes, type AnchorHTMLAttributes } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({ default: ({ fill, priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
  void fill; void priority
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} />
} }))
vi.mock('next/link', () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }))
import BookingForm from '@/app/_components/booking-form'

let root: Root
let container: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>
let simulateConflict: boolean
beforeEach(() => {
  simulateConflict = false
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      if (simulateConflict) return new Response(JSON.stringify({ error: 'This time slot is no longer available' }), { status: 409 })
      throw new Error('This test must never create a booking')
    }
    const data = url === '/api/services' ? [
      { id: 'cut', name: 'Δοκιμαστικό κούρεμα', price: 17.5, duration: 35, description: 'Περιγραφή', category: null },
      { id: 'beard', name: 'Δοκιμαστικό μούσι', price: 9, duration: 15, description: null, category: null },
    ] : url === '/api/barbers' ? [
      { id: 'one', name: 'Πρώτος', image: null, bio: null, schedule: null },
      { id: 'two', name: 'Δεύτερος', image: null, bio: null, schedule: null },
    ] : url === '/api/schedule-exceptions' ? { exceptions: [], timeOff: [] }
      : url.startsWith('/api/available-slots') ? [{ time: '12:00', available: true }] : []
    return new Response(JSON.stringify(data))
  })
  vi.stubGlobal('fetch', fetchMock)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!
  expect(button).toBeDefined()
  await act(async () => button.click())
}
async function chooseTime() {
  const day = container.querySelector<HTMLButtonElement>('button[aria-label][aria-pressed]:not(:disabled)')!
  expect(day).not.toBeNull()
  await act(async () => day.click())
  await click('12:00')
}
async function fill(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('keeps customer details when revisiting and changing choices', async () => {
  await act(async () => root.render(<BookingForm />))
  expect(container.querySelector('iframe')?.src).toContain('maps.google.com/maps')
  expect(container.querySelector('details')).toBeNull()
  await click('Δοκιμαστικό κούρεμα')
  expect(container.querySelector('[aria-label="Επιλεγμένη υπηρεσία"]')?.textContent).toContain('35′ · 17.50€')
  expect(container.querySelector('details')?.open).toBe(false)
  await click('Οποιοσδήποτε κουρέας')
  await chooseTime()
  expect(container.querySelector('[aria-labelledby="appointment-summary"]')).toBeNull()
  expect(container.textContent).not.toContain('Δωρεάν online ακύρωση')
  await fill('input[type="text"]', 'Δοκιμή Πελάτη')
  await fill('input[type="tel"]', '6912345678')
  await fill('input[type="email"]', 'test@example.com')
  const details = container.querySelector('details')!
  await act(async () => { details.open = true })
  await click('Υπηρεσία')
  await click('Δοκιμαστικό μούσι')
  await click('Πρώτος')
  await chooseTime()
  expect(container.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('Δοκιμή Πελάτη')
  expect(container.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe('test@example.com')
  expect(container.querySelector('details')?.open).toBe(false)
  expect(fetchMock.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  expect(container.querySelector<HTMLAnchorElement>('a[href^="tel:"]')?.href).toBe('tel:+302112180304')
})

it('refreshes availability after a conflict and preserves the customer fields', async () => {
  simulateConflict = true
  await act(async () => root.render(<BookingForm />))
  await click('Δοκιμαστικό κούρεμα')
  await click('Πρώτος')
  await chooseTime()
  await fill('input[type="text"]', 'Δοκιμή Πελάτη')
  await fill('input[type="tel"]', '6912345678')
  await fill('input[type="email"]', 'test@example.com')
  const previousRequests = fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/available-slots')).length
  await click('Επιβεβαίωση Ραντεβού')
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('μόλις δεσμεύτηκε')
  expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Ημέρα & ώρα')
  expect(fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/available-slots')).length).toBeGreaterThan(previousRequests)
  await click('12:00')
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(container.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('Δοκιμή Πελάτη')
  expect(container.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe('test@example.com')
})

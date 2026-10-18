import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
const booking = {
  id: 'test-booking', cancelToken: 'test/token+123',
  startTime: '2026-10-20T09:00:00Z',
  customerName: 'Test <customer>', customerPhone: '6912345678',
  customerEmail: 'test@example.com',
  barber: { name: 'Test barber' }, service: { name: 'Test haircut', duration: 30 },
}
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('RESEND_API_KEY', 'test-key-not-real')
  vi.stubEnv('RESEND_FROM_EMAIL', 'bookings@example.com')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://booking.example.com')
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'test-message' }, error: null })
  for (const method of ['log', 'info', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

it('builds the customer confirmation with encoded management links and configured sender', async () => {
  const { sendBookingNotifications } = await import('@/lib/notifications')
  expect(await sendBookingNotifications(booking)).toEqual({ customerEmail: 'sent' })
  expect(mocks.send).toHaveBeenCalledOnce()
  const message = mocks.send.mock.calls[0][0]
  expect(message.to).toBe('test@example.com')
  expect(message.from).toBe('Twins Bros <bookings@example.com>')
  expect(message.html).toContain('https://booking.example.com/cancel/test-booking?token=test%2Ftoken%2B123')
  expect(message.html).toContain('Test &lt;customer&gt;')
  expect(message.html.indexOf('Αλλαγή ή ακύρωση ραντεβού')).toBeGreaterThan(message.html.indexOf('</dl>'))
  expect(message.html.indexOf('Αλλαγή ή ακύρωση ραντεβού')).toBeLessThan(message.html.indexOf('Προσθήκη στο ημερολόγιο'))
  expect(message.subject).toContain('2026')
  expect(message.subject).toContain('12:00')
})

it('reports provider rejection without treating it as a successful email', async () => {
  mocks.send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'Rejected' } })
  const { sendBookingNotifications } = await import('@/lib/notifications')
  expect(await sendBookingNotifications(booking)).toEqual({ customerEmail: 'failed' })
})

it('reports missing configuration without contacting the email provider', async () => {
  vi.stubEnv('RESEND_API_KEY', '')
  const { sendBookingNotifications } = await import('@/lib/notifications')
  expect(await sendBookingNotifications(booking)).toEqual({ customerEmail: 'failed' })
  expect(mocks.send).not.toHaveBeenCalled()
})

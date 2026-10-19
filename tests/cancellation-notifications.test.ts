import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn(),
  email: vi.fn(), push: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  booking: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, count: vi.fn().mockResolvedValue(0) },
  customer: { findUnique: vi.fn().mockResolvedValue(null) },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({ booking: { findUniqueOrThrow: mocks.findUniqueOrThrow, update: mocks.update } }),
} }))
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/availability', () => ({ BARBER_SCHEDULE_SELECT: {}, computeBarberSlots: vi.fn(), loadScheduleRules: vi.fn(), toScheduleSource: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ sendBookingCancelledEmail: mocks.email, sendBookingRescheduledEmail: vi.fn() }))
vi.mock('@/lib/push', () => ({ notifyBookingCancelled: mocks.push, notifyBookingMoved: vi.fn() }))
import { cancelBooking } from '@/app/cancel/[id]/actions'
import { PATCH } from '@/app/api/admin/bookings/[id]/route'

const booking = {
  id: 'test', cancelToken: 'token', status: 'PENDING', customerName: 'Test', customerEmail: 'test@example.com',
  customerPhone: '6912345678', barberId: 'barber', serviceId: 'service',
  startTime: new Date('2099-10-20T09:00:00Z'), endTime: new Date('2099-10-20T09:30:00Z'),
  barber: { id: 'barber', name: 'Barber' }, service: { name: 'Haircut' },
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.findUnique.mockResolvedValue(booking)
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.findUniqueOrThrow.mockResolvedValue({ status: 'PENDING' })
  mocks.update.mockResolvedValue({ ...booking, status: 'CANCELLED' })
  mocks.email.mockResolvedValue('sent')
  mocks.push.mockResolvedValue(undefined)
})

it('sends customer cancellation email only after a successful cancellation', async () => {
  expect(await cancelBooking('test', 'token')).toEqual({ ok: true })
  expect(mocks.email).toHaveBeenCalledExactlyOnceWith(booking)
  mocks.email.mockClear()
  mocks.updateMany.mockResolvedValue({ count: 0 })
  expect(await cancelBooking('test', 'token')).toEqual({ ok: false, reason: 'already-cancelled' })
  expect(mocks.email).not.toHaveBeenCalled()
})

it('does not send for invalid tokens or report failed cancellation when email delivery fails', async () => {
  expect(await cancelBooking('test', 'invalid')).toEqual({ ok: false, reason: 'not-found' })
  expect(mocks.email).not.toHaveBeenCalled()
  mocks.email.mockResolvedValue('failed')
  expect(await cancelBooking('test', 'token')).toEqual({ ok: true })
})

it('emails admin cancellations but does not resend for an already cancelled booking', async () => {
  const request = () => new Request('https://example.com/api/admin/bookings/test', { method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }) })
  const response = await PATCH(request(), { params: Promise.resolve({ id: 'test' }) })
  expect(response.status).toBe(200)
  expect((await response.json()).customerNotification).toBe('sent')
  expect(mocks.email).toHaveBeenCalledOnce()
  mocks.email.mockClear()
  mocks.findUniqueOrThrow.mockResolvedValue({ status: 'CANCELLED' })
  const repeated = await PATCH(request(), { params: Promise.resolve({ id: 'test' }) })
  expect(repeated.status).toBe(200)
  expect(mocks.email).not.toHaveBeenCalled()
})

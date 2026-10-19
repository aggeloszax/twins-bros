// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

vi.mock('@/app/cancel/[id]/actions', () => ({ cancelBooking: vi.fn(), rescheduleBooking: vi.fn() }))
import { CancelClient } from '@/app/cancel/[id]/cancel-client'
import { rescheduleBooking } from '@/app/cancel/[id]/actions'

it('navigates months and clears the selected time when changing day without submitting', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ time: '12:00', available: true }]))))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const click = async (label: string) => {
    const button = [...container.querySelectorAll('button')].find((item) => item.getAttribute('aria-label') === label || item.textContent === label)!
    expect(button).toBeDefined()
    await act(async () => button.click())
  }
  try {
    await act(async () => root.render(<CancelClient id="test" token="test" brandColor="#800020" barberId="barber" serviceId="cut" bookableDays={['2026-10-30', '2026-11-02']} currentDateKey="2026-10-30" currentTime="10:00" details={{ service: 'Κούρεμα', barber: 'Κουρέας', date: '30 Οκτωβρίου', time: '10:00', customerName: 'Δοκιμή' }} />))
    await click('Αλλαγή ώρας')
    expect(container.querySelector('[aria-label="Προηγούμενος μήνας"]')?.hasAttribute('disabled')).toBe(true)
    await click('12:00')
    expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toBe('30')
    await click('Επόμενος μήνας')
    expect(container.textContent).toContain('Νοέμβριος')
    expect(container.querySelector('[aria-label="Επόμενος μήνας"]')?.hasAttribute('disabled')).toBe(true)
    const day = [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find((button) => button.textContent === '2')!
    expect(day.disabled).toBe(false)
    await act(async () => day.click())
    expect([...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Διαλέξτε ώρα')?.disabled).toBe(true)
    expect(rescheduleBooking).not.toHaveBeenCalled()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

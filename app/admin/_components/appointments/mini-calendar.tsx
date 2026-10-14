'use client'

import { buildMonthGrid, monthTitle, todayKey } from '../../_lib/admin-data'
import { ChevronLeftIcon, ChevronRightIcon, IconButton } from '../ui'

const WEEKDAYS = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ']

export function MiniCalendar({
  monthKey,
  selectedKey,
  bookingCounts,
  onSelect,
  onMonthChange,
}: {
  monthKey: string
  selectedKey: string
  bookingCounts: Map<string, number>
  onSelect: (dateKey: string) => void
  onMonthChange: (direction: -1 | 1) => void
}) {
  const days = buildMonthGrid(monthKey)
  const month = monthKey.slice(0, 7)
  const today = todayKey()

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[var(--admin-text)]">
          {monthTitle(monthKey)}
        </h2>
        <div className="flex items-center">
          <IconButton label="Προηγούμενος μήνας" onClick={() => onMonthChange(-1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </IconButton>
          <IconButton label="Επόμενος μήνας" onClick={() => onMonthChange(1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <div key={day} className="pb-1 text-[11px] font-medium text-[var(--admin-muted)]">
            {day}
          </div>
        ))}
        {days.map((dateKey) => {
          const inMonth = dateKey.startsWith(month)
          const selected = dateKey === selectedKey
          const isToday = dateKey === today
          const count = bookingCounts.get(dateKey) ?? 0

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelect(dateKey)}
              aria-pressed={selected}
              aria-label={`${dateKey}${count ? `, ${count} ραντεβού` : ''}`}
              className={`relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-[13px] transition-colors ${
                selected
                  ? 'bg-[var(--admin-accent)] font-semibold text-white'
                  : isToday
                    ? 'font-semibold text-[var(--admin-accent)] ring-1 ring-inset ring-[var(--admin-accent)]'
                    : inMonth
                      ? 'text-[var(--admin-text)] hover:bg-[#efe7dc]'
                      : 'text-[#c4b8a8] hover:bg-[#efe7dc]'
              }`}
            >
              {Number(dateKey.slice(8))}
              {count > 0 && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    selected ? 'bg-white' : 'bg-[var(--admin-accent)]'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

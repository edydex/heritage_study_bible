import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import CalendarGrid from '../../community-server/packages/calendar-ui/CalendarGrid.jsx'
import CalendarBrowser from '../../community-server/packages/calendar-ui/CalendarBrowser.jsx'
import { calendarWeeks, eventDateRange, eventIncludesDate, localToInstant } from '../../community-server/packages/calendar-core/index.js'

const zone = 'America/Los_Angeles'
const event = { id: 1, instanceId: 'retreat', title: 'Prayer Retreat', startsAt: localToInstant('2026-09-24T10:00', zone), endsAt: localToInstant('2026-09-26T18:00', zone), timeZone: zone }
it('shows one three-day bar and keeps every occupied date selectable', () => {
  const select = vi.fn()
  render(<CalendarGrid month="2026-09" onMonthChange={vi.fn()} events={[event]} timeZone={zone} onEventSelect={select} />)
  const bar = screen.getByRole('button', { name: 'Prayer Retreat' })
  expect(bar.style.gridColumn).toBe('5 / 8')
  expect(screen.getByRole('button', { name: '2026-09-25, view events, 1 events' })).toBeInTheDocument()
  fireEvent.click(bar)
  expect(select).toHaveBeenCalledWith(event)
})
it('splits only at week boundaries and allocates overlaps to different lanes', () => {
  const crossing = { ...event, startsAt: localToInstant('2026-09-25T10:00', zone), endsAt: localToInstant('2026-09-29T18:00', zone) }
  const weeks = calendarWeeks('2026-09', [crossing, { ...event, instanceId: 'second', title: 'Choir' }], zone)
  const spans = weeks.flatMap(week => week.entries).filter(entry => entry.event.instanceId === 'retreat')
  expect(spans.map(({ start, end, continuesBefore, continuesAfter }) => ({ start, end, continuesBefore, continuesAfter }))).toEqual([
    { start: 5, end: 6, continuesBefore: false, continuesAfter: true },
    { start: 0, end: 2, continuesBefore: true, continuesAfter: false },
  ])
  const overlap = weeks.find(week => week.entries.length === 2)
  expect(new Set(overlap.entries.map(entry => entry.lane)).size).toBe(2)
})
it('uses church dates and excludes midnight endpoints, including DST changes', () => {
  const fallBack = { startsAt: localToInstant('2026-10-31T10:00', zone), endsAt: localToInstant('2026-11-02T00:00', zone) }
  expect(eventDateRange(fallBack, zone)).toEqual({ start: '2026-10-31', end: '2026-11-01' })
  expect(eventIncludesDate(fallBack, '2026-11-02', zone)).toBe(false)
  expect(eventDateRange({ startsAt: 'invalid' }, zone)).toBeNull()
})
it('opens the same event details from the middle day of a multi-day event', async () => {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10)).toISOString().slice(0, 10)
  const retreat = { ...event, startsAt: `${date}T10:00:00Z`, endsAt: `${date.slice(0, 8)}12T18:00:00Z`, timeZone: 'UTC' }
  render(<CalendarBrowser load={vi.fn().mockResolvedValue({ events: [retreat], timeZone: 'UTC', authenticated: false })} />)
  await screen.findByRole('button', { name: 'Prayer Retreat' })
  fireEvent.click(screen.getByRole('button', { name: `${date.slice(0, 8)}11, view events, 1 events` }))
  expect(screen.getByRole('heading', { name: 'Prayer Retreat' })).toBeInTheDocument()
  expect(screen.queryByText('No events on this date.')).not.toBeInTheDocument()
})

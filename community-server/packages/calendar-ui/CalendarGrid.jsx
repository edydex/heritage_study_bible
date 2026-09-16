'use client'
import { useState } from 'react'
import { localDate, calendarWeeks, eventIncludesDate, shiftMonth } from '../calendar-core/index.js'
import './calendar.css'

export default function CalendarGrid({ month, onMonthChange, events = [], timeZone = 'UTC', onDateSelect, onEventSelect, selectedDate, busy = false, defaultRecurring = false, create = false, onFilterChange, showEmpty = true }) {
  const [showEvents, setShowEvents] = useState(true)
  const [showRecurring, setShowRecurring] = useState(defaultRecurring)
  const visible = events.filter(event => event.recurring ? showRecurring : showEvents)
  const weeks = calendarWeeks(month, visible, timeZone)
  const heading = new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return <section className="church-calendar" aria-label="Church calendar" aria-busy={busy}>
    <div className="church-calendar__toolbar">
      <button type="button" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}>‹</button>
      <h3 aria-live="polite">{heading}</h3>
      <button type="button" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))}>›</button>
      <button type="button" onClick={() => onMonthChange(localDate(Date.now(), timeZone).slice(0, 7))}>Today</button>
    </div>
    <div className="church-calendar__filters">
      <label><input type="checkbox" checked={showEvents} onChange={event => { setShowEvents(event.target.checked); onFilterChange?.({ events: event.target.checked, recurring: showRecurring }) }} /> Events</label>
      <label><input type="checkbox" checked={showRecurring} onChange={event => { setShowRecurring(event.target.checked); onFilterChange?.({ events: showEvents, recurring: event.target.checked }) }} /> Recurring</label>
      <small>{timeZone.replaceAll('_', ' ')}{busy ? ' · Loading…' : ''}</small>
    </div>
    <div className="church-calendar__weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="church-calendar__grid">
      {weeks.map(week => <div key={week.dates[0]} className="church-calendar__week" style={{ gridTemplateRows: `2.75rem repeat(${Math.max(1, week.lanes)}, minmax(1.8rem, auto)) minmax(.4rem, 1fr)` }}>
        {week.dates.map((date, column) => {
        const matches = visible.filter(event => eventIncludesDate(event, date, timeZone))
        return <div key={date} className="church-calendar__day" style={{ gridColumn: column + 1, gridRow: '1 / -1' }} data-outside={date.slice(0, 7) !== month || undefined} data-selected={selectedDate === date || undefined}>
          <button type="button" className="church-calendar__date" aria-label={`${date}${create ? ', create event' : ', view events'}${matches.length ? `, ${matches.length} events` : ''}`} onClick={() => onDateSelect?.(date)}>{Number(date.slice(8))}</button>
        </div>
        })}
        {week.entries.map(({ event, start, end, lane, continuesBefore, continuesAfter }) => <button key={event.instanceId} type="button" className="church-calendar__event" style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: lane + 2 }} data-continues-before={continuesBefore || undefined} data-continues-after={continuesAfter || undefined} title={event.title} onClick={() => onEventSelect?.(event)}>{continuesBefore && <span aria-hidden="true">‹ </span>}{event.title}{continuesAfter && <span aria-hidden="true"> ›</span>}</button>)}
      </div>)}
    </div>
    {!busy && showEmpty && !visible.length && <p className="church-calendar__empty">No events match these filters this month.</p>}
  </section>
}

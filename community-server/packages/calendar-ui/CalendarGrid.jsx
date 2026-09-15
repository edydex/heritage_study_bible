'use client'
import { useState } from 'react'
import { localDate, monthDays, shiftMonth } from '../calendar-core/index.js'
import './calendar.css'

export default function CalendarGrid({ month, onMonthChange, events = [], timeZone = 'UTC', onDateSelect, onEventSelect, selectedDate, busy = false, defaultRecurring = false, create = false, onFilterChange, showEmpty = true }) {
  const [showEvents, setShowEvents] = useState(true)
  const [showRecurring, setShowRecurring] = useState(defaultRecurring)
  const visible = events.filter(event => event.recurring ? showRecurring : showEvents)
  const days = monthDays(month)
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
      {days.map(date => {
        const matches = visible.filter(event => date >= localDate(event.startsAt, timeZone) && date <= localDate(event.endsAt && event.endsAt > event.startsAt ? Date.parse(event.endsAt) - 1 : event.startsAt, timeZone))
        return <div key={date} className="church-calendar__day" data-outside={date.slice(0, 7) !== month || undefined} data-selected={selectedDate === date || undefined}>
          <button type="button" className="church-calendar__date" aria-label={`${date}${create ? ', create event' : ', view events'}${matches.length ? `, ${matches.length} events` : ''}`} onClick={() => onDateSelect?.(date)}>{Number(date.slice(8))}</button>
          {matches.slice(0, 3).map(event => <button key={event.instanceId} type="button" className="church-calendar__event" title={event.title} onClick={() => onEventSelect?.(event)}>{event.title}</button>)}
          {matches.length > 3 && <button type="button" className="church-calendar__more" onClick={() => onDateSelect?.(date)}>+{matches.length - 3} more</button>}
        </div>
      })}
    </div>
    {!busy && showEmpty && !visible.length && <p className="church-calendar__empty">No events match these filters this month.</p>}
  </section>
}

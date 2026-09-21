'use client'
import { useEffect, useState } from 'react'
import { canonicalTimeZone, formatEventTime, safeEventUrl } from '../calendar-core/index.js'
import './calendar.css'

async function defaultLoad(path) {
  const response = await fetch(`/api/${path}`, { cache: 'no-store', credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not load this event.')
  return result
}
export default function EventDetails({ eventId, date, load = defaultLoad, backHref = '/calendar', renderActions }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setResult(null); setError('')
    const query = date ? `?date=${encodeURIComponent(date)}` : ''
    load(`community/calendar/events/${encodeURIComponent(eventId)}${query}`)
      .then(value => { if (active) setResult(value) })
      .catch(reason => { if (active) setError(reason.message || 'Could not load this event.') })
    return () => { active = false }
  }, [eventId, date, load])
  const event = result?.event
  return <section className="church-event" aria-label="Event details">
    <a className="church-event__back" href={backHref}>← Back to calendar</a>
    {!event && !error && <p role="status">Loading event…</p>}
    {error && <div role="alert"><h1>Event unavailable</h1><p>{error}</p><p>Church members can open Heritage Community to check their sign-in.</p></div>}
    {event && <article>
      <p className="church-event__eyebrow">{event.recurring ? 'Recurring church event' : 'Church event'}</p>
      <h1>{event.title}</h1>
      <dl>
        <div><dt>Starts</dt><dd>{formatEventTime(event.startsAt, event.timeZone)}</dd></div>
        {event.endsAt && <div><dt>Ends</dt><dd>{formatEventTime(event.endsAt, event.timeZone)}</dd></div>}
        <div><dt>Time zone</dt><dd>{(canonicalTimeZone(event.timeZone) || 'UTC').replaceAll('_', ' ')}</dd></div>
        {event.location && <div><dt>Location</dt><dd>{event.location}</dd></div>}
      </dl>
      {event.description && <p className="church-event__description">{event.description}</p>}
      {safeEventUrl(event.url) && <a className="church-event__website" href={safeEventUrl(event.url)} target="_blank" rel="noopener noreferrer">Registration or event website ↗</a>}
      {renderActions?.(event)}
    </article>}
  </section>
}

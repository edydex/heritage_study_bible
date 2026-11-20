'use client'

import EventDetails from '../../packages/calendar-ui/EventDetails.jsx'
import EventRegistrationForm from './EventRegistrationForm'

type PublicEvent = { id: string | number; date?: string; recurring?: boolean; cancelled?: boolean }

// The shared EventDetails stays free of website-only features; the website adds
// "Add to my calendar" and the sign-up form through its actions slot.
export default function PublicEventPage({ eventId, date }: { eventId: string; date?: string }) {
  return <EventDetails eventId={eventId} date={date}
    renderActions={(event: PublicEvent) => event.cancelled ? null : <>
      <a className="church-event__add" href={`/api/community/calendar/events/${encodeURIComponent(String(event.id))}/event.ics${event.date ? `?date=${encodeURIComponent(event.date)}` : ''}`}>
        Add to my calendar
      </a>
      {event.recurring && <a className="church-event__add" href="/calendar#subscribe">Subscribe to every date</a>}
      {!event.recurring && <EventRegistrationForm eventId={event.id} />}
    </>} />
}

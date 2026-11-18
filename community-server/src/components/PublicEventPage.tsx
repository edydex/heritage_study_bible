'use client'

import EventDetails from '../../packages/calendar-ui/EventDetails.jsx'
import EventRegistrationForm from './EventRegistrationForm'

// The shared EventDetails stays free of website-only features; the website adds
// the sign-up form through its actions slot.
export default function PublicEventPage({ eventId, date }: { eventId: string; date?: string }) {
  return <EventDetails eventId={eventId} date={date}
    renderActions={(event: { id: string | number; recurring?: boolean }) => event.recurring ? null : <EventRegistrationForm eventId={event.id} />} />
}

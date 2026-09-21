import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { COMMUNITIES_CHANGE_EVENT, communityApiRequest, getCommunities } from '../services/communities'
import EventDetails from '../../community-server/packages/calendar-ui/EventDetails.jsx'
import { eventPagePath } from '../../community-server/packages/calendar-core/index.js'
import CalendarBrowser from '../../community-server/packages/calendar-ui/CalendarBrowser.jsx'

function icsTimestamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function downloadEvent(event, community) {
  const reminder = Math.max(0, Number(event.defaultReminderMinutes ?? 60))
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Heritage Study Bible//Community Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:heritage-${community.manifest.id}-${event.id}-${icsTimestamp(event.startsAt)}@heritage.faith`,
    `DTSTAMP:${icsTimestamp(new Date())}`,
    `DTSTART:${icsTimestamp(event.startsAt)}`,
    `DTEND:${icsTimestamp(event.endsAt || new Date(new Date(event.startsAt).getTime() + 60 * 60_000))}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    `LOCATION:${escapeIcs(event.location)}`,
    'BEGIN:VALARM',
    `TRIGGER:-PT${reminder}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${String(event.title || 'community-event').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function CommunityCalendarPage() {
  const navigate = useNavigate()
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const [communities, setCommunities] = useState(getCommunities)
  const requested = searchParams.get('community')
  const community = useMemo(() => requested ? communities.find(row => row.manifest.id === requested) : communities.find(row => row.primary) || communities[0], [communities, requested])
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [authenticated, setAuthenticated] = useState(null)
  const calendarPath = `/community/calendar?community=${encodeURIComponent(community?.manifest.id || '')}`
  const goHome = () => navigate(eventId ? calendarPath : '/community', { state: authenticated === false && community?.status === 'joined' ? { signInRequired: community.manifest.id } : null })
  useEffect(() => {
    const refresh = () => setCommunities(getCommunities())
    window.addEventListener(COMMUNITIES_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(COMMUNITIES_CHANGE_EVENT, refresh)
  }, [])
  const loadCalendar = useCallback(async path => {
    if (community.status === 'joined') {
      try {
        const result = await communityApiRequest(community, path)
        setAuthenticated(Boolean(result.authenticated))
        return result
      } catch (error) { if (error.status !== 401 && error.status !== 403) throw error }
    }
    setAuthenticated(false)
    const response = await fetch(new URL(path, `${community.manifest.apiBaseUrl}/`), { cache: 'no-store', credentials: 'omit' })
    if (!response.ok) throw new Error(response.status === 404 ? 'This event is unavailable or requires church membership.' : 'Could not load the church calendar. Try again when connected.')
    return response.json()
  }, [community])
  const handleRsvp = async (community, event, response) => {
    setBusy(`rsvp:${event.id}`)
    try {
      const communityId = typeof event.community === 'object' ? event.community.id : event.community
      const existing = await communityApiRequest(
        community,
        `event-rsvps?where[event][equals]=${encodeURIComponent(event.id)}&limit=1&depth=0`,
      )
      const saved = existing.docs?.[0]
      await communityApiRequest(community, saved ? `event-rsvps/${saved.id}` : 'event-rsvps', {
        method: saved ? 'PATCH' : 'POST',
        body: JSON.stringify(saved
          ? { response, guests: saved.guests || 0 }
          : { community: communityId, event: event.id, response, guests: 0 }),
      })
      setMessage(`RSVP saved: ${response.replace('-', ' ')}.`)
    } catch (error) {
      if (error.status === 401) (setAuthenticated(false), setMessage('Sign in again from Community Home to save your RSVP.'))
      else setMessage(error.message || 'Could not save the RSVP.')
    } finally {
      setBusy('')
    }
  }

  return <div className="min-h-screen bg-background dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <header className="bg-primary text-white sticky top-0 z-40 shadow-lg safe-area-top">
      <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
        <button onClick={goHome} className="p-1.5 rounded-lg hover:bg-white/20" aria-label="Back to Community">←</button>
        <div className="min-w-0"><h1 className="heading-text text-lg font-bold">{eventId ? 'Event details' : 'Calendar'}</h1><p className="text-xs truncate">{community?.manifest.name}</p></div>
      </div>
    </header>
    <main className="container mx-auto max-w-5xl px-3 sm:px-6 py-5 pb-20">
      {community ? (eventId ? <EventDetails key={`${community.manifest.id}:${eventId}`} eventId={eventId} date={searchParams.get('date')} backHref={`#${calendarPath}`} load={loadCalendar} renderActions={event => <div className="mt-3 flex flex-wrap gap-2">
        {event.rsvpEnabled && authenticated && !event.recurring && ['going', 'maybe', 'not-going'].map(response => <button key={response} onClick={() => handleRsvp(community, event, response)} disabled={busy === `rsvp:${event.id}`} className="rounded-lg border px-3 py-2 text-sm capitalize">{response.replace('-', ' ')}</button>)}
        <button onClick={() => downloadEvent(event, community)} className="rounded-lg border px-3 py-2 text-sm">Add this date to calendar</button>
      </div>} /> : <CalendarBrowser key={community.manifest.id} load={loadCalendar} eventHref={event => `#/community/calendar${eventPagePath(event)}&community=${encodeURIComponent(community.manifest.id)}`} />) : <p>Save a church in Community Home to open its calendar.</p>}
      {community?.status === 'joined' && authenticated === false && <p className="mt-4 text-sm">To see member events, <button className="underline" onClick={() => navigate('/community', { state: { signInRequired: community.manifest.id } })}>check your church sign-in in Community Home</button>.</p>}
      {message && <p role="status" className="mt-4">{message}</p>}
    </main>
  </div>
}

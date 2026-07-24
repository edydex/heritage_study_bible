import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  COMMUNITIES_CHANGE_EVENT,
  beginCommunityJoin,
  communityApiRequest,
  getCommunities,
  inspectCommunity,
  removeCommunity,
  setPrimaryCommunity,
} from '../services/communities'

function formatEventDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

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
    `UID:heritage-${community.manifest.id}-${event.id}@heritage.faith`,
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

function CommunityHomePage() {
  const navigate = useNavigate()
  const [communities, setCommunities] = useState(() => getCommunities())
  const [joinUrl, setJoinUrl] = useState('')
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState(null)
  const [eventsByCommunity, setEventsByCommunity] = useState({})
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [debugLink, setDebugLink] = useState('')

  useEffect(() => {
    const refresh = () => setCommunities(getCommunities())
    window.addEventListener(COMMUNITIES_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(COMMUNITIES_CHANGE_EVENT, refresh)
  }, [])

  const primary = useMemo(() => communities.find(record => record.primary) || communities[0] || null, [communities])

  const loadEvents = async community => {
    if (community.status !== 'joined') return
    setBusy(`events:${community.manifest.id}`)
    try {
      const query = `events?where[startsAt][greater_than_equal]=${encodeURIComponent(new Date().toISOString())}&sort=startsAt&limit=50&depth=1`
      const result = await communityApiRequest(community, query)
      setEventsByCommunity(value => ({ ...value, [community.manifest.id]: result.docs || [] }))
    } catch (error) {
      setMessage(error.message || 'Could not load community events.')
    } finally {
      setBusy('')
    }
  }

  useEffect(() => {
    if (primary?.status === 'joined' && !eventsByCommunity[primary.manifest.id]) loadEvents(primary)
  }, [primary?.manifest?.id, primary?.status])

  const handleInspect = async event => {
    event.preventDefault()
    setBusy('inspect')
    setMessage('')
    setPreview(null)
    try {
      setPreview(await inspectCommunity(joinUrl))
    } catch (error) {
      setMessage(error.message || 'Could not read that community.')
    } finally {
      setBusy('')
    }
  }

  const handleJoin = async () => {
    setBusy('join')
    setMessage('')
    try {
      const record = await beginCommunityJoin(preview, email)
      setCommunities(getCommunities())
      setMessage(`A secure sign-in link was sent to ${record.email}. Open it on this device to finish joining.${record.contentWarning ? ` ${record.contentWarning}` : ''}`)
      setDebugLink(record.debugLink || '')
      setPreview(null)
      setJoinUrl('')
      setEmail('')
    } catch (error) {
      setMessage(error.message || 'Could not begin community sign-in.')
    } finally {
      setBusy('')
    }
  }

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
      setMessage(error.message || 'Could not save the RSVP.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white sticky top-0 z-40 shadow-lg safe-area-top">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/20" aria-label="Back">←</button>
          <div className="min-w-0 flex-1">
            <h1 className="heading-text text-lg font-bold truncate">Community Home</h1>
            {primary && <p className="text-[11px] text-blue-100 truncate">{primary.manifest.name}</p>}
          </div>
          <button onClick={() => navigate('/settings/content-servers')} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Content</button>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-5 pb-20 space-y-5">
        {primary?.status === 'joined' && (
          <section className="rounded-xl bg-primary text-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-blue-100">Primary community</p>
            <h2 className="mt-1 text-2xl font-bold heading-text">{primary.manifest.name}</h2>
            <p className="mt-2 text-sm text-blue-50">{primary.manifest.description}</p>
            <p className="mt-3 text-xs text-blue-100">Signed in as {primary.member?.displayName || primary.member?.email || 'Member'}</p>
          </section>
        )}

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Upcoming events</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Calendar files include the community's local reminder.</p>
            </div>
            {primary?.status === 'joined' && <button onClick={() => loadEvents(primary)} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200">Refresh</button>}
          </div>
          {!primary || primary.status !== 'joined' ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Join a community to see its shared calendar.</p>
          ) : (eventsByCommunity[primary.manifest.id] || []).length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{busy === `events:${primary.manifest.id}` ? 'Loading events…' : 'No upcoming events.'}</p>
          ) : (
            <div className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
              {eventsByCommunity[primary.manifest.id].map(event => (
                <article key={event.id} className="py-4 first:pt-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{event.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatEventDate(event.startsAt)}{event.location ? ` · ${event.location}` : ''}</p>
                  {event.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{event.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.rsvpEnabled && ['going', 'maybe', 'not-going'].map(response => (
                      <button key={response} onClick={() => handleRsvp(primary, event, response)} disabled={busy === `rsvp:${event.id}`} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs capitalize text-gray-700 dark:text-gray-200 disabled:opacity-50">{response.replace('-', ' ')}</button>
                    ))}
                    <button onClick={() => downloadEvent(event, primary)} className="rounded-lg bg-primary/10 dark:bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-primary dark:text-blue-300">Add to calendar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your communities</h2>
          {communities.length === 0 ? <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">You have not joined a community yet.</p> : (
            <div className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
              {communities.map(community => (
                <div key={community.manifest.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{community.manifest.name} {community.primary && <span className="text-xs text-primary dark:text-blue-300">· Primary</span>}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{community.status === 'joined' ? 'Joined' : 'Waiting for email sign-in'}</p>
                  </div>
                  <div className="flex gap-2">
                    {!community.primary && <button onClick={() => setCommunities(setPrimaryCommunity(community.manifest.id))} className="text-xs text-primary dark:text-blue-300">Make primary</button>}
                    <button onClick={() => setCommunities(removeCommunity(community.manifest.id))} className="text-xs text-red-600 dark:text-red-300">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Join a community</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Checking first shows the community features and public resources. Most Communities require your email to be listed under Member invitations before they send a one-time sign-in link.</p>
          <form noValidate onSubmit={handleInspect} className="mt-4 flex flex-col sm:flex-row gap-2">
            <input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={joinUrl} onChange={event => { setJoinUrl(event.target.value); setPreview(null) }} placeholder="community.example.church" aria-label="Community server address" className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-gray-100" />
            <button disabled={busy === 'inspect' || !joinUrl.trim()} className="rounded-lg bg-primary px-4 py-2.5 text-white font-semibold disabled:opacity-50">{busy === 'inspect' ? 'Checking…' : 'Check Community'}</button>
          </form>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">You can enter only the domain. Heritage adds https:// automatically.</p>
          {preview && (
            <div className="mt-4 rounded-xl border border-primary/30 dark:border-blue-500/40 bg-primary/5 dark:bg-blue-500/10 p-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">{preview.manifest.name}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{preview.manifest.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(preview.manifest.capabilities).filter(([, enabled]) => enabled).map(([capability]) => <span key={capability} className="rounded-full bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300">{capability.replace(/([A-Z])/g, ' $1')}</span>)}
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Also adds {Object.values(preview.contentPreview.counts).reduce((sum, count) => sum + count, 0)} public resources through its Content Server.</p>
              <input type="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="mt-3 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-gray-100" />
              <button onClick={handleJoin} disabled={busy === 'join' || !email.trim()} className="mt-2 w-full rounded-lg bg-gray-950 dark:bg-gray-100 px-4 py-2.5 text-white dark:text-gray-950 font-bold disabled:opacity-50">{busy === 'join' ? 'Sending link…' : `Join ${preview.manifest.name}`}</button>
            </div>
          )}
        </section>

        {message && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
            <p>{message}</p>
            {debugLink && <a href={debugLink} className="mt-2 inline-block font-semibold underline underline-offset-2">Open local development sign-in link</a>}
          </div>
        )}
      </main>
    </div>
  )
}

export default CommunityHomePage

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  COMMUNITIES_CHANGE_EVENT,
  beginCommunityJoin,
  communityApiRequest,
  getCommunities,
  inspectCommunity,
  removeCommunity,
  refreshCommunityDiscovery,
  savePublicCommunity,
  setPrimaryCommunity,
} from '../services/communities'
import CalendarBrowser from '../../community-server/packages/calendar-ui/CalendarBrowser.jsx'
import CommunityResources from './CommunityResources'

const COMMUNITY_FEATURE_LABELS = { events: 'Calendar', rsvps: 'Event RSVPs', personalProgressSync: 'Personal sync', strictPasswordProtection: 'Optional password protection' }

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

function CommunityHomePage() {
  const navigate = useNavigate()
  const [communities, setCommunities] = useState(() => getCommunities())
  const [joinUrl, setJoinUrl] = useState('')
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [debugLink, setDebugLink] = useState('')
  const [signInRequired, setSignInRequired] = useState({})
  const [rejoining, setRejoining] = useState(null)

  useEffect(() => {
    const refresh = () => setCommunities(getCommunities())
    window.addEventListener(COMMUNITIES_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(COMMUNITIES_CHANGE_EVENT, refresh)
  }, [])

  const primary = useMemo(() => communities.find(record => record.primary) || communities[0] || null, [communities])

  useEffect(() => {
    if (primary) refreshCommunityDiscovery(primary.manifest.id).catch(() => {})
  }, [primary?.manifest?.id])

  const handleSavePublic = async () => {
    setBusy('save')
    setMessage('')
    try {
      await savePublicCommunity(preview)
      setCommunities(setPrimaryCommunity(preview.manifest.id))
      setPreview(null)
      setJoinUrl('')
      setMessage('Church saved. Its public resources are ready to browse.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy('') }
  }

  const loadCalendar = useCallback(async path => {
    if (!primary) return { events: [], timeZone: 'UTC' }
    if (primary.status === 'joined') {
      try {
        const result = await communityApiRequest(primary, path)
        setSignInRequired(value => ({ ...value, [primary.manifest.id]: !result.authenticated }))
        return result
      } catch (error) {
        if (error.status !== 401 && error.status !== 403) throw error
        setSignInRequired(value => ({ ...value, [primary.manifest.id]: true }))
      }
    }
    const response = await fetch(new URL(path, `${primary.manifest.apiBaseUrl}/`), { cache: 'no-store', credentials: 'omit' })
    if (!response.ok) throw new Error('Could not load the church calendar. Try again when connected.')
    return response.json()
  }, [primary?.manifest?.id, primary?.manifest?.apiBaseUrl, primary?.status])

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

  const handleJoin = async community => {
    setBusy('join')
    setMessage('')
    try {
      const record = await beginCommunityJoin(community, email)
      setCommunities(getCommunities())
      setMessage(`A secure sign-in link was sent to ${record.email}. Open it on this device to finish joining.${record.contentWarning ? ` ${record.contentWarning}` : ''}`)
      setDebugLink(record.debugLink || '')
      setPreview(null)
      setJoinUrl('')
      setEmail('')
      setRejoining(null)
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
      if (error.status === 401) setSignInRequired(value => ({ ...value, [community.manifest.id]: true }))
      else setMessage(error.message || 'Could not save the RSVP.')
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
        {primary && (
          <section className="rounded-xl bg-primary text-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-blue-100">Primary community</p>
            <h2 className="mt-1 text-2xl font-bold heading-text">{primary.manifest.name}</h2>
            <p className="mt-2 text-sm text-blue-50">{primary.manifest.description}</p>
            {primary.status === 'joined' && !signInRequired[primary.manifest.id] && <p className="mt-3 text-xs text-blue-100">Signed in as {primary.member?.displayName || primary.member?.email || 'Member'}</p>}
            {primary.status === 'joined' && signInRequired[primary.manifest.id] && <p className="mt-3 text-sm text-blue-100">Sign in again below to access member resources. This church sign-in is separate from personal notes and progress.</p>}
          </section>
        )}

        {primary && <CommunityResources key={primary.manifest.id} community={primary} />}

        {primary && <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <CalendarBrowser key={primary.manifest.id} load={loadCalendar} renderActions={event => <div className="mt-3 flex flex-wrap gap-2">
            {event.rsvpEnabled && primary.status === 'joined' && !event.recurring && ['going', 'maybe', 'not-going'].map(response => <button key={response} onClick={() => handleRsvp(primary, event, response)} disabled={busy === `rsvp:${event.id}`} className="rounded-lg border px-3 py-2 text-sm capitalize">{response.replace('-', ' ')}</button>)}
            <button onClick={() => downloadEvent(event, primary)} className="rounded-lg border px-3 py-2 text-sm">Add this date to calendar</button>
          </div>} />
        </section>}

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your communities</h2>
          {communities.length === 0 ? <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Save a church below to find its live service and resources.</p> : (
            <div className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
              {communities.map(community => (
                <div key={community.manifest.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{community.manifest.name} {community.primary && <span className="text-xs text-primary dark:text-blue-300">· Primary</span>}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{signInRequired[community.manifest.id] && community.status === 'joined' ? 'Member sign-in needed' : { joined: 'Joined', 'sync-only': 'Signed in for personal sync', following: 'Public resources saved', 'email-sent': 'Waiting for email sign-in' }[community.status] || 'Saved community'}</p>
                  </div>
                  <div className="flex gap-2">
                    {signInRequired[community.manifest.id] && community.status === 'joined' && <button onClick={() => { setRejoining(community); setEmail(community.member?.email || community.email || ''); setMessage(''); setDebugLink('') }} className="text-xs text-primary dark:text-blue-300">Sign in again</button>}
                    {!community.primary && <button onClick={() => setCommunities(setPrimaryCommunity(community.manifest.id))} className="text-xs text-primary dark:text-blue-300">Make primary</button>}
                    <button onClick={() => setCommunities(removeCommunity(community.manifest.id))} className="text-xs text-red-600 dark:text-red-300">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {rejoining && <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); handleJoin(rejoining) }}>
            <p className="text-sm text-gray-700 dark:text-gray-200">Sign in to {rejoining.manifest.name}</p>
            <input aria-label="Church sign-in email" type="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-gray-100" />
            <button disabled={Boolean(busy) || !email.trim()} className="rounded-lg bg-primary px-4 py-2.5 text-white font-semibold disabled:opacity-50">{busy === 'join' ? 'Sending link…' : 'Send church sign-in link'}</button>
          </form>}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Find a church</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Save a church to browse its public resources without signing in. Join with an invitation to access member resources and private calendar events.</p>
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
                {Object.entries(preview.manifest.capabilities).filter(([key, enabled]) => enabled && COMMUNITY_FEATURE_LABELS[key]).map(([capability]) => <span key={capability} className="rounded-full bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300">{COMMUNITY_FEATURE_LABELS[capability]}</span>)}
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{preview.contentPreview.manifest.publications?.sermons ? 'Includes the church’s published sermon library.' : `${Object.values(preview.contentPreview.counts).reduce((sum, count) => sum + count, 0)} public resources available.`}</p>
              <button onClick={handleSavePublic} disabled={Boolean(busy)} className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 text-white font-semibold disabled:opacity-50">{busy === 'save' ? 'Saving…' : 'Save church and browse public resources'}</button>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Have a member invitation? Enter your email to join.</p>
              <input aria-label="Member email" type="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="mt-3 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-gray-100" />
              <button onClick={() => handleJoin(preview)} disabled={Boolean(busy) || !email.trim()} className="mt-2 w-full rounded-lg bg-gray-950 dark:bg-gray-100 px-4 py-2.5 text-white dark:text-gray-950 font-bold disabled:opacity-50">{busy === 'join' ? 'Sending link…' : `Join ${preview.manifest.name}`}</button>
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

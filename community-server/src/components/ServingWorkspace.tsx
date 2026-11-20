'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SetStepNav } from '@payloadcms/ui'
import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { addDays } from '../../packages/calendar-core/index.js'
import {
  assignmentsFor, candidateNotes, formatServiceDay, formatServiceTime, refId, serviceFill,
  type AssignmentRecord, type AssignmentStatus, type BlockoutRecord, type ServiceOccurrence,
} from '../lib/serving'
import { useWorkspaceText } from './useWorkspaceText'

export type ServingTab = 'schedule' | 'teams' | 'away'
export type ServingPerson = {
  id: number; fullName: string; firstName: string; lastName: string | null; status?: string | null; hasEmail: boolean; phone: string | null
}
type Position = { id: string; name: string; needed: number }
export type ServingTeam = { id: number; name: string; description: string | null; positions: Position[]; members: number[] }
type Team = ServingTeam
type Message = { kind: 'ok' | 'error'; text: string; links?: Array<{ personId: number; name: string }> }

async function request(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method, credentials: 'include', cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value?.error || value?.errors?.[0]?.message || 'Something went wrong. Please try again.')
  return value
}

async function copyText(text: string, prompt: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    window.prompt(prompt, text)
    return false
  }
}

export default function ServingWorkspace(props: {
  canManage: boolean; churchConfigured: boolean; emailEnabled: boolean; today: string; from: string; to: string
  initialTab: ServingTab; initialService: string | null
  services: ServiceOccurrence[]; teams: Team[]; people: ServingPerson[]; assignments: AssignmentRecord[]; blockouts: BlockoutRecord[]
}) {
  const { canManage, churchConfigured, emailEnabled, today, from, to, services, teams, people, assignments, blockouts } = props
  const t = useWorkspaceText()
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [tab, setTab] = useState<ServingTab>(props.initialTab)
  const [selectedKey, setSelectedKey] = useState(props.initialService)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [away, setAway] = useState({ person: '', startDate: '', endDate: '', reason: '' })

  const personById = useMemo(() => new Map(people.map(person => [person.id, person])), [people])
  const teamNames = useMemo(() => new Map(teams.map(team => [team.id, team.name])), [teams])
  const service = services.find(item => item.key === selectedKey) ?? null
  const rows = service ? assignmentsFor(service, assignments) : []
  const working = busy || refreshing

  const choose = (value: ServingTab) => {
    setTab(value)
    setMessage(null)
    const url = new URL(window.location.href)
    if (value === 'schedule') url.searchParams.delete('tab')
    else url.searchParams.set('tab', value)
    window.history.replaceState(null, '', url)
  }

  const pick = (key: string) => {
    setSelectedKey(key)
    setMessage(null)
    const url = new URL(window.location.href)
    url.searchParams.set('service', key)
    window.history.replaceState(null, '', url)
  }

  const run = async (action: () => Promise<Message | null | void>) => {
    setBusy(true)
    try {
      const result = await action()
      if (result !== undefined) setMessage(result)
      startRefresh(() => router.refresh())
    } catch (error) {
      setMessage({ kind: 'error', text: t(error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.') })
    } finally {
      setBusy(false)
    }
  }

  const copyLink = (personId: number, serviceKey?: string) => run(async () => {
    const result = await request('/api/community/serving/link', 'POST', { personId, service: serviceKey })
    const copied = await copyText(result.url, t('Copy this private link:'))
    return copied ? { kind: 'ok', text: t('Link for {name} copied. Paste it into a text message or email to them.', { name: result.name }) } : null
  })

  const resetLink = (person: ServingPerson) => {
    if (!window.confirm(t('Make a new private link for {name}? Links you sent before will stop working.', { name: person.fullName }))) return
    void run(async () => {
      const result = await request('/api/community/serving/reset-link', 'POST', { personId: person.id })
      const copied = await copyText(result.url, t('Copy this private link:'))
      return { kind: 'ok', text: copied ? t('New link for {name} copied. Older links no longer work.', { name: result.name })
        : t('Older links for {name} no longer work.', { name: result.name }) }
    })
  }

  if (!canManage) return <section className="heritage-people heritage-serving">
    <SetStepNav nav={[{ label: t('Serving') }]} />
    <h1>{t('Serving')}</h1>
    <p>{churchConfigured ? t('Church owners, administrators and leaders can schedule serving teams. Ask your church administrator for access.')
      : t('Church settings are unavailable.')}</p>
  </section>

  const statusLabel = (row: AssignmentRecord): [string, string] => row.status === 'accepted' ? ['accepted', t('Accepted')]
    : row.status === 'declined' ? ['declined', t('Declined')]
    : row.requestedAt ? ['waiting', t('Waiting for an answer')] : ['new', t('Not asked yet')]

  const add = (team: Team, position: Position, personId: number) => {
    if (!service || !personId) return
    const person = personById.get(personId)
    const notes = candidateNotes(personId, service, assignments, blockouts, teamNames)
    if (notes.away && !window.confirm(t('{name} is away on this date. Schedule anyway?', { name: person?.fullName || '' }))) return
    void run(async () => {
      await request('/api/serving-assignments', 'POST', { event: service.eventId, date: service.date, team: team.id, positionId: position.id, person: personId })
      return null
    })
  }

  const answer = (row: AssignmentRecord, status: AssignmentStatus) => run(async () => {
    await request(`/api/serving-assignments/${row.id}`, 'PATCH', { status })
    return null
  })

  const remove = (row: AssignmentRecord) => {
    const person = personById.get(refId(row.person) ?? 0)
    if (row.requestedAt && !window.confirm(t('Remove {name} from {position}? They were already asked, so let them know.', {
      name: person?.fullName || '', position: row.position }))) return
    void run(async () => {
      await request(`/api/serving-assignments/${row.id}`, 'DELETE')
      return null
    })
  }

  const sendRequests = () => service && run(async () => {
    const result = await request('/api/community/serving/send', 'POST', { service: service.key })
    const parts: string[] = []
    if (result.sent.length) parts.push(t('Emailed: {names}.', { names: result.sent.join(', ') }))
    if (result.failed.length) parts.push(t('The email could not be sent to: {names}.', { names: result.failed.map((item: { name: string }) => item.name).join(', ') }))
    const links = [...result.withoutEmail, ...result.failed]
    if (links.length) parts.push(result.emailEnabled ? t('Copy a private link for anyone without an email address and send it by text message:')
      : t('Email is not set up on this server. Copy each private link and send it by text message:'))
    return { kind: result.failed.length ? 'error' : 'ok', text: parts.join(' '), links }
  })

  const addAway = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await request('/api/serving-blockouts', 'POST', { person: Number(away.person), startDate: away.startDate,
        endDate: away.endDate || away.startDate, reason: away.reason || null })
      setAway({ person: '', startDate: '', endDate: '', reason: '' })
      return { kind: 'ok', text: t('Away dates saved.') }
    })
  }

  const removeAway = (row: BlockoutRecord) => run(async () => {
    await request(`/api/serving-blockouts/${row.id}`, 'DELETE')
    return null
  })

  const dateRange = (row: { startDate: string; endDate: string }) => row.startDate === row.endDate
    ? formatServiceDay(row.startDate, t.language) : `${formatServiceDay(row.startDate, t.language)} – ${formatServiceDay(row.endDate, t.language)}`
  const nameOf = (value: AssignmentRecord['person']) => personById.get(refId(value) ?? 0)?.fullName || t('Removed from the directory')
  const activePeople = people.filter(person => person.status !== 'inactive')
  const unsentPeople = new Set(rows.filter(row => row.status === 'pending' && !row.requestedAt).map(row => refId(row.person))).size

  const personOptions = (position: Position, team: Team) => {
    if (!service) return null
    const taken = new Set(rows.filter(row => refId(row.team) === team.id && row.positionId === position.id).map(row => refId(row.person)))
    const describe = (person: ServingPerson) => {
      const notes = candidateNotes(person.id, service, assignments, blockouts, teamNames)
      const hints = [notes.away && t('away'), notes.sameDay.length && t('also: {roles}', { roles: notes.sameDay.join(', ') }),
        notes.recent && t('served {count} in 8 weeks', { count: notes.recent })].filter(Boolean)
      return { person, notes, label: hints.length ? `${person.fullName} — ${hints.join('; ')}` : person.fullName }
    }
    const order = (a: ReturnType<typeof describe>, b: ReturnType<typeof describe>) =>
      Number(Boolean(a.notes.away)) - Number(Boolean(b.notes.away)) || a.notes.sameDay.length - b.notes.sameDay.length
      || a.notes.recent - b.notes.recent || a.person.fullName.localeCompare(b.person.fullName, t.language)
    const members = team.members.map(id => personById.get(id)).filter((person): person is ServingPerson => Boolean(person) && !taken.has(person!.id))
      .map(describe).sort(order)
    const memberIds = new Set(team.members)
    const others = activePeople.filter(person => !memberIds.has(person.id) && !taken.has(person.id)).map(describe)
      .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName, t.language))
    return <>
      {members.length > 0 && <optgroup label={t('Team members')}>
        {members.map(item => <option key={item.person.id} value={item.person.id}>{item.label}</option>)}
      </optgroup>}
      {others.length > 0 && <optgroup label={members.length ? t('Everyone else') : t('Church directory')}>
        {others.map(item => <option key={item.person.id} value={item.person.id}>{item.label}</option>)}
      </optgroup>}
    </>
  }

  const tabs: Array<[ServingTab, string]> = [['schedule', t('Schedule')], ['teams', t('Teams')], ['away', t('Away dates')]]
  const upcomingAway = blockouts.filter(row => row.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || nameOf(a.person).localeCompare(nameOf(b.person)))
  const scheduleHref = (start: string) => `/admin/serving?from=${start}`

  return <section className="heritage-people heritage-directory heritage-serving">
    <SetStepNav nav={[{ label: t('Serving') }]} />
    <div className="heritage-people__heading">
      <div>
        <h1>{t('Serving')}</h1>
        <p>{t('Teams: {teams} · Services in these weeks: {services} · Away dates: {away}', {
          teams: teams.length, services: services.length, away: upcomingAway.length })}</p>
      </div>
      <div className="heritage-directory__actions">
        <Link className="heritage-people__invite" href="/admin/collections/teams/create">{t('Add team')}</Link>
        <Link className="heritage-directory__secondary" href="/admin/collections/events">{t('Calendar')}</Link>
      </div>
    </div>

    <div className="heritage-directory__tabs" role="tablist">
      {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value}
        onClick={() => choose(value)}>{label}</button>)}
    </div>

    {message && <div className={`heritage-serving__message heritage-serving__message--${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
      <p>{message.text}</p>
      {message.links && message.links.length > 0 && <ul>
        {message.links.map(item => <li key={item.personId}>
          <span>{item.name}</span>
          <button type="button" className="heritage-directory__secondary" disabled={working}
            onClick={() => void copyLink(item.personId, service?.key)}>{t('Copy link')}</button>
        </li>)}
      </ul>}
      <button type="button" className="heritage-serving__dismiss" aria-label={t('Close')} onClick={() => setMessage(null)}>×</button>
    </div>}

    {tab === 'schedule' && <div className="heritage-serving__layout">
      <nav className="heritage-serving__dates" aria-label={t('Service dates')}>
        <div className="heritage-serving__range">
          <Link href={scheduleHref(addDays(from, -28))} aria-label={t('Earlier weeks')}>←</Link>
          <span>{formatServiceDay(from, t.language)} – {formatServiceDay(to, t.language)}</span>
          <Link href={scheduleHref(addDays(from, 28))} aria-label={t('Later weeks')}>→</Link>
        </div>
        {from !== today && <Link className="heritage-serving__today" href="/admin/serving">{t('Back to this week')}</Link>}
        {services.length === 0 && <p className="heritage-serving__empty">{t('No services on the calendar in these weeks.')}{' '}
          <Link href="/admin/collections/events">{t('Add your services to the calendar')}</Link> {t('(they can repeat every week).')}</p>}
        <ul>
          {services.map(item => {
            const fill = serviceFill(item, teams, assignments)
            return <li key={item.key}>
              <button type="button" aria-current={item.key === selectedKey ? 'true' : undefined} onClick={() => pick(item.key)}
                className={item.date < today ? 'is-past' : undefined}>
                <strong>{formatServiceDay(item.date, t.language)}</strong>
                <span>{item.title}</span>
                {fill.accepted + fill.declined + fill.unsent + fill.waiting === 0
                  ? <small className="is-empty">{t('Nobody scheduled yet')}</small>
                  : fill.needed > 0 && <small className={fill.filled >= fill.needed ? 'is-full' : undefined}>
                    {t('{filled} of {needed} filled', { filled: fill.filled, needed: fill.needed })}
                    {fill.declined > 0 && <em> · {t('{count} declined', { count: fill.declined })}</em>}
                  </small>}
              </button>
            </li>
          })}
        </ul>
      </nav>

      <div className="heritage-serving__service">
        {!service && services.length > 0 && <p>{t('Choose a service date.')}</p>}
        {service && <>
          <header className="heritage-serving__service-heading">
            <div>
              <h2>{service.title}</h2>
              <p>{formatServiceTime(service.startsAt, service.timeZone, t.language)}{service.location ? ` · ${service.location}` : ''}</p>
            </div>
            {teams.length > 0 && <button type="button" className="heritage-people__invite" disabled={working || unsentPeople === 0}
              onClick={() => void sendRequests()}>
              {unsentPeople ? t('Send requests ({count})', { count: unsentPeople }) : t('Everyone has been asked')}
            </button>}
          </header>
          {teams.length > 0 && !emailEnabled && <p className="heritage-serving__hint">{t('Email is not set up on this server, so use Copy link and send each person their private link by text message.')}</p>}
          {teams.length === 0 && <div className="heritage-serving__empty">
            <p>{t('Create your first team, for example Worship, Sound and slides, Greeters or Children.')}</p>
            <Link className="heritage-people__invite" href="/admin/collections/teams/create">{t('Add team')}</Link>
          </div>}
          {teams.map(team => {
            const teamRows = rows.filter(row => refId(row.team) === team.id)
            const known = new Set(team.positions.map(position => position.id))
            const removed = teamRows.filter(row => !known.has(row.positionId))
            return <article key={team.id} className="heritage-serving__team">
              <header>
                <h3>{team.name}</h3>
                <Link href={`/admin/collections/teams/${team.id}`}>{t('Edit team')}</Link>
              </header>
              <ul className="heritage-serving__positions">
                {team.positions.map(position => {
                  const assigned = teamRows.filter(row => row.positionId === position.id)
                  const filled = assigned.filter(row => row.status !== 'declined').length
                  return <li key={position.id}>
                    <div className="heritage-serving__position-name">
                      <strong>{position.name}</strong>
                      <span className={filled >= position.needed ? 'is-full' : 'is-open'}>
                        {t('{filled} of {needed}', { filled, needed: position.needed })}
                      </span>
                    </div>
                    {assigned.length > 0 && <ul className="heritage-serving__people">
                      {assigned.map(row => {
                        const [state, label] = statusLabel(row)
                        const name = nameOf(row.person)
                        return <li key={row.id} className={`heritage-serving__person heritage-serving__person--${state}`}>
                          <span className="heritage-serving__name">{name}</span>
                          <span className="heritage-serving__badge">{label}</span>
                          {row.note && <span className="heritage-serving__note">“{row.note}”</span>}
                          <span className="heritage-serving__controls">
                            <select aria-label={t('Answer for {name}', { name })} value={row.status} disabled={working}
                              onChange={event => void answer(row, event.target.value as AssignmentStatus)}>
                              <option value="pending">{t('No answer yet')}</option>
                              <option value="accepted">{t('Accepted')}</option>
                              <option value="declined">{t('Declined')}</option>
                            </select>
                            <button type="button" disabled={working} onClick={() => void copyLink(refId(row.person) ?? 0, service.key)}>{t('Copy link')}</button>
                            <button type="button" disabled={working} aria-label={t('Remove {name} from {position}', { name, position: position.name })}
                              onClick={() => remove(row)}>×</button>
                          </span>
                        </li>
                      })}
                    </ul>}
                    <select className="heritage-serving__add" value="" disabled={working}
                      aria-label={t('Add someone as {position}', { position: position.name })}
                      onChange={event => add(team, position, Number(event.target.value))}>
                      <option value="">{filled >= position.needed ? t('+ Add another person…') : t('+ Add someone…')}</option>
                      {personOptions(position, team)}
                    </select>
                  </li>
                })}
                {removed.length > 0 && <li>
                  <div className="heritage-serving__position-name"><strong>{t('Positions removed from the team')}</strong></div>
                  <ul className="heritage-serving__people">
                    {removed.map(row => <li key={row.id} className="heritage-serving__person">
                      <span className="heritage-serving__name">{nameOf(row.person)}</span>
                      <span className="heritage-serving__badge">{row.position}</span>
                      <span className="heritage-serving__controls">
                        <button type="button" disabled={working} aria-label={t('Remove {name} from {position}', { name: nameOf(row.person), position: row.position })}
                          onClick={() => remove(row)}>×</button>
                      </span>
                    </li>)}
                  </ul>
                </li>}
              </ul>
            </article>
          })}
        </>}
      </div>
    </div>}

    {tab === 'teams' && <>
      {teams.length === 0 && <div className="heritage-serving__empty">
        <p>{t('Create your first team, for example Worship, Sound and slides, Greeters or Children.')}</p>
      </div>}
      <div className="heritage-directory__households">
        {teams.map(team => {
          const members = team.members.map(id => personById.get(id)).filter((person): person is ServingPerson => Boolean(person))
            .sort((a, b) => a.fullName.localeCompare(b.fullName, t.language))
          return <article key={team.id} className="heritage-directory__household heritage-serving__card">
            <header>
              <h2>{team.name}</h2>
              <Link href={`/admin/collections/teams/${team.id}`}>{t('Edit')}</Link>
            </header>
            {team.description && <p className="heritage-serving__description">{team.description}</p>}
            <p className="heritage-serving__position-list">{team.positions.map(position =>
              position.needed > 1 ? `${position.name} ×${position.needed}` : position.name).join(' · ')}</p>
            {members.length === 0 ? <p>{t('No team members yet.')}</p> : <ul className="heritage-serving__members">
              {members.map(person => <li key={person.id}>
                <span>{person.fullName}<small>{person.hasEmail ? t('Email') : person.phone ? t('Phone only') : t('No email or phone')}</small></span>
                <span className="heritage-serving__controls">
                  <button type="button" disabled={working} onClick={() => void copyLink(person.id)}>{t('Copy link')}</button>
                  <button type="button" disabled={working} onClick={() => resetLink(person)}>{t('New link')}</button>
                </span>
              </li>)}
            </ul>}
          </article>
        })}
      </div>
    </>}

    {tab === 'away' && <>
      <form className="heritage-serving__away-form" onSubmit={addAway}>
        <label>{t('Person')}
          <select required value={away.person} onChange={event => setAway({ ...away, person: event.target.value })}>
            <option value="">{t('Choose…')}</option>
            {activePeople.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
          </select>
        </label>
        <label>{t('First day')}
          <input type="date" required min={today} value={away.startDate}
            onChange={event => setAway({ ...away, startDate: event.target.value, endDate: away.endDate && away.endDate < event.target.value ? '' : away.endDate })} />
        </label>
        <label>{t('Last day (optional)')}
          <input type="date" min={away.startDate || today} value={away.endDate} onChange={event => setAway({ ...away, endDate: event.target.value })} />
        </label>
        <label>{t('Note (optional)')}
          <input type="text" maxLength={300} value={away.reason} onChange={event => setAway({ ...away, reason: event.target.value })} />
        </label>
        <button type="submit" className="heritage-people__invite" disabled={working}>{t('Add away dates')}</button>
      </form>
      <p className="heritage-serving__hint">{t('Volunteers can also add their own away dates from their private link.')}</p>
      {upcomingAway.length === 0 ? <p>{t('Nobody is away in the coming weeks.')}</p> : <div className="heritage-people__table"><table>
        <thead><tr><th>{t('Person')}</th><th>{t('Dates')}</th><th>{t('Note')}</th><th><span className="sr-only">{t('Remove')}</span></th></tr></thead>
        <tbody>
          {upcomingAway.map(row => <tr key={row.id}>
            <td>{nameOf(row.person)}</td>
            <td>{dateRange(row)}</td>
            <td>{row.reason || '—'}</td>
            <td><button type="button" className="heritage-directory__secondary" disabled={working} onClick={() => void removeAway(row)}>{t('Remove')}</button></td>
          </tr>)}
        </tbody>
      </table></div>}
    </>}
  </section>
}

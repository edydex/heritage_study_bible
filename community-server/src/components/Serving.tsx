import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps, CollectionSlug, PayloadRequest, SelectType, Where } from 'payload'
import { redirect } from 'next/navigation'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import {
  parseServiceKey, SCHEDULE_DAYS, RECENT_DAYS, servicesBetween, teamMemberIds, teamPositions,
  type AssignmentRecord, type BlockoutRecord, type EventRecord, type TeamRecord,
} from '@/lib/serving'
import { servingEmailEnabled } from '@/lib/servingEmail'
import { addDays, canonicalTimeZone, localDate, validDate } from '../../packages/calendar-core/index.js'
import ServingWorkspace, { type ServingPerson, type ServingTab, type ServingTeam } from './ServingWorkspace'

async function readAll<T>(req: PayloadRequest, collection: CollectionSlug, where: Where, select?: SelectType) {
  const docs: T[] = []
  for (let page = 1; ; page += 1) {
    const result = await req.payload.find({ collection, req, overrideAccess: false, depth: 0, limit: 250, page, where, select })
    docs.push(...result.docs as unknown as T[])
    if (!result.hasNextPage) return docs
  }
}

export default async function Serving(props: AdminViewServerProps) {
  const { initPageResult } = props
  const { req } = initPageResult
  if (!req.user) redirect('/admin/login?redirect=%2Fadmin%2Fserving')
  const systemAdmin = req.user.systemRole === 'system-admin'
  const community = await getConfiguredCommunityId(req.payload)
  const role = community ? (await req.payload.find({ collection: 'memberships', req, overrideAccess: true, depth: 0, limit: 1,
    where: { and: [{ community: { equals: community } }, { user: { equals: req.user.id } }] } })).docs[0]?.role ?? null : null
  const canManage = Boolean(community) && (systemAdmin || ['owner', 'admin', 'leader'].includes(String(role)))

  const params = (await props.searchParams) || {}
  const requestedTab = String(params.tab || '')
  const tab: ServingTab = requestedTab === 'teams' || requestedTab === 'away' ? requestedTab : 'schedule'
  const church = community ? await req.payload.findByID({ collection: 'communities', id: community, depth: 0, overrideAccess: true, req }) : null
  const today = localDate(new Date(), canonicalTimeZone(church?.timeZone) || 'UTC')
  // A link to one service (for example from a "cannot serve" email) opens the weeks that include it.
  const wanted = parseServiceKey(params.service)
  let from = validDate(params.from) ? String(params.from) : today
  if (!validDate(params.from) && wanted && (wanted.date < today || wanted.date > addDays(today, SCHEDULE_DAYS - 1))) from = wanted.date
  const to = addDays(from, SCHEDULE_DAYS - 1)

  let data = {
    services: [] as ReturnType<typeof servicesBetween>, teams: [] as ServingTeam[], people: [] as ServingPerson[],
    assignments: [] as AssignmentRecord[], blockouts: [] as BlockoutRecord[],
  }
  if (canManage && community) {
    const inChurch = { community: { equals: community } }
    const [events, teams, people, assignments, blockouts] = await Promise.all([
      readAll<EventRecord>(req, 'events', inChurch),
      readAll<TeamRecord>(req, 'teams', inChurch, { name: true, description: true, positions: true, members: true }),
      readAll<{ id: number; fullName: string; firstName: string; lastName?: string | null; status?: string | null; email?: string | null; phone?: string | null }>(req, 'people', inChurch, { fullName: true, firstName: true, lastName: true, status: true, email: true, phone: true }),
      readAll<AssignmentRecord>(req, 'serving-assignments', { and: [inChurch,
        { date: { greater_than_equal: addDays(from, -RECENT_DAYS) } }, { date: { less_than_equal: to } }] }),
      readAll<BlockoutRecord>(req, 'serving-blockouts', { and: [inChurch,
        { endDate: { greater_than_equal: from < today ? from : today } }] }),
    ])
    data = {
      services: servicesBetween(events, from, SCHEDULE_DAYS),
      teams: teams.map(team => ({ id: team.id, name: team.name, description: team.description || null,
        positions: teamPositions(team), members: teamMemberIds(team) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      people: people.map(person => ({ id: person.id, fullName: person.fullName, firstName: person.firstName, lastName: person.lastName || null,
        status: person.status, hasEmail: Boolean(person.email), phone: person.phone || null })),
      assignments: assignments.map(row => ({ id: row.id, event: row.event, date: row.date, team: row.team, positionId: row.positionId,
        position: row.position, person: row.person, status: row.status, requestedAt: row.requestedAt || null,
        respondedAt: row.respondedAt || null, note: row.note || null })),
      blockouts: blockouts.map(row => ({ id: row.id, person: row.person, startDate: row.startDate, endDate: row.endDate, reason: row.reason || null })),
    }
  }
  const selected = data.services.find(service => wanted && service.eventId === wanted.eventId && service.date === wanted.date)
    ?? data.services.find(service => service.date >= today) ?? data.services[0] ?? null

  return <DefaultTemplate i18n={props.i18n} locale={initPageResult.locale} params={props.params}
    payload={props.payload} permissions={initPageResult.permissions} req={req}
    searchParams={props.searchParams} user={req.user} viewActions={props.viewActions}
    viewType="serving" visibleEntities={initPageResult.visibleEntities}>
    <ServingWorkspace key={from} canManage={canManage} churchConfigured={community != null} emailEnabled={servingEmailEnabled()}
      today={today} from={from} to={to} initialTab={tab} initialService={selected?.key ?? null} {...data} />
  </DefaultTemplate>
}

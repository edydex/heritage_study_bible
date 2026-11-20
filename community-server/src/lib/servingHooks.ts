import { APIError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
import { membershipCommunityIds } from '@/access'
import { getConfiguredCommunityId } from './configuredCommunity'
import { cleanNote, refId, serviceOn, teamPositions, validateBlockout, type EventRecord, type TeamRecord } from './serving'

/** Set by the volunteer-link endpoints, which act for the volunteer rather than a signed-in user. */
export const SERVING_SYSTEM_WRITE = 'heritage:serving-system-write'
const MANAGER_ROLES = ['owner', 'admin', 'leader']

const fail = (message: string, status = 400) => new APIError(message, status, null, true)

function systemWrite(req: PayloadRequest) {
  return Boolean((req.context as Record<string, unknown> | undefined)?.[SERVING_SYSTEM_WRITE])
}

/**
 * Collection access already requires a church manager. This also stops a
 * manager of one church from writing into another church on the same server.
 * Server code without a user (seeding, tests) has already bypassed access.
 */
async function assertManager(req: PayloadRequest, communityId: number | null) {
  if (!communityId) throw fail('Choose a church.')
  if (systemWrite(req) || !req.user || req.user.systemRole === 'system-admin') return
  const ids = await membershipCommunityIds(req, MANAGER_ROLES)
  if (!ids.map(String).includes(String(communityId))) throw fail('You can only manage your own church’s serving schedule.', 403)
}

async function find<T>(req: PayloadRequest, collection: 'events' | 'teams' | 'people', id: unknown): Promise<T | null> {
  const key = refId(id as number)
  if (!key) return null
  try {
    return await req.payload.findByID({ collection, id: key, depth: 0, overrideAccess: true, req }) as T
  } catch {
    return null
  }
}

async function communityFor(req: PayloadRequest, value: unknown) {
  return refId(value as number) ?? await getConfiguredCommunityId(req.payload)
}

type PersonRef = { id: number; community: unknown; firstName?: string; fullName?: string }

export const prepareTeam: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const next = { ...data }
  const communityId = operation === 'update' ? refId(originalDoc?.community) : await communityFor(req, next.community)
  if (operation === 'create') {
    await assertManager(req, communityId)
    next.community = communityId
  } else {
    next.community = originalDoc?.community
  }
  if (typeof next.name === 'string') next.name = next.name.trim()
  if (Array.isArray(next.positions)) {
    const seen = new Set<string>()
    for (const position of next.positions as Array<{ name?: string }>) {
      position.name = String(position.name || '').trim()
      const key = position.name.toLocaleLowerCase()
      if (seen.has(key)) throw fail(`The position “${position.name}” is listed twice.`)
      seen.add(key)
    }
  }
  if (Array.isArray(next.members)) {
    const ids = [...new Set(next.members.map(value => refId(value as number)).filter((id): id is number => id != null))]
    if (ids.length) {
      const found = await req.payload.count({ collection: 'people', overrideAccess: true, req,
        where: { and: [{ id: { in: ids } }, { community: { equals: communityId } }] } })
      if (found.totalDocs !== ids.length) throw fail('Choose team members from this church’s directory.')
    }
    next.members = ids
  }
  return next
}

const FIXED_ASSIGNMENT_FIELDS = ['community', 'event', 'date', 'team', 'positionId', 'position', 'person', 'scheduledBy'] as const

export const prepareServingAssignment: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const next = { ...data }
  const system = systemWrite(req)
  if (operation === 'update' && originalDoc) {
    // Who, when and where never change; remove the assignment and schedule again instead.
    for (const key of FIXED_ASSIGNMENT_FIELDS) next[key] = originalDoc[key]
    if (!system) next.requestedAt = originalDoc.requestedAt ?? null
  } else {
    const communityId = await communityFor(req, next.community)
    await assertManager(req, communityId)
    const [event, team, person] = await Promise.all([
      find<EventRecord & { community: unknown }>(req, 'events', next.event),
      find<TeamRecord & { community: unknown }>(req, 'teams', next.team),
      find<PersonRef>(req, 'people', next.person),
    ])
    if (!event || refId(event.community as number) !== communityId) throw fail('Choose a service from this church’s calendar.')
    if (!serviceOn(event, String(next.date || ''))) throw fail('This service does not take place on that date.')
    if (!team || refId(team.community as number) !== communityId) throw fail('Choose one of this church’s teams.')
    const position = teamPositions(team).find(item => item.id === String(next.positionId || ''))
    if (!position) throw fail('Choose one of the team’s positions.')
    if (!person || refId(person.community as number) !== communityId) throw fail('Choose someone from this church’s directory.')
    const duplicate = await req.payload.count({ collection: 'serving-assignments', overrideAccess: true, req, where: { and: [
      { event: { equals: event.id } }, { date: { equals: next.date } }, { team: { equals: team.id } },
      { positionId: { equals: position.id } }, { person: { equals: person.id } }] } })
    if (duplicate.totalDocs) throw fail(`${person.fullName || person.firstName || 'This person'} is already scheduled for ${position.name}.`, 409)
    Object.assign(next, { community: communityId, event: event.id, team: team.id, positionId: position.id, position: position.name,
      person: person.id, scheduledBy: system ? next.scheduledBy ?? null : req.user?.id ?? null, requestedAt: null })
  }
  const previous = operation === 'update' ? originalDoc?.status : undefined
  const status = next.status ?? previous ?? 'pending'
  next.status = status
  if (!system) next.respondedAt = status === previous ? originalDoc?.respondedAt ?? null : status === 'pending' ? null : new Date().toISOString()
  next.note = cleanNote(next.note === undefined ? originalDoc?.note : next.note)
  return next
}

export const prepareServingBlockout: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const next = { ...data }
  const communityId = operation === 'update' ? refId(originalDoc?.community) : await communityFor(req, next.community)
  if (operation === 'create') await assertManager(req, communityId)
  next.community = communityId
  const personId = operation === 'update' ? refId(originalDoc?.person) : refId(next.person as number)
  const person = await find<PersonRef>(req, 'people', personId)
  if (!person || refId(person.community as number) !== communityId) throw fail('Choose someone from this church’s directory.')
  next.person = person.id
  const startDate = next.startDate ?? originalDoc?.startDate
  const endDate = next.endDate ?? originalDoc?.endDate ?? startDate
  const valid = validateBlockout(startDate, endDate)
  if (valid !== true) throw fail(valid)
  Object.assign(next, { startDate, endDate, reason: cleanNote(next.reason === undefined ? originalDoc?.reason : next.reason) })
  return next
}

import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps, CollectionSlug, PayloadRequest, SelectType } from 'payload'
import { redirect } from 'next/navigation'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { buildPeopleDirectory } from '@/lib/peopleDirectory'
import type { HouseholdRecord, PersonRecord } from '@/lib/peopleProfiles'
import PeopleDirectory from './PeopleDirectory'

async function readPages<T>(req: PayloadRequest, collection: CollectionSlug, select: SelectType, community?: number | null) {
  const docs: T[] = []
  let page = 1
  for (;;) {
    const result = await req.payload.find({ collection, req, overrideAccess: false, depth: 0,
      limit: 250, page, select, ...(community ? { where: { community: { equals: community } } } : {}) })
    docs.push(...result.docs as unknown as T[])
    if (!result.hasNextPage) return docs
    page += 1
  }
}

const PERSON_FIELDS = { firstName: true, lastName: true, preferredName: true, fullName: true, status: true, gender: true,
  household: true, householdRole: true, email: true, phone: true, birthDate: true, memberSince: true, baptismDate: true,
  user: true, notes: true } as const
const HOUSEHOLD_FIELDS = { name: true, phone: true, address: true } as const

export default async function People(props: AdminViewServerProps) {
  const { initPageResult } = props
  const { req } = initPageResult
  if (!req.user) redirect('/admin/login?redirect=%2Fadmin%2Fpeople')
  const systemAdmin = req.user.systemRole === 'system-admin'
  const community = await getConfiguredCommunityId(req.payload)
  const role = community ? (await req.payload.find({ collection: 'memberships', req, overrideAccess: true, depth: 0, limit: 1,
    where: { and: [{ community: { equals: community } }, { user: { equals: req.user.id } }] } })).docs[0]?.role ?? null : null
  const canView = systemAdmin || ['owner', 'admin', 'leader'].includes(String(role))
  const canEdit = systemAdmin || ['owner', 'admin'].includes(String(role))
  const requested = (await props.searchParams)?.tab
  const tab = requested === 'households' || requested === 'accounts' ? requested : 'people'
  // Access rules still apply to every read below: leaders never receive private notes.
  const [people, households] = canView && community ? await Promise.all([
    readPages<PersonRecord>(req, 'people', PERSON_FIELDS, community),
    readPages<HouseholdRecord>(req, 'households', HOUSEHOLD_FIELDS, community),
  ]) : [[], []]
  const accounts = systemAdmin ? await Promise.all([
    readPages<Parameters<typeof buildPeopleDirectory>[0][number]>(req, 'users', { email: true, displayName: true, systemRole: true, preferredLanguage: true }),
    community ? readPages<Parameters<typeof buildPeopleDirectory>[1][number]>(req, 'memberships', { user: true, role: true, joinedAt: true }, community) : Promise.resolve([]),
    community ? readPages<Parameters<typeof buildPeopleDirectory>[2][number]>(req, 'community-invites', { email: true, displayName: true, role: true, active: true, emailSentAt: true, acceptedAt: true, preferredLanguage: true }, community) : Promise.resolve([]),
  ]).then(([users, memberships, invitations]) => buildPeopleDirectory(users, memberships, invitations)) : []
  return <DefaultTemplate i18n={props.i18n} locale={initPageResult.locale} params={props.params}
    payload={props.payload} permissions={initPageResult.permissions} req={req}
    searchParams={props.searchParams} user={req.user} viewActions={props.viewActions}
    viewType="people" visibleEntities={initPageResult.visibleEntities}>
    <PeopleDirectory people={people} households={households} accounts={accounts} canView={canView} canEdit={canEdit}
      systemAdmin={systemAdmin} churchConfigured={community != null} initialTab={tab === 'accounts' && !systemAdmin ? 'people' : tab} />
  </DefaultTemplate>
}

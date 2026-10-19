import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps, CollectionSlug, PayloadRequest, SelectType } from 'payload'
import { redirect } from 'next/navigation'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { buildPeopleDirectory } from '@/lib/peopleDirectory'
import PeopleClient from './PeopleClient'

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

export default async function People(props: AdminViewServerProps) {
  const { initPageResult } = props
  const { req } = initPageResult
  if (!req.user) redirect('/admin/login?redirect=%2Fadmin%2Fpeople')
  const permitted = req.user.systemRole === 'system-admin'
  const community = permitted ? await getConfiguredCommunityId(req.payload) : null
  const rows = permitted ? await Promise.all([
    readPages<Parameters<typeof buildPeopleDirectory>[0][number]>(req, 'users', { email: true, displayName: true, systemRole: true, preferredLanguage: true }),
    community ? readPages<Parameters<typeof buildPeopleDirectory>[1][number]>(req, 'memberships', { user: true, role: true, joinedAt: true }, Number(community)) : Promise.resolve([]),
    community ? readPages<Parameters<typeof buildPeopleDirectory>[2][number]>(req, 'community-invites', { email: true, displayName: true, role: true, active: true, emailSentAt: true, acceptedAt: true, preferredLanguage: true }, Number(community)) : Promise.resolve([]),
  ]).then(([accounts, memberships, invitations]) => buildPeopleDirectory(accounts, memberships, invitations)) : []
  return <DefaultTemplate i18n={props.i18n} locale={initPageResult.locale} params={props.params}
    payload={props.payload} permissions={initPageResult.permissions} req={req}
    searchParams={props.searchParams} user={req.user} viewActions={props.viewActions}
    viewType="people" visibleEntities={initPageResult.visibleEntities}>
    <PeopleClient rows={rows} permitted={permitted} churchConfigured={community != null} />
  </DefaultTemplate>
}

import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import SermonPublicationReviewClient from './SermonPublicationReviewClient'
import { parseSermonPublicationReviewTarget } from './sermonPublicationReviewModel'

export default function SermonPublicationReview(props: AdminViewServerProps) {
  const { initPageResult } = props
  const initialTarget = parseSermonPublicationReviewTarget(props.searchParams)
  return (
    <DefaultTemplate
      i18n={props.i18n}
      locale={initPageResult.locale}
      params={props.params}
      payload={props.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={props.searchParams}
      user={initPageResult.req.user || undefined}
      viewActions={props.viewActions}
      viewType="sermon-publications"
      visibleEntities={initPageResult.visibleEntities}
    >
      <SermonPublicationReviewClient initialTarget={initialTarget} />
    </DefaultTemplate>
  )
}

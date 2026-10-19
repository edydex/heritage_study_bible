import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import PrepareSermonClient from './PrepareSermonClient'

export default function PrepareSermon(props: AdminViewServerProps) {
  const { initPageResult } = props
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
      viewType="prepare-sermon"
      visibleEntities={initPageResult.visibleEntities}
    >
      <PrepareSermonClient />
    </DefaultTemplate>
  )
}

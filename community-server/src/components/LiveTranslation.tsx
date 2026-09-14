import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import LiveTranslationClient from './LiveTranslationClient'

export default function LiveTranslation(props: AdminViewServerProps) {
  const { initPageResult } = props
  // SyncShow supplies its scoped credential to the client API request, not this
  // HTML request. Let that request distinguish a paired window from a visitor.
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
      viewType="live-translation"
      visibleEntities={initPageResult.visibleEntities}
    >
      <LiveTranslationClient />
    </DefaultTemplate>
  )
}

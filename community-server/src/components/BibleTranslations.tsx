import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import BibleTranslationsClient from './BibleTranslationsClient'
export default function BibleTranslations(props: AdminViewServerProps) {
  const { initPageResult } = props
  return <DefaultTemplate i18n={props.i18n} locale={initPageResult.locale} params={props.params} payload={props.payload}
    permissions={initPageResult.permissions} req={initPageResult.req} searchParams={props.searchParams}
    user={initPageResult.req.user || undefined} viewActions={props.viewActions} viewType="bible-translations" visibleEntities={initPageResult.visibleEntities}>
    <BibleTranslationsClient />
  </DefaultTemplate>
}

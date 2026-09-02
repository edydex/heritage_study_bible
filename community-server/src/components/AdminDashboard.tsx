import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import AdminWelcome from './AdminWelcome'

export default function AdminDashboard(props: AdminViewServerProps) {
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
      viewType="dashboard"
      visibleEntities={initPageResult.visibleEntities}
    >
      <AdminWelcome />
    </DefaultTemplate>
  )
}

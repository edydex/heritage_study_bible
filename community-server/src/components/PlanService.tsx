import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import PlanServiceClient from './PlanServiceClient'

export default function PlanService(props: AdminViewServerProps) {
  const { initPageResult } = props
  return (
    <DefaultTemplate
      className="heritage-planner-frame"
      i18n={props.i18n}
      locale={initPageResult.locale}
      params={props.params}
      payload={props.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={props.searchParams}
      user={initPageResult.req.user || undefined}
      viewActions={props.viewActions}
      viewType="plan-service"
      visibleEntities={initPageResult.visibleEntities}
    >
      <PlanServiceClient />
    </DefaultTemplate>
  )
}

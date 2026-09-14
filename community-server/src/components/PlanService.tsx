import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import PlanServiceClient from './PlanServiceClient'
import { redirect } from 'next/navigation'
import { workspaceSignInRedirect } from '../lib/workspaceNavigation'

export default function PlanService(props: AdminViewServerProps) {
  const { initPageResult } = props
  const signIn = workspaceSignInRedirect(initPageResult.req.user, '/admin/plan-service', props.searchParams)
  if (signIn) redirect(signIn)
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

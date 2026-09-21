import AdminWelcome from './AdminWelcome'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { workspaceSignInRedirect } from '../lib/workspaceNavigation'

export default function AdminDashboard(props: AdminViewServerProps) {
  const signIn = workspaceSignInRedirect(props.initPageResult.req.user, '/admin', props.searchParams)
  if (signIn) redirect(signIn)
  return (
    <main className="heritage-admin-workspace">
      <AdminWelcome />
    </main>
  )
}

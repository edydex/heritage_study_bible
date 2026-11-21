'use client'

import Link from 'next/link'
import { useAuth, useFormFields } from '@payloadcms/ui'
import { useWorkspaceText } from './useWorkspaceText'

/** Whether this person signs in, without exposing account details to church administrators. */
export default function PersonAccountNotice() {
  const t = useWorkspaceText()
  const { user } = useAuth()
  const linked = useFormFields(([fields]) => fields.user?.value)
  const email = useFormFields(([fields]) => fields.email?.value) as string | undefined
  if (linked) return <p className="heritage-person-account heritage-person-account--linked">{t('This person signs in with their own account. Church roles are changed on the Accounts & invitations tab.')}</p>
  return <p className="heritage-person-account">
    {t('No account. This person is in the directory but does not sign in.')}{' '}
    {user?.systemRole === 'system-admin' && email && <Link href={`/admin/collections/community-invites/create?email=${encodeURIComponent(email)}`}>{t('Invite them by email')}</Link>}
  </p>
}

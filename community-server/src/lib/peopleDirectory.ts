import type { CommunityInvite, Membership, User } from '@/payload-types'

type Account = Pick<User, 'id' | 'email' | 'displayName' | 'systemRole' | 'preferredLanguage'>
type Invitation = Pick<CommunityInvite, 'id' | 'email' | 'displayName' | 'role' | 'active' | 'emailSentAt' | 'acceptedAt' | 'preferredLanguage'>
type ChurchMembership = Pick<Membership, 'id' | 'user' | 'role' | 'joinedAt'>

export type PersonDirectoryRow = {
  key: string; name: string; email: string; role: Membership['role'] | null
  invitationStatus: 'pending' | 'not-sent' | 'accepted' | 'revoked' | 'none'
  invitationActive: boolean | null; emailSentAt: string | null; acceptedAt: string | null
  language: 'en' | 'ru'; serverAdmin: boolean
  accountId: number | null; invitationId: number | null; membershipId: number | null
}

/** Only selected public account fields reach the client; pending invitees also have a row. */
export function buildPeopleDirectory(accounts: Account[], memberships: ChurchMembership[], invitations: Invitation[]): PersonDirectoryRow[] {
  const byEmail = new Map<string, PersonDirectoryRow>()
  const byAccount = new Map(memberships.map(m => [typeof m.user === 'object' ? m.user.id : m.user, m]))
  for (const account of accounts) {
    const email = account.email.trim().toLowerCase()
    const membership = byAccount.get(account.id)
    byEmail.set(email, {
      key: email, name: account.displayName || email, email,
      role: membership?.role || null, invitationStatus: 'none', invitationActive: null,
      emailSentAt: null, acceptedAt: null, language: account.preferredLanguage === 'ru' ? 'ru' : 'en',
      serverAdmin: account.systemRole === 'system-admin', accountId: account.id,
      invitationId: null, membershipId: membership?.id || null,
    })
  }
  for (const invitation of invitations) {
    const email = invitation.email.trim().toLowerCase()
    const row = byEmail.get(email) || {
      key: email, name: invitation.displayName || email, email, role: null,
      language: invitation.preferredLanguage === 'ru' ? 'ru' : 'en', serverAdmin: false,
      accountId: null, membershipId: null,
    }
    const status = invitation.active ? (invitation.emailSentAt ? 'pending' : 'not-sent')
      : invitation.acceptedAt ? 'accepted' : 'revoked'
    byEmail.set(email, { ...row, role: row.role || invitation.role,
      invitationStatus: status, invitationActive: invitation.active, invitationId: invitation.id,
      emailSentAt: invitation.emailSentAt || null, acceptedAt: invitation.acceptedAt || null })
  }
  return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))
}

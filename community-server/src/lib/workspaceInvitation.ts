import { randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { CollectionAfterLoginHook, PayloadRequest } from 'payload'
import { communityPublicConfig } from './publicConfig'

export const WORKSPACE_INVITATION_HOURS = 24

function escapeHTML(value: unknown) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/** The recipient chooses their password; invitation creation never elevates systemRole. */
export async function sendWorkspaceInvitation(
  req: PayloadRequest,
  invitation: {
    email: string
    displayName?: string | null
    role: string
  },
) {
  const { payload } = req
  const email = invitation.email.trim().toLowerCase()
  let user = (
    await payload.find({
      collection: 'users',
      req,
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { email: { equals: email } },
    })
  ).docs[0]
  if (!user) {
    user = await payload.create({
      collection: 'users',
      req,
      overrideAccess: true,
      data: {
        email,
        displayName: invitation.displayName || email.split('@')[0],
        password: randomBytes(32).toString('base64url'),
        systemRole: 'member',
        accountProtection: 'email',
        syncGeneration: 1,
      },
    })
  }
  // Reuse Payload's expiring password-setup flow, in the invitation transaction.
  // No password is changed until the recipient opens the link and submits one.
  const token = await payload.forgotPassword({
    collection: 'users',
    req,
    data: { email },
    disableEmail: true,
    expiration: WORKSPACE_INVITATION_HOURS * 60 * 60_000,
  })
  if (!token) throw new Error('Workspace account could not be prepared.')
  const setupURL = `${communityPublicConfig.publicUrl}/admin/reset/${encodeURIComponent(token)}`
  const loginURL = `${communityPublicConfig.publicUrl}/admin/login`
  const role =
    invitation.role === 'admin' ? 'church administrator' : 'church leader'
  const name = communityPublicConfig.name
  await payload.sendEmail({
    to: email,
    subject: `You’re invited to the ${name} workspace`,
    text: `You have been invited as a ${role} at ${name}.\n\nSet your workspace password: ${setupURL}\n\nThis setup link expires in ${WORKSPACE_INVITATION_HOURS} hours. Already have a workspace password? Sign in at ${loginURL} instead. Your invitation is accepted when you sign in.\n\nThe church workspace is where you prepare services, manage songs and create sermon slides. Heritage reader sign-in is separate. If the setup link expires, use Forgot Password on the workspace sign-in page.`,
    html: `<p>You have been invited as a <strong>${escapeHTML(role)}</strong> at ${escapeHTML(name)}.</p><p><a href="${escapeHTML(setupURL)}">Set your workspace password</a></p><p>This setup link expires in ${WORKSPACE_INVITATION_HOURS} hours. Already have a workspace password? <a href="${escapeHTML(loginURL)}">Sign in to the church workspace</a> instead. Your invitation is accepted when you sign in.</p><p>The church workspace is where you prepare services, manage songs and create sermon slides. Heritage reader sign-in is separate.</p><p>If the setup link expires, use Forgot Password on the workspace sign-in page.</p>`,
  })
}

const roleRank: Record<string, number> = {
  member: 0,
  leader: 1,
  admin: 2,
  owner: 3,
}

/** Password setup also runs afterLogin. Never accept through a reader bearer token. */
export const acceptWorkspaceInvitations: CollectionAfterLoginHook = async ({
  req,
  user,
}) => {
  // Hold invitation rows through membership creation and acceptance. A concurrent
  // revocation or role change must finish before or after the whole transition.
  const transactionID = await req.transactionID
  const adapter = req.payload.db as unknown as {
    sessions: Record<
      string,
      {
        db: { execute: (query: unknown) => Promise<unknown> }
      }
    >
  }
  const database =
    transactionID == null ? null : adapter.sessions[String(transactionID)]?.db
  if (!database)
    throw new Error('Workspace invitation transaction is unavailable.')
  await database.execute(sql`
    SELECT "id" FROM "community_invites"
    WHERE "email" = ${String(user.email || '')
      .trim()
      .toLowerCase()}
      AND "active" = true AND "role" IN ('admin', 'leader')
    ORDER BY "id" FOR UPDATE
  `)
  const invitations = await req.payload.find({
    collection: 'community-invites',
    req,
    overrideAccess: true,
    depth: 0,
    limit: 100,
    where: {
      and: [
        {
          email: {
            equals: String(user.email || '')
              .trim()
              .toLowerCase(),
          },
        },
        { active: { equals: true } },
        { role: { in: ['admin', 'leader'] } },
      ],
    },
  })
  for (const invitation of invitations.docs) {
    const community =
      typeof invitation.community === 'object'
        ? invitation.community.id
        : invitation.community
    const membership = (
      await req.payload.find({
        collection: 'memberships',
        req,
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: {
          and: [
            { community: { equals: community } },
            { user: { equals: user.id } },
          ],
        },
      })
    ).docs[0]
    if (!membership) {
      await req.payload.create({
        collection: 'memberships',
        req,
        overrideAccess: true,
        data: {
          community,
          user: user.id,
          role: invitation.role,
          joinedAt: new Date().toISOString(),
        },
      })
    } else if (roleRank[invitation.role] > roleRank[membership.role]) {
      await req.payload.update({
        collection: 'memberships',
        id: membership.id,
        req,
        overrideAccess: true,
        data: { role: invitation.role },
      })
    }
    await req.payload.update({
      collection: 'community-invites',
      id: invitation.id,
      req,
      overrideAccess: true,
      context: { skipInvitationEmail: true },
      data: {
        active: false,
        acceptedAt: new Date().toISOString(),
        sendEmailNow: false,
      },
    })
  }
  return user
}

import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { communityPublicConfig } from '@/lib/publicConfig'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/tokens'

export const MAGIC_LINK_MINUTES = 15

function htmlEscape(value: unknown) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function sendCommunityMagicLinkEmail({
  payload,
  email,
  displayName,
  invitation = false,
  userID,
}: {
  payload: Payload
  email: string
  displayName?: string | null
  invitation?: boolean
  userID?: number | string
}) {
  let user = userID
    ? await payload.findByID({
        collection: 'users',
        id: userID,
        depth: 0,
        overrideAccess: true,
      })
    : (await payload.find({
        collection: 'users',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { email: { equals: email } },
      })).docs[0]

  if (!user) {
    user = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email,
        displayName: displayName || email.split('@')[0] || 'Reader',
        password: randomBytes(32).toString('base64url'),
        systemRole: 'member',
      },
    })
  }

  const token = createOpaqueToken()
  const expiresAt = new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000).toISOString()
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { magicLinkTokenHash: hashOpaqueToken(token), magicLinkExpiresAt: expiresAt },
  })

  const appUrl = (process.env.HERITAGE_APP_URL || 'https://heritage.faith').replace(/\/+$/, '')
  const link = `${appUrl}/#/community/callback?server=${encodeURIComponent(communityPublicConfig.publicUrl)}&token=${encodeURIComponent(token)}`
  const escapedLink = htmlEscape(link)
  const escapedName = htmlEscape(communityPublicConfig.name)
  const subject = invitation
    ? `You’re invited to ${communityPublicConfig.name}`
    : `Sign in to ${communityPublicConfig.name}`
  const introduction = invitation
    ? `${communityPublicConfig.name} invited you to join its Heritage Community.`
    : `Use this one-time link to sign in to ${communityPublicConfig.name}.`

  await payload.sendEmail({
    to: email,
    subject,
    text: `${introduction}\n\nUse this one-time link within ${MAGIC_LINK_MINUTES} minutes:\n\n${link}\n\nIf you did not expect this, you can ignore this email.`,
    html: `<p>${htmlEscape(introduction)}</p><p><a href="${escapedLink}">${invitation ? `Join ${escapedName}` : `Sign in to ${escapedName}`}</a></p><p>This link expires in ${MAGIC_LINK_MINUTES} minutes. If you did not expect this, you can ignore this email.</p>`,
  })

  return { expiresAt, link, user }
}

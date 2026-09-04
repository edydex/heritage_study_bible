import { createHmac, randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { communityPublicConfig } from '@/lib/publicConfig'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/tokens'

export const MAGIC_LINK_MINUTES = 15

type ChallengeDatabase = {
  execute: (query: unknown) => Promise<{ rows?: Array<Record<string, unknown>> }>
}

function challengeDatabase(payload: Payload) {
  const database = (payload.db as unknown as { drizzle?: ChallengeDatabase }).drizzle
  if (!database?.execute) throw new Error('Community authentication storage is unavailable.')
  return database
}

function trustedAppUrl() {
  const configured = (process.env.HERITAGE_APP_URL || 'https://heritage.faith').replace(/\/+$/, '')
  const url = new URL(configured)
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('HERITAGE_APP_URL must use HTTPS in production.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('HERITAGE_APP_URL is not a trusted application origin.')
  }
  return url.href.replace(/\/+$/, '')
}

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
  deviceId = 'legacy-community-device',
  deviceName = 'Heritage device',
  platform = 'unknown',
  purpose = 'sign-in',
  flow = 'community',
}: {
  payload: Payload
  email: string
  displayName?: string | null
  invitation?: boolean
  userID?: number | string
  deviceId?: string
  deviceName?: string
  platform?: string
  purpose?: 'sign-in' | 'reverify'
  flow?: 'community' | 'sync'
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
    try {
      user = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email,
          displayName: displayName || email.split('@')[0] || 'Reader',
          password: randomBytes(32).toString('base64url'),
          systemRole: 'member',
          accountProtection: 'email',
          syncGeneration: 1,
        },
      })
    } catch {
      // Two sign-in requests for a previously unseen address may race on the
      // auth collection's unique email constraint. Reuse the winner; do not
      // disclose the collision or create a second identity.
      user = (await payload.find({
        collection: 'users',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { email: { equals: email } },
      })).docs[0]
      if (!user) throw new Error('Community authentication storage is unavailable.')
    }
  }

  const token = createOpaqueToken()
  const expiresAt = new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000).toISOString()
  const now = new Date().toISOString()
  const emailHash = createHmac('sha256', payload.secret)
    .update(String(user.email || email).trim().toLowerCase())
    .digest('hex')
  const tokenHash = hashOpaqueToken(token)
  const lockKey = `community-auth-challenge:${user.id}:${purpose}:${deviceId}`
  const database = challengeDatabase(payload)

  // Superseding an earlier link and inserting its replacement are one SQL
  // statement, protected by a transaction-scoped advisory lock. A resend on
  // another server process therefore cannot leave two usable links or a gap
  // with no usable link.
  const created = await database.execute(sql`
    WITH "challenge_lock" AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtext(${lockKey})) AS "held"
    ),
    "superseded" AS (
      UPDATE "community_auth_challenges"
         SET "superseded_at" = ${now}, "updated_at" = ${now}
        FROM "challenge_lock"
       WHERE "user_id" = ${Number(user.id)}
         AND "purpose" = CAST(${purpose} AS "enum_community_auth_challenges_purpose")
         AND "device_id" = ${deviceId}
         AND "consumed_at" IS NULL
         AND "superseded_at" IS NULL
      RETURNING "community_auth_challenges"."id"
    )
    INSERT INTO "community_auth_challenges" (
      "user_id", "email_hash", "token_hash", "purpose", "flow",
      "device_id", "device_name", "platform", "requires_password",
      "expires_at", "failed_attempts", "updated_at", "created_at"
    )
    SELECT
      ${Number(user.id)}, ${emailHash}, ${tokenHash},
      CAST(${purpose} AS "enum_community_auth_challenges_purpose"),
      CAST(${flow} AS "enum_community_auth_challenges_flow"),
      ${deviceId}, ${deviceName}, ${platform},
      ${user.accountProtection === 'strict-password'}, ${expiresAt}, 0, ${now}, ${now}
    FROM "challenge_lock"
    RETURNING "id"
  `)
  const challengeId = Number(created.rows?.[0]?.id)
  if (!Number.isSafeInteger(challengeId) || challengeId < 1) {
    throw new Error('Community authentication storage is unavailable.')
  }

  const appUrl = trustedAppUrl()
  const link = `${appUrl}/#/community/callback?server=${encodeURIComponent(communityPublicConfig.publicUrl)}&token=${encodeURIComponent(token)}&flow=${flow}&purpose=${purpose}`
  const escapedLink = htmlEscape(link)
  const escapedName = htmlEscape(communityPublicConfig.name)
  const subject = invitation
    ? `You’re invited to ${communityPublicConfig.name}`
    : `Sign in to ${communityPublicConfig.name}`
  const introduction = invitation
    ? `${communityPublicConfig.name} invited you to join its Heritage Community.`
    : `Use this one-time link to sign in to ${communityPublicConfig.name}.`

  try {
    await payload.sendEmail({
      to: email,
      subject,
      text: `${introduction}\n\nUse this one-time link within ${MAGIC_LINK_MINUTES} minutes:\n\n${link}\n\nIf you did not expect this, you can ignore this email.`,
      html: `<p>${htmlEscape(introduction)}</p><p><a href="${escapedLink}">${invitation ? `Join ${escapedName}` : `Sign in to ${escapedName}`}</a></p><p>This link expires in ${MAGIC_LINK_MINUTES} minutes. If you did not expect this, you can ignore this email.</p>`,
    })
  } catch {
    // Never leave a usable token behind when SMTP rejected the message. The
    // public request endpoint deliberately hides this distinction to avoid
    // turning mail health into an address-enumeration oracle.
    try {
      await database.execute(sql`
        UPDATE "community_auth_challenges"
           SET "superseded_at" = now(), "updated_at" = now()
         WHERE "id" = ${challengeId}
           AND "consumed_at" IS NULL
      `)
    } catch {
      payload.logger.warn('A failed Heritage sign-in email challenge could not be invalidated.')
    }
    throw new Error('The sign-in email could not be accepted by the mail service.')
  }

  return { expiresAt, link, user }
}

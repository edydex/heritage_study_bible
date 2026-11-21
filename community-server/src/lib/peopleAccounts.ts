import { sql, type SQL } from 'drizzle-orm'
import type { CollectionAfterChangeHook } from 'payload'
import { personFullName, relationId, splitDisplayName } from './peopleProfiles'
import { transactionDatabase } from './syncDatabase'

type Database = { execute: (query: SQL) => PromiseLike<{ rows?: Array<Record<string, unknown>> }> }

/**
 * Every church member has a directory profile. A profile an administrator
 * already made with the same email address is linked instead of duplicated.
 * Runs inside the caller's transaction; the unique (church, account) index
 * makes a repeated call harmless.
 */
export async function ensurePersonForAccount(db: Database, communityId: number, userId: number) {
  const account = (await db.execute(sql`SELECT email, display_name FROM users WHERE id = ${userId}`)).rows?.[0]
  if (!account) return null
  const email = String(account.email || '').trim().toLowerCase()
  const existing = (await db.execute(sql`
    SELECT id FROM people WHERE community_id = ${communityId} AND user_id = ${userId} LIMIT 1
  `)).rows?.[0]
  if (existing) return Number(existing.id)
  if (email) {
    const linked = (await db.execute(sql`
      UPDATE people SET user_id = ${userId}, updated_at = now()
      WHERE id = (
        SELECT id FROM people
        WHERE community_id = ${communityId} AND user_id IS NULL AND lower(email) = ${email}
        ORDER BY id LIMIT 1
      )
      RETURNING id
    `)).rows?.[0]
    if (linked) return Number(linked.id)
  }
  const { firstName, lastName } = splitDisplayName(account.display_name, email)
  const created = (await db.execute(sql`
    INSERT INTO people (community_id, user_id, first_name, last_name, full_name, email, status)
    VALUES (${communityId}, ${userId}, ${firstName}, ${lastName}, ${personFullName({ firstName, lastName })}, ${email || null}, 'member')
    ON CONFLICT (community_id, user_id) DO NOTHING
    RETURNING id
  `)).rows?.[0]
  return created ? Number(created.id) : null
}

/** Profiles for everyone who already belonged to a church before the directory existed. */
export async function backfillPeopleFromMemberships(db: Database) {
  const memberships = (await db.execute(sql`SELECT community_id, user_id FROM memberships WHERE user_id IS NOT NULL ORDER BY id`)).rows ?? []
  for (const membership of memberships) {
    await ensurePersonForAccount(db, Number(membership.community_id), Number(membership.user_id))
  }
  return memberships.length
}

export const createProfileForNewMember: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  // Minimal configurations (for example focused tests) may run without the directory.
  if (operation !== 'create' || !req.payload.collections?.people) return doc
  const communityId = relationId(doc.community)
  const userId = relationId(doc.user)
  if (communityId && userId) await ensurePersonForAccount(transactionDatabase(req), communityId, userId)
  return doc
}

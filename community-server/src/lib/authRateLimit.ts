import { createHmac } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

function bucketHash(payload: Payload, key: string) {
  return createHmac('sha256', payload.secret).update(`community-auth-rate:v1:${key}`).digest('hex')
}

export async function consumePersistentRateLimit({
  payload,
  key,
  maximum,
  windowMs,
}: {
  payload: Payload
  key: string
  maximum: number
  windowMs: number
}) {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error('The sign-in rate limit is invalid.')
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error('The sign-in rate limit window is invalid.')
  const hash = bucketHash(payload, key)
  const database = (payload.db as unknown as {
    drizzle?: { execute: (query: unknown) => Promise<{ rows?: Array<Record<string, unknown>> }> }
  }).drizzle
  if (!database?.execute) throw new Error('Could not enforce the sign-in rate limit.')

  // A single PostgreSQL UPSERT is the lock. Unlike an in-memory mutex or a
  // find-then-update sequence, this remains correct when several Next.js
  // workers (or two server processes during a rolling update) receive the
  // same bucket concurrently.
  const result = await database.execute(sql`
    INSERT INTO "community_auth_rate_limits"
      ("bucket_hash", "attempts", "reset_at", "updated_at", "created_at")
    VALUES
      (${hash}, 1, now() + (${windowMs} * interval '1 millisecond'), now(), now())
    ON CONFLICT ("bucket_hash") DO UPDATE SET
      "attempts" = CASE
        WHEN "community_auth_rate_limits"."reset_at" <= now() THEN 1
        ELSE "community_auth_rate_limits"."attempts" + 1
      END,
      "reset_at" = CASE
        WHEN "community_auth_rate_limits"."reset_at" <= now()
          THEN now() + (${windowMs} * interval '1 millisecond')
        ELSE "community_auth_rate_limits"."reset_at"
      END,
      "updated_at" = now()
    RETURNING "attempts", "reset_at"
  `)
  const row = result.rows?.[0]
  const attempts = Number(row?.attempts)
  const resetAt = Date.parse(String(row?.reset_at ?? row?.resetAt ?? ''))
  if (!Number.isFinite(attempts) || !Number.isFinite(resetAt)) {
    throw new Error('Could not enforce the sign-in rate limit.')
  }
  const allowed = attempts <= maximum
  return {
    allowed,
    retryAfter: allowed ? 0 : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  }
}

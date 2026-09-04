import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { authEndpoints, challengeIsUsable, normalizeEmail } from '../src/endpoints/auth.ts'
import { consumePersistentRateLimit } from '../src/lib/authRateLimit.ts'
import { recordAccountSecurityEvent } from '../src/lib/accountSecurityNotification.ts'
import { sendCommunityMagicLinkEmail } from '../src/lib/communityMagicLinkEmail.ts'
import { currentCommunitySession, markCommunitySessionUser } from '../src/lib/communitySession.ts'
import {
  hashStrictPassword,
  validateStrictPassword,
  verifyStrictPassword,
} from '../src/lib/strictPassword.ts'
import { createOpaqueToken, hashOpaqueToken, tokenHashesMatch } from '../src/lib/tokens.ts'

type AnyRecord = Record<string, any>

function queryParts(query: AnyRecord) {
  let text = ''
  const parameters: unknown[] = []
  for (const chunk of query?.queryChunks || []) {
    if (chunk && typeof chunk === 'object' && Array.isArray(chunk.value)) {
      text += chunk.value.join('')
    } else {
      text += '?'
      parameters.push(chunk)
    }
  }
  return { text, parameters }
}

test('opaque tokens are high entropy, stored as hashes, and reject tampering', () => {
  const token = createOpaqueToken()
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  const tokenHash = hashOpaqueToken(token)
  assert.match(tokenHash, /^[0-9a-f]{64}$/)
  assert.notEqual(tokenHash, token)
  assert.equal(tokenHashesMatch(token, tokenHash), true)
  assert.equal(tokenHashesMatch(`${token.slice(0, -1)}x`, tokenHash), false)
  assert.equal(tokenHashesMatch(token, 'not-a-valid-hash'), false)
})

test('challenge state rejects replay, expiry, and superseded resend links', () => {
  const fresh = { expiresAt: new Date(Date.now() + 60_000).toISOString() }
  assert.equal(challengeIsUsable(fresh), true)
  assert.equal(challengeIsUsable({ ...fresh, consumedAt: new Date().toISOString() }), false)
  assert.equal(challengeIsUsable({ ...fresh, supersededAt: new Date().toISOString() }), false)
  assert.equal(challengeIsUsable({ expiresAt: new Date(Date.now() - 1).toISOString() }), false)
  assert.equal(challengeIsUsable({ expiresAt: 'not-a-date' }), false)
  assert.equal(challengeIsUsable(null), false)
})

test('strict passwords use Argon2id and preserve exact user input', async () => {
  assert.equal(validateStrictPassword('short'), 'Use at least 12 characters.')
  const password = '  exact spaces and unicode π  '
  const result = await hashStrictPassword(password)
  assert.equal(result.algorithm, 'argon2id')
  assert.match(result.encoded, /^\$argon2id\$/)
  assert.equal(await verifyStrictPassword(result.encoded, password), true)
  assert.equal(await verifyStrictPassword(result.encoded, password.trim()), false)
  assert.equal(await verifyStrictPassword(result.encoded, `${password}!`), false)
  assert.equal(await verifyStrictPassword('damaged hash', password), false)
})

test('email normalization is bounded and canonical', () => {
  assert.equal(normalizeEmail('  Reader@Example.COM '), 'reader@example.com')
  assert.equal(normalizeEmail('reader at example.com'), '')
  assert.equal(normalizeEmail(`${'a'.repeat(310)}@example.com`), '')
})

test('persistent rate limiting is one atomic PostgreSQL upsert', async () => {
  const queries: AnyRecord[] = []
  const resetAt = new Date(Date.now() + 60_000).toISOString()
  const payload = {
    secret: 'rate-limit-test-secret',
    db: {
      drizzle: {
        execute: async (query: AnyRecord) => {
          queries.push(query)
          return { rows: [{ attempts: 6, reset_at: resetAt }] }
        },
      },
    },
  }
  const outcome = await consumePersistentRateLimit({
    payload: payload as never,
    key: 'magic-link:email:reader@example.test',
    maximum: 5,
    windowMs: 60_000,
  })
  assert.equal(outcome.allowed, false)
  assert.ok(outcome.retryAfter > 0)
  assert.equal(queries.length, 1)
  const query = queryParts(queries[0])
  assert.match(query.text, /INSERT INTO "community_auth_rate_limits"/)
  assert.match(query.text, /ON CONFLICT \("bucket_hash"\) DO UPDATE/)
  assert.match(query.text, /RETURNING "attempts", "reset_at"/)
  assert.equal(query.parameters.some(value => String(value).includes('reader@example.test')), false)
})

test('magic links persist only the hash and atomically supersede a resend', async () => {
  const queries: AnyRecord[] = []
  let deliveredText = ''
  const payload = {
    secret: 'magic-link-test-secret',
    db: {
      drizzle: {
        execute: async (query: AnyRecord) => {
          queries.push(query)
          return { rows: [{ id: 91 }] }
        },
      },
    },
    findByID: async () => ({
      id: 7,
      email: 'reader@example.test',
      displayName: 'Reader',
      accountProtection: 'email',
    }),
    find: async () => ({ docs: [] }),
    create: async () => { throw new Error('existing user should not be created') },
    sendEmail: async ({ text }: { text: string }) => { deliveredText = text },
    logger: { warn: () => undefined },
  }

  await sendCommunityMagicLinkEmail({
    payload: payload as never,
    userID: 7,
    email: 'reader@example.test',
    deviceId: 'device-12345678',
    deviceName: 'Reader phone',
    platform: 'android',
    flow: 'sync',
  })
  assert.equal(queries.length, 1)
  const challengeQuery = queryParts(queries[0])
  assert.match(challengeQuery.text, /pg_advisory_xact_lock/)
  assert.match(challengeQuery.text, /UPDATE "community_auth_challenges"/)
  assert.match(challengeQuery.text, /INSERT INTO "community_auth_challenges"/)
  const deliveredToken = decodeURIComponent(deliveredText.match(/[?&]token=([^&\s]+)/)?.[1] || '')
  assert.ok(deliveredToken)
  assert.equal(challengeQuery.parameters.includes(deliveredToken), false)
  assert.equal(challengeQuery.parameters.includes(hashOpaqueToken(deliveredToken)), true)
})

test('an SMTP failure invalidates its newly-created challenge', async () => {
  const queries: AnyRecord[] = []
  const payload = {
    secret: 'mail-failure-test-secret',
    db: {
      drizzle: {
        execute: async (query: AnyRecord) => {
          queries.push(query)
          return queries.length === 1 ? { rows: [{ id: 12 }] } : { rows: [{ id: 12 }] }
        },
      },
    },
    findByID: async () => ({ id: 7, email: 'reader@example.test', accountProtection: 'email' }),
    find: async () => ({ docs: [] }),
    create: async () => { throw new Error('existing user should not be created') },
    sendEmail: async () => { throw new Error('SMTP detail that must not escape') },
    logger: { warn: () => undefined },
  }
  await assert.rejects(
    sendCommunityMagicLinkEmail({ payload: payload as never, userID: 7, email: 'reader@example.test' }),
    /mail service/,
  )
  assert.equal(queries.length, 2)
  assert.match(queryParts(queries[1]).text, /SET "superseded_at" = now\(\)/)
})

test('security notification failures never reverse an already committed transition', async () => {
  const warnings: string[] = []
  await assert.doesNotReject(recordAccountSecurityEvent({
    payload: {
      create: async () => { throw new Error('database detail') },
      sendEmail: async () => { throw new Error('smtp detail') },
      logger: { warn: (message: string) => warnings.push(message) },
    } as never,
    userId: 9,
    email: 'reader@example.test',
    eventType: 'device-connected',
    deviceId: 'device-safe',
    deviceName: 'Reader phone',
  }))
  assert.deepEqual(warnings, [
    'A Heritage account security event could not be recorded.',
    'A Heritage account security notification email could not be delivered.',
  ])
})

test('session exchange locks and consumes the challenge inside the request transaction', () => {
  const source = readFileSync(new URL('../src/endpoints/auth.ts', import.meta.url), 'utf8')
  assert.match(source, /req\.transactionID = transactionId/)
  assert.match(source, /FROM "community_auth_challenges"[\s\S]*FOR UPDATE/)
  assert.match(source, /"consumed_at" IS NULL[\s\S]*"superseded_at" IS NULL[\s\S]*"expires_at" > now\(\)/)
  const commit = source.indexOf('await adapter.commitTransaction(transactionId)')
  const notification = source.lastIndexOf('await recordAccountSecurityEvent')
  assert.ok(commit >= 0 && notification > commit)
  assert.match(source, /`reverify:address:\$\{address\}`/)
  assert.match(source, /`reverify:user:\$\{userId\}`/)
})

test('reverification rejects tampered and expired links, then rejects a replay after commit', async () => {
  const magicToken = createOpaqueToken()
  const sessionToken = createOpaqueToken()
  const state: AnyRecord = {
    challenge: {
      id: 71,
      user: 7,
      purpose: 'reverify',
      flow: 'sync',
      deviceId: 'device-12345678',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      consumedAt: null,
      supersededAt: null,
    },
    session: {
      id: 81,
      user: 7,
      deviceId: 'device-12345678',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revokedAt: null,
    },
    pendingConsumed: false,
    pendingSession: null,
    commits: 0,
    rollbacks: 0,
  }
  const sessions: AnyRecord = {}
  let transactionId = 0
  const payload: AnyRecord = {
    secret: 'auth-endpoint-test-secret',
    config: { cors: '*' },
    logger: { warn: () => undefined },
    db: {
      sessions,
      drizzle: {
        execute: async () => ({
          rows: [{ attempts: 1, reset_at: new Date(Date.now() + 60_000).toISOString() }],
        }),
      },
      beginTransaction: async () => {
        transactionId += 1
        state.pendingConsumed = false
        state.pendingSession = null
        sessions[String(transactionId)] = {
          db: {
            execute: async (query: AnyRecord) => {
              const { text, parameters } = queryParts(query)
              if (text.includes('FROM "community_auth_challenges"')) {
                return parameters[0] === hashOpaqueToken(magicToken)
                  ? { rows: [{ id: state.challenge.id }] }
                  : { rows: [] }
              }
              if (text.includes('FROM "community_sessions"')) {
                return parameters[0] === hashOpaqueToken(sessionToken)
                  ? { rows: [{ id: state.session.id }] }
                  : { rows: [] }
              }
              if (text.includes('UPDATE "community_auth_challenges"')) {
                const usable = !state.challenge.consumedAt
                  && !state.challenge.supersededAt
                  && Date.parse(state.challenge.expiresAt) > Date.now()
                state.pendingConsumed = usable
                return { rows: usable ? [{ id: state.challenge.id }] : [] }
              }
              if (text.includes('pg_advisory_xact_lock')) return { rows: [] }
              throw new Error(`Unexpected auth SQL: ${text}`)
            },
          },
        }
        return transactionId
      },
      commitTransaction: async () => {
        if (state.pendingConsumed) state.challenge.consumedAt = new Date().toISOString()
        if (state.pendingSession) state.session = { ...state.session, ...state.pendingSession }
        state.commits += 1
      },
      rollbackTransaction: async () => { state.rollbacks += 1 },
    },
    findByID: async ({ collection }: { collection: string }) => {
      if (collection === 'community-auth-challenges') return { ...state.challenge }
      if (collection === 'community-sessions') return { ...state.session }
      if (collection === 'users') return { id: 7, email: 'reader@example.test', syncGeneration: 1 }
      throw new Error(`Unexpected findByID collection: ${collection}`)
    },
    update: async ({ collection, data }: { collection: string; data: AnyRecord }) => {
      if (collection !== 'community-sessions') throw new Error(`Unexpected update collection: ${collection}`)
      state.pendingSession = data
      return { ...state.session, ...data }
    },
  }
  const handler = authEndpoints.find(endpoint => (
    endpoint.path === '/community/auth/session' && endpoint.method === 'post'
  ))?.handler
  assert.ok(handler)
  const request = (token: string) => ({
    headers: new Headers({
      authorization: `Community ${sessionToken}`,
      'cf-connecting-ip': '203.0.113.40',
      'content-type': 'application/json',
    }),
    payload,
    user: { id: 7, email: 'reader@example.test' },
    json: async () => ({ token }),
    transactionID: undefined,
    url: 'http://localhost/api/community/auth/session',
  })

  const tampered = await handler(request(`${magicToken}x`) as never)
  assert.equal(tampered.status, 401)
  assert.equal(state.challenge.consumedAt, null)

  const originalExpiry = state.challenge.expiresAt
  state.challenge.expiresAt = new Date(Date.now() - 1).toISOString()
  const expired = await handler(request(magicToken) as never)
  assert.equal(expired.status, 401)
  assert.equal(state.challenge.consumedAt, null)

  state.challenge.expiresAt = originalExpiry
  const accepted = await handler(request(magicToken) as never)
  assert.equal(accepted.status, 200)
  assert.equal((await accepted.json()).reverified, true)
  assert.ok(state.challenge.consumedAt)

  const replay = await handler(request(magicToken) as never)
  assert.equal(replay.status, 401)
  assert.equal(state.commits, 4)
  assert.equal(state.rollbacks, 0)
})

test('expired and revoked device sessions are rejected by the shared session boundary', async () => {
  const token = createOpaqueToken()
  const seenWhere: AnyRecord[] = []
  const seenRequests: unknown[] = []
  const storedSession: AnyRecord = {
    id: 1,
    tokenHash: hashOpaqueToken(token),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    revokedAt: null,
  }
  const request = {
    headers: new Headers({ authorization: `Community ${token}` }),
    payload: {
      find: async ({ where, req }: AnyRecord) => {
        seenWhere.push(where)
        seenRequests.push(req)
        const clauses = where.and as AnyRecord[]
        const tokenClause = clauses.find(clause => clause.tokenHash)?.tokenHash?.equals
        const expiry = clauses.find(clause => clause.expiresAt)?.expiresAt?.greater_than
        const rejectsRevoked = clauses.some(clause => clause.revokedAt?.exists === false)
        return {
          docs: tokenClause === storedSession.tokenHash
            && Date.parse(storedSession.expiresAt) > Date.parse(expiry)
            && rejectsRevoked
            && !storedSession.revokedAt
            ? [storedSession]
            : [],
        }
      },
    },
  }
  assert.equal((await currentCommunitySession(request as never))?.id, 1)
  storedSession.expiresAt = new Date(Date.now() - 60_000).toISOString()
  assert.equal(await currentCommunitySession(request as never), null)
  storedSession.expiresAt = new Date(Date.now() + 60_000).toISOString()
  storedSession.revokedAt = new Date().toISOString()
  assert.equal(await currentCommunitySession(request as never), null)
  assert.equal(seenWhere.length, 3)
  assert.equal(JSON.stringify(seenWhere[0]).includes(token), false)
  assert.equal(JSON.stringify(seenWhere[0]).includes(hashOpaqueToken(token)), true)
  assert.deepEqual(seenRequests, [undefined, undefined, undefined], 'session lookup must not inherit authenticated request state')
})

test('custom endpoints reuse only the private session identity set by Community authentication', async () => {
  const session: AnyRecord = {
    id: 17,
    user: 41,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    revokedAt: null,
  }
  const user = markCommunitySessionUser({ id: 41, collection: 'users' }, session.id)
  assert.deepEqual(JSON.parse(JSON.stringify(user)), { id: 41, collection: 'users' })
  const request = {
    headers: new Headers(),
    user,
    payload: {
      findByID: async ({ id }: AnyRecord) => id === session.id ? session : null,
      find: async () => { throw new Error('marked authentication must not fall back to bearer lookup') },
    },
  }
  assert.equal((await currentCommunitySession(request as never))?.id, session.id)
  session.user = 42
  assert.equal(await currentCommunitySession(request as never), null)
  session.user = 41
  session.revokedAt = new Date().toISOString()
  assert.equal(await currentCommunitySession(request as never), null)
  session.revokedAt = null
  session.expiresAt = new Date(Date.now() - 1).toISOString()
  assert.equal(await currentCommunitySession(request as never), null)
})

test('Strict protection requires the password after email verification and consumes the link only on success', async () => {
  const magicToken = createOpaqueToken()
  const password = 'correct horse battery staple π'
  const protectedPassword = await hashStrictPassword(password)
  const challenge: AnyRecord = {
    id: 91,
    user: 7,
    purpose: 'sign-in',
    flow: 'sync',
    deviceId: 'device-12345678',
    deviceName: 'Second phone',
    platform: 'android',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    consumedAt: null,
    supersededAt: null,
    failedAttempts: 0,
  }
  const transactionSessions: AnyRecord = {}
  let nextTransaction = 0
  let pendingConsumed = false
  const created: AnyRecord[] = []
  const payload: AnyRecord = {
    secret: 'strict-endpoint-test-secret',
    config: { cors: '*' },
    logger: { warn: () => undefined },
    db: {
      sessions: transactionSessions,
      drizzle: {
        execute: async () => ({ rows: [{ attempts: 1, reset_at: new Date(Date.now() + 60_000).toISOString() }] }),
      },
      beginTransaction: async () => {
        nextTransaction += 1
        pendingConsumed = false
        transactionSessions[String(nextTransaction)] = {
          db: {
            execute: async (query: AnyRecord) => {
              const { text, parameters } = queryParts(query)
              if (text.includes('FROM "community_auth_challenges"')) {
                return !challenge.consumedAt && parameters[0] === hashOpaqueToken(magicToken)
                  ? { rows: [{ id: challenge.id }] }
                  : { rows: [] }
              }
              if (text.includes('UPDATE "community_auth_challenges"')) {
                pendingConsumed = !challenge.consumedAt
                return { rows: pendingConsumed ? [{ id: challenge.id }] : [] }
              }
              if (text.includes('pg_advisory_xact_lock')) return { rows: [] }
              throw new Error(`Unexpected strict-auth SQL: ${text}`)
            },
          },
        }
        return nextTransaction
      },
      commitTransaction: async () => {
        if (pendingConsumed) challenge.consumedAt = new Date().toISOString()
      },
      rollbackTransaction: async () => undefined,
    },
    findByID: async ({ collection }: AnyRecord) => {
      if (collection === 'community-auth-challenges') return { ...challenge }
      if (collection === 'users') return {
        id: 7,
        email: 'reader@example.test',
        displayName: 'Reader',
        accountProtection: 'strict-password',
        strictPasswordHash: protectedPassword.encoded,
        syncGeneration: 1,
      }
      throw new Error(`Unexpected strict-auth findByID: ${collection}`)
    },
    find: async ({ collection }: AnyRecord) => {
      if (collection === 'communities') return { docs: [{ id: 3, joinPolicy: 'restricted' }] }
      if (collection === 'sync-devices' || collection === 'memberships' || collection === 'community-invites') return { docs: [] }
      throw new Error(`Unexpected strict-auth find: ${collection}`)
    },
    create: async (input: AnyRecord) => {
      created.push(input)
      if (input.collection === 'sync-devices') return { id: 4, ...input.data }
      if (input.collection === 'community-sessions') return { id: 5, ...input.data }
      if (input.collection === 'sync-account-events') return { id: 6, ...input.data }
      throw new Error(`Unexpected strict-auth create: ${input.collection}`)
    },
    update: async ({ collection, data }: AnyRecord) => {
      if (collection === 'community-auth-challenges') {
        challenge.failedAttempts = data.failedAttempts
        return { ...challenge }
      }
      throw new Error(`Unexpected strict-auth update: ${collection}`)
    },
    sendEmail: async () => undefined,
  }
  const handler = authEndpoints.find(endpoint => endpoint.path === '/community/auth/session')?.handler
  assert.ok(handler)
  const request = (body: AnyRecord) => ({
    headers: new Headers({ 'cf-connecting-ip': '203.0.113.41', 'content-type': 'application/json' }),
    payload,
    json: async () => ({ token: magicToken, ...body }),
    transactionID: undefined,
    url: 'http://localhost/api/community/auth/session',
  })

  const emailOnly = await handler(request({}) as never)
  assert.equal(emailOnly.status, 428)
  assert.deepEqual(await emailOnly.json(), { passwordRequired: true })
  assert.equal(challenge.consumedAt, null)

  const wrong = await handler(request({ password: `${password}!` }) as never)
  assert.equal(wrong.status, 401)
  assert.equal(challenge.consumedAt, null)

  const accepted = await handler(request({ password }) as never)
  assert.equal(accepted.status, 200)
  assert.ok((await accepted.json()).token)
  assert.ok(challenge.consumedAt)
  assert.equal(created.some(input => input.collection === 'community-sessions'), true)

  const replay = await handler(request({ password }) as never)
  assert.equal(replay.status, 401)
})

test('no logged-out Strict-password reset or recovery endpoint is registered', () => {
  assert.equal(authEndpoints.some(endpoint => /password|reset|recover/i.test(endpoint.path)), false)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import { preserveManagerRevocation } from '../src/collections/SyncShowConnections.ts'
import { pkceChallengeForVerifier } from '../src/lib/syncShowProtocol.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'

type StoredConnection = {
  id: number
  tokenHash: string
  scopes: string[]
  expiresAt: string
  revokedAt?: string | null
}

test('device approval accepts same-origin browser form posts when Firefox omits origin headers', async () => {
  const approvalHandler = syncShowEndpoints.find(endpoint => (
    endpoint.path.endsWith('/auth/device/approve') && endpoint.method === 'post'
  ))?.handler
  assert.ok(approvalHandler)

  const request = (headers: HeadersInit) => ({
    headers: new Headers(headers),
    payload: {
      auth: async () => ({ user: null }),
    },
    url: 'http://localhost:3000/api/community/syncshow/v1/auth/device/approve',
  })

  const sameOriginReferer = await approvalHandler(request({
    referer: 'http://localhost:3000/api/community/syncshow/v1/auth/device/approve?user_code=ABCD-2345',
  }) as never)
  assert.equal(sameOriginReferer.status, 401)
  assert.match(await sameOriginReferer.text(), /Sign in required/)

  const sameOriginHeader = await approvalHandler(request({
    origin: 'http://localhost:3000',
  }) as never)
  assert.equal(sameOriginHeader.status, 401)

  const sameOriginFetchMetadata = await approvalHandler(request({
    'sec-fetch-site': 'same-origin',
  }) as never)
  assert.equal(sameOriginFetchMetadata.status, 401)

  const opaqueOriginWithSameOriginFetchMetadata = await approvalHandler(request({
    origin: 'null',
    'sec-fetch-site': 'same-origin',
  }) as never)
  assert.equal(opaqueOriginWithSameOriginFetchMetadata.status, 401)

  const rejectedHeaders: HeadersInit[] = [
    {},
    { referer: 'https://attacker.example/submit' },
    {
      origin: 'https://attacker.example',
      referer: 'http://localhost:3000/api/community/syncshow/v1/auth/device/approve',
      'sec-fetch-site': 'same-origin',
    },
    { 'sec-fetch-site': 'cross-site' },
  ]
  for (const headers of rejectedHeaders) {
    const rejected = await approvalHandler(request(headers) as never)
    assert.equal(rejected.status, 403)
    assert.match(await rejected.text(), /submitted from this Community server/)
  }
})

test('community managers cannot clear or rewrite an existing SyncShow revocation', () => {
  const revokedAt = '2026-07-25T23:00:00.000Z'
  assert.deepEqual(
    preserveManagerRevocation(
      { clientName: 'Renamed', revokedAt: null },
      { revokedAt },
      'member',
    ),
    { clientName: 'Renamed', revokedAt },
  )
  assert.deepEqual(
    preserveManagerRevocation(
      { revokedAt: '2026-07-26T00:00:00.000Z' },
      { revokedAt },
      'leader',
    ),
    { revokedAt },
  )
  assert.deepEqual(
    preserveManagerRevocation(
      { revokedAt: null },
      { revokedAt },
      'system-admin',
    ),
    { revokedAt: null },
  )
  assert.deepEqual(
    preserveManagerRevocation(
      { revokedAt },
      {},
      'leader',
    ),
    { revokedAt },
  )
})

test('a lost token response is recovered after grant expiry without minting a second connection', async () => {
  const verifier = 'v'.repeat(43)
  const deviceSecret = 'device-secret-that-is-long-enough'
  const state: {
    grant: Record<string, unknown>
    connection: StoredConnection | null
    pendingConnection: StoredConnection | null
    pendingGrantUpdate: Record<string, unknown> | null
    transactionCalls: number
    creates: number
    commits: number
    rollbacks: number
  } = {
    grant: {
      id: 41,
      community: 7,
      approvedBy: 9,
      requestedEmail: 'manager@example.test',
      clientName: 'Sanctuary Mac',
      deviceId: 'device-41',
      deviceSecretHash: hashOpaqueToken(deviceSecret),
      codeChallenge: pkceChallengeForVerifier(verifier),
      scopes: ['syncshow:songs:read', 'syncshow:songs:write'],
      status: 'approved',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    connection: null,
    pendingConnection: null,
    pendingGrantUpdate: null,
    transactionCalls: 0,
    creates: 0,
    commits: 0,
    rollbacks: 0,
  }

  const sessions: Record<string, {
    db: { execute: (_query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> }
  }> = {}
  let transactionSequence = 0
  const payload = {
    secret: 'test-payload-secret',
    config: { cors: '*' },
    logger: {
      error: () => undefined,
      warn: () => undefined,
    },
    db: {
      sessions,
      beginTransaction: async () => {
        transactionSequence += 1
        state.transactionCalls = 0
        state.pendingConnection = null
        state.pendingGrantUpdate = null
        sessions[String(transactionSequence)] = {
          db: {
            execute: async () => {
              state.transactionCalls += 1
              if (state.transactionCalls === 1) {
                return {
                  rows: [{
                    status: state.grant.status,
                    expiresAt: state.grant.expiresAt,
                    consumedAt: state.grant.consumedAt,
                  }],
                }
              }
              return { rows: state.connection ? [{ ...state.connection }] : [] }
            },
          },
        }
        return transactionSequence
      },
      commitTransaction: async () => {
        if (state.pendingConnection) state.connection = state.pendingConnection
        if (state.pendingGrantUpdate) state.grant = { ...state.grant, ...state.pendingGrantUpdate }
        state.commits += 1
      },
      rollbackTransaction: async () => {
        state.pendingConnection = null
        state.pendingGrantUpdate = null
        state.rollbacks += 1
      },
    },
    find: async ({ collection }: { collection: string }) => {
      if (collection === 'syncshow-device-grants') return { docs: [{ ...state.grant }] }
      if (collection === 'memberships') {
        return { docs: [{ id: 1, community: 7, user: 9, role: 'leader' }] }
      }
      return { docs: [] }
    },
    findByID: async () => ({
      id: 9,
      email: 'manager@example.test',
      displayName: 'Manager',
    }),
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      assert.equal(collection, 'syncshow-connections')
      state.creates += 1
      state.pendingConnection = {
        id: 77,
        tokenHash: String(data.tokenHash),
        scopes: data.scopes as string[],
        expiresAt: String(data.expiresAt),
        revokedAt: null,
      }
      return state.pendingConnection
    },
    update: async ({
      collection,
      data,
    }: {
      collection: string
      data: Record<string, unknown>
    }) => {
      if (collection === 'syncshow-device-grants') {
        state.pendingGrantUpdate = { ...data }
      } else if (collection === 'syncshow-connections' && state.connection) {
        state.pendingConnection = { ...state.connection, ...data }
      }
      return data
    },
  }

  const request = (body: Record<string, unknown>, suffix: string) => ({
    headers: new Headers({
      'cf-connecting-ip': `test-${suffix}`,
      'content-type': 'application/json',
    }),
    payload,
    text: async () => JSON.stringify(body),
    transactionID: undefined,
    url: `http://localhost/api/community/syncshow/v1/auth/device/${suffix}`,
  })
  const tokenHandler = syncShowEndpoints.find(endpoint => (
    endpoint.path.endsWith('/auth/device/token') && endpoint.method === 'post'
  ))?.handler
  const statusHandler = syncShowEndpoints.find(endpoint => (
    endpoint.path.endsWith('/auth/device/status') && endpoint.method === 'post'
  ))?.handler
  assert.ok(tokenHandler)
  assert.ok(statusHandler)

  const exchangeBody = {
    deviceId: state.grant.deviceId,
    deviceSecret,
    codeVerifier: verifier,
  }
  const lostResponse = await tokenHandler(request(exchangeBody, 'token-first') as never)
  assert.equal(lostResponse.status, 200)
  assert.equal(state.grant.status, 'consumed')
  assert.equal(state.creates, 1)
  assert.ok(state.connection)

  // The original grant lifetime passes after the server committed but before
  // the client received the HTTP body.
  state.grant.expiresAt = new Date(Date.now() - 1_000).toISOString()
  const statusResponse = await statusHandler(request({
    deviceId: state.grant.deviceId,
    deviceSecret,
  }, 'status-retry') as never)
  assert.equal(statusResponse.status, 200)
  assert.equal((await statusResponse.json()).status, 'consumed')

  const retryResponse = await tokenHandler(request(exchangeBody, 'token-retry') as never)
  assert.equal(retryResponse.status, 200)
  const firstPayload = await lostResponse.json()
  const retryPayload = await retryResponse.json()
  assert.equal(retryPayload.accessToken, firstPayload.accessToken)
  assert.equal(retryPayload.expiresAt, firstPayload.expiresAt)
  assert.equal(retryPayload.refreshToken, null)
  assert.equal(state.creates, 1)
  assert.equal(state.commits, 2)
  assert.equal(state.rollbacks, 0)
})

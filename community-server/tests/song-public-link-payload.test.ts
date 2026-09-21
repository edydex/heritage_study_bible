import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config.ts'
import { songPublicLinkEndpoints } from '../src/endpoints/songPublicLinks.ts'
import {
  songPublicLinkFamilyRevision,
  songPublicLinkReviewRevision,
  type SongPublicDocumentInput,
} from '../src/lib/syncshow/SongPublicLink.ts'
import {
  SYNCSHOW_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE,
} from '../src/lib/syncShowProtocol.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'
import {
  GET as getSharedSong,
} from '../src/app/community/songs/shared/[linkId]/route.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'

type AnyRecord = Record<string, any>

const liveDatabaseUrl = process.env.SONG_PUBLIC_LINK_LIVE_DATABASE_URL
const scopes = [
  SYNCSHOW_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE,
]

function endpoint(path: string, method: 'get' | 'post' | 'delete') {
  const handler = songPublicLinkEndpoints.find(candidate => (
    candidate.path === path && candidate.method === method
  ))?.handler
  assert.ok(handler, `missing ${method.toUpperCase()} ${path}`)
  return handler
}

const listLinks = endpoint(
  '/community/syncshow/v1/song-public-links',
  'get',
)
const createLink = endpoint(
  '/community/syncshow/v1/song-public-links',
  'post',
)
const revokeLink = endpoint(
  '/community/syncshow/v1/song-public-links/:linkId',
  'delete',
)

function request(
  payload: Payload,
  token: string,
  path: string,
  {
    body,
    idempotencyKey,
    ifMatch,
    method = 'GET',
    routeParams = {},
  }: {
    body?: AnyRecord
    idempotencyKey?: string
    ifMatch?: string
    method?: string
    routeParams?: Record<string, string>
  } = {},
) {
  const headers = new Headers({ Authorization: `SyncShow ${token}` })
  if (body) headers.set('Content-Type', 'application/json')
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
  if (ifMatch) headers.set('If-Match', ifMatch)
  return {
    headers,
    method,
    payload,
    routeParams,
    text: async () => JSON.stringify(body || {}),
    transactionID: undefined,
    url: `http://localhost/api/community/syncshow/v1/${path}`,
  }
}

function relationshipId(value: unknown) {
  return value && typeof value === 'object' && 'id' in value
    ? (value as { id: number | string }).id
    : value as number | string
}

function songDocument({
  attribution,
  id,
  lyric,
  title,
  translationOf,
}: {
  attribution: string
  id: string
  lyric: string
  title: string
  translationOf?: string
}): SongPublicDocumentInput {
  const source = [
    '---',
    `id: ${JSON.stringify(id)}`,
    `title: ${JSON.stringify(title)}`,
    `language: ${translationOf ? 'ru' : 'en'}`,
    ...(translationOf
      ? [`translationOf: ${JSON.stringify(translationOf)}`]
      : []),
    `attribution: ${JSON.stringify(attribution)}`,
    '---',
    '',
    '^1',
    lyric,
    '',
  ].join('\n')
  return {
    id,
    source,
    revision: createHash('sha256').update(source, 'utf8').digest('hex'),
  }
}

async function createConnection({
  communityId,
  payload,
  suffix,
  token,
  user,
}: {
  communityId: number | string
  payload: Payload
  suffix: string
  token: string
  user: AnyRecord
}) {
  const now = new Date()
  const expiresAt =
    new Date(now.getTime() + 24 * 60 * 60_000).toISOString()
  const grant = await payload.create({
    collection: 'syncshow-device-grants',
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    data: {
      community: communityId,
      requestedEmail: String(user.email),
      clientName: 'Song public-link runtime validation',
      deviceId: `song-link-device-${suffix}`,
      deviceSecretHash: hashOpaqueToken(`device-secret-${suffix}`),
      userCodeHash: hashOpaqueToken(`user-code-${suffix}`),
      codeChallenge: hashOpaqueToken(`challenge-${suffix}`),
      scopes,
      status: 'consumed',
      expiresAt,
      approvedBy: user.id,
      approvedAt: now.toISOString(),
      consumedAt: now.toISOString(),
    } as never,
  }) as AnyRecord
  const connection = await payload.create({
    collection: 'syncshow-connections',
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    data: {
      community: communityId,
      user: user.id,
      grant: grant.id,
      clientName: 'Song public-link runtime validation',
      tokenHash: hashOpaqueToken(token),
      scopes,
      expiresAt,
      lastUsedAt: now.toISOString(),
    } as never,
  }) as AnyRecord
  return { connection, grant }
}

async function anonymousSong(linkId: string) {
  return getSharedSong(
    new Request(
      `http://localhost/community/songs/shared/${encodeURIComponent(linkId)}`,
    ),
    { params: Promise.resolve({ linkId }) },
  )
}

test('real Payload/Postgres song public-link lifecycle remains immutable and community-scoped', {
  skip: !liveDatabaseUrl,
  timeout: 120_000,
}, async () => {
  const milestone = (message: string) => {
    process.stdout.write(`# song-link live: ${message}\n`)
  }
  assertDisposableLiveDatabase({
    databaseUrl: liveDatabaseUrl,
    expectedDatabase: 'heritage_syncshow_payload_live',
    expectedMarker: 'heritage-community-syncshow-payload-live-v1',
    variableName: 'SONG_PUBLIC_LINK_LIVE_DATABASE_URL',
  })

  // The database must already be migrated before this opt-in test runs.
  // Disable both development schema pushes and production auto-migrations:
  // either could mutate unrelated rows or block on Payload's interactive
  // batch -1 marker prompt inside the Node test worker.
  const resolvedConfig = await config
  resolvedConfig.db = postgresAdapter({
    pool: { connectionString: liveDatabaseUrl },
    push: false,
  }) as typeof resolvedConfig.db
  const payload = await getPayload({ config })
  milestone('Payload initialized')
  const created: {
    community?: number | string
    connection?: number | string
    foreignConnection?: number | string
    foreignGrant?: number | string
    foreignMembership?: number | string
    grant?: number | string
    link?: number | string
    song?: number | string
  } = {}

  try {
    const community = (await payload.find({
      collection: 'communities',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { slug: { equals: 'local-church' } },
    })).docs[0] as AnyRecord | undefined
    assert.ok(community)

    const membership = (await payload.find({
      collection: 'memberships',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          { community: { equals: community.id } },
          { role: { in: ['owner', 'admin', 'leader'] } },
        ],
      },
    })).docs[0] as AnyRecord | undefined
    assert.ok(membership)
    const leaderDocument = await payload.findByID({
      collection: 'users',
      id: relationshipId(membership.user),
      depth: 0,
      overrideAccess: true,
    }) as AnyRecord
    const leader = { ...leaderDocument, collection: 'users' } as never

    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
    const songSyncId = `song-link-runtime-${suffix}`
    const originalId = `${songSyncId}-original`
    const documents = [
      songDocument({
        id: originalId,
        title: 'Runtime exact original',
        lyric: 'Pinned runtime original lyric.',
        attribution: [
          'Runtime public copyright.',
          'Private path: /Users/operator/runtime-permission.eml',
          'Manager email: runtime-private@example.test',
        ].join('\n'),
      }),
      songDocument({
        id: `${songSyncId}-ru`,
        title: 'Точный тестовый перевод',
        lyric: 'Закрепленная строка тестового перевода.',
        translationOf: originalId,
        attribution: 'Safe public runtime translation credit.',
      }),
    ]
    const createdSong = await payload.create({
      collection: 'songs',
      depth: 0,
      overrideAccess: false,
      showHiddenFields: true,
      user: leader,
      data: {
        community: community.id,
        status: 'draft',
        title: 'Runtime exact original',
        syncId: songSyncId,
        syncVersion: 1,
        syncDocuments: documents,
        visibility: 'private',
        rightsStatus: 'permission-granted',
        copyright: 'Runtime public copyright.',
        rightsNotes: [
          'Private path: /Users/operator/runtime-permission.eml',
          'Manager email: runtime-private@example.test',
        ].join('\r\n'),
      } as never,
    }) as AnyRecord
    created.song = createdSong.id
    assert.equal(createdSong.syncVersion, 1)
    milestone('leader created exact bilingual song family')

    const foreignCommunity = await payload.create({
      collection: 'communities',
      depth: 0,
      overrideAccess: true,
      data: {
        name: 'Song link runtime foreign church',
        slug: `song-link-foreign-${suffix}`,
        website: 'http://foreign.invalid',
        timeZone: 'UTC',
        joinPolicy: 'invite',
        contentServerEnabled: false,
      } as never,
    }) as AnyRecord
    created.community = foreignCommunity.id
    const foreignMembership = await payload.create({
      collection: 'memberships',
      depth: 0,
      overrideAccess: true,
      data: {
        community: foreignCommunity.id,
        user: leaderDocument.id,
        role: 'leader',
        joinedAt: new Date().toISOString(),
      } as never,
    }) as AnyRecord
    created.foreignMembership = foreignMembership.id

    const token = `song-link-token-${suffix}`
    const foreignToken = `song-link-foreign-token-${suffix}`
    const connection = await createConnection({
      communityId: community.id,
      payload,
      suffix: `${suffix}-main`,
      token,
      user: leaderDocument,
    })
    created.connection = connection.connection.id
    created.grant = connection.grant.id
    const foreignConnection = await createConnection({
      communityId: foreignCommunity.id,
      payload,
      suffix: `${suffix}-foreign`,
      token: foreignToken,
      user: leaderDocument,
    })
    created.foreignConnection = foreignConnection.connection.id
    created.foreignGrant = foreignConnection.grant.id
    milestone('main and foreign scoped device connections created')

    const unauthorized = await listLinks(
      request(
        payload,
        '',
        `song-public-links?songSyncId=${encodeURIComponent(songSyncId)}`,
      ) as never,
    )
    assert.equal(unauthorized.status, 401)

    const canonicalDocuments =
      createdSong.syncDocuments as SongPublicDocumentInput[]
    const familyRevision =
      songPublicLinkFamilyRevision(canonicalDocuments)
    const review = {
      scope: 'public-link',
      basis: 'direct-permission',
      evidence: 'Runtime written permission for anonymous web display.',
      validUntil: null,
      validThrough: null,
      reviewedAt: new Date(Date.now() - 1_000).toISOString(),
      familyRevision,
    }
    const body = {
      songSyncId,
      familyRevision,
      review,
      reviewRevision: songPublicLinkReviewRevision(review as never),
      label: 'Private runtime operator label',
      expiresAt: null,
    }

    const stale = await createLink(request(
      payload,
      token,
      'song-public-links',
      {
        body,
        idempotencyKey: `song-link-stale-${suffix}`,
        ifMatch: `"song:${songSyncId}:9"`,
        method: 'POST',
      },
    ) as never)
    assert.equal(stale.status, 412)

    const creationKey = `song-link-create-${suffix}`
    const createResponse = await createLink(request(
      payload,
      token,
      'song-public-links',
      {
        body,
        idempotencyKey: creationKey,
        ifMatch: `"song:${songSyncId}:1"`,
        method: 'POST',
      },
    ) as never)
    assert.equal(createResponse.status, 201)
    const createdBody = await createResponse.json() as AnyRecord
    const linkId = String(createdBody.link.linkId)
    assert.match(linkId, /^[A-Za-z0-9_-]{43}$/)
    const storedLink = (await payload.find({
      collection: 'syncshow-song-public-links' as never,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      showHiddenFields: true,
      where: { linkId: { equals: linkId } },
    })).docs[0] as AnyRecord | undefined
    assert.ok(storedLink)
    created.link = storedLink.id

    const replayResponse = await createLink(request(
      payload,
      token,
      'song-public-links',
      {
        body,
        idempotencyKey: creationKey,
        ifMatch: `"song:${songSyncId}:1"`,
        method: 'POST',
      },
    ) as never)
    assert.equal(replayResponse.status, 200)
    assert.equal(
      (await replayResponse.json() as AnyRecord).link.linkId,
      linkId,
    )

    const conflictResponse = await createLink(request(
      payload,
      token,
      'song-public-links',
      {
        body: { ...body, label: 'Changed retry body' },
        idempotencyKey: creationKey,
        ifMatch: `"song:${songSyncId}:1"`,
        method: 'POST',
      },
    ) as never)
    assert.equal(conflictResponse.status, 409)
    milestone('CAS creation and exact idempotency validated')

    const mainListResponse = await listLinks(request(
      payload,
      token,
      `song-public-links?songSyncId=${encodeURIComponent(songSyncId)}&limit=10`,
    ) as never)
    assert.equal(mainListResponse.status, 200)
    const mainList = await mainListResponse.json() as AnyRecord
    assert.equal(mainList.items.length, 1)
    assert.equal(mainList.items[0].linkId, linkId)
    assert.equal(mainList.items[0].label, body.label)

    const foreignListResponse = await listLinks(request(
      payload,
      foreignToken,
      `song-public-links?songSyncId=${encodeURIComponent(songSyncId)}&limit=10`,
    ) as never)
    assert.equal(foreignListResponse.status, 200)
    assert.deepEqual(
      (await foreignListResponse.json() as AnyRecord).items,
      [],
    )

    const foreignRevoke = await revokeLink(request(
      payload,
      foreignToken,
      `song-public-links/${linkId}`,
      {
        idempotencyKey: `song-link-foreign-revoke-${suffix}`,
        ifMatch: `"song-public-link:${linkId}:1"`,
        method: 'DELETE',
        routeParams: { linkId },
      },
    ) as never)
    assert.equal(foreignRevoke.status, 404)
    assert.equal(
      (await foreignRevoke.json() as AnyRecord).code,
      'LINK_NOT_FOUND',
    )
    milestone('foreign community list and known-ID revoke remained isolated')

    const firstAnonymous = await anonymousSong(linkId)
    assert.equal(firstAnonymous.status, 200)
    assert.equal(
      firstAnonymous.headers.get('Cache-Control'),
      'private, no-store',
    )
    const originalHtml = await firstAnonymous.text()
    assert.match(originalHtml, /Pinned runtime original lyric\./)
    assert.match(originalHtml, /Закрепленная строка тестового перевода\./)
    assert.match(originalHtml, /Safe public runtime translation credit\./)
    assert.doesNotMatch(
      originalHtml,
      /runtime-permission|runtime-private@example\.test|Runtime written permission|Private runtime operator label/,
    )
    milestone('anonymous HTML served exact public-only snapshot')

    const driftedDocuments = [
      songDocument({
        id: originalId,
        title: 'Runtime changed original',
        lyric: 'Later mutable lyric must never retarget the link.',
        attribution: 'Later explicit public credit.',
      }),
      canonicalDocuments[1],
    ]
    const driftedSong = await payload.update({
      collection: 'songs',
      id: createdSong.id,
      depth: 0,
      overrideAccess: false,
      showHiddenFields: true,
      user: leader,
      data: {
        title: 'Runtime changed original',
        syncDocuments: driftedDocuments,
      } as never,
    }) as AnyRecord
    assert.equal(driftedSong.syncVersion, 2)

    const afterDrift = await anonymousSong(linkId)
    assert.equal(afterDrift.status, 200)
    const driftHtml = await afterDrift.text()
    assert.equal(driftHtml, originalHtml)
    assert.doesNotMatch(driftHtml, /Later mutable lyric/)
    milestone('later canonical source drift did not change anonymous bytes')

    const revokeKey = `song-link-revoke-${suffix}`
    const revokeResponse = await revokeLink(request(
      payload,
      token,
      `song-public-links/${linkId}`,
      {
        idempotencyKey: revokeKey,
        ifMatch: `"song-public-link:${linkId}:1"`,
        method: 'DELETE',
        routeParams: { linkId },
      },
    ) as never)
    assert.equal(revokeResponse.status, 200)
    assert.equal(
      (await revokeResponse.json() as AnyRecord).link.linkVersion,
      2,
    )
    const revokeReplay = await revokeLink(request(
      payload,
      token,
      `song-public-links/${linkId}`,
      {
        idempotencyKey: revokeKey,
        ifMatch: `"song-public-link:${linkId}:1"`,
        method: 'DELETE',
        routeParams: { linkId },
      },
    ) as never)
    assert.equal(revokeReplay.status, 200)

    const revokedAnonymous = await anonymousSong(linkId)
    const unknownAnonymous = await anonymousSong(
      Buffer.alloc(32, 31).toString('base64url'),
    )
    assert.equal(revokedAnonymous.status, 404)
    assert.equal(unknownAnonymous.status, 404)
    assert.equal(
      await revokedAnonymous.text(),
      await unknownAnonymous.text(),
    )
    for (const header of [
      'Cache-Control',
      'Content-Security-Policy',
      'Referrer-Policy',
      'X-Robots-Tag',
    ]) {
      assert.equal(
        revokedAnonymous.headers.get(header),
        unknownAnonymous.headers.get(header),
      )
    }

    const retainedListResponse = await listLinks(request(
      payload,
      token,
      `song-public-links?songSyncId=${encodeURIComponent(songSyncId)}&limit=10`,
    ) as never)
    const retainedList = await retainedListResponse.json() as AnyRecord
    assert.equal(retainedList.items.length, 1)
    assert.equal(typeof retainedList.items[0].revokedAt, 'string')
    milestone('revocation retained audit history and denied anonymously')
  } finally {
    for (const [collection, id] of [
      ['syncshow-song-public-links', created.link],
      ['syncshow-connections', created.foreignConnection],
      ['syncshow-connections', created.connection],
      ['syncshow-device-grants', created.foreignGrant],
      ['syncshow-device-grants', created.grant],
      ['songs', created.song],
      ['memberships', created.foreignMembership],
      ['communities', created.community],
    ] as const) {
      if (id === undefined) continue
      await payload.delete({
        collection,
        id,
        overrideAccess: true,
      } as never)
      milestone(`cleaned ${collection}`)
    }

    const database = payload.db as {
      destroy?: () => Promise<void>
      pool?: {
        _clients?: Array<{
          end?: () => Promise<void>
          release?: (destroy?: boolean) => void
        }>
        _idle?: Array<{ client?: object }>
        end: () => Promise<void>
        idleCount?: number
        totalCount?: number
      }
    }
    if (database.pool) {
      const pool = database.pool
      milestone(
        `closing Postgres pool (${pool.idleCount ?? '?'} idle / ${pool.totalCount ?? '?'} total)`,
      )
      const ending = pool.end()
      const endedNormally = await Promise.race([
        ending.then(() => true),
        new Promise<false>(resolve => (
          setTimeout(() => resolve(false), 1_000)
        )),
      ])
      if (!endedNormally) {
        const idleClients = new Set(
          (pool._idle || []).map(entry => entry.client),
        )
        for (const client of pool._clients || []) {
          if (idleClients.has(client)) continue
          if (typeof client.release === 'function') client.release(true)
          else await client.end?.()
        }
        await ending
        milestone('released retained schema-introspection client')
      }
      milestone('Postgres pool closed')
    }
    await database.destroy?.()
    milestone('Payload adapter destroyed')
  }
})

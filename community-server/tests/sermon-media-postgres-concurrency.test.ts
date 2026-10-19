import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  access,
  mkdtemp,
  readdir,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config.ts'
import {
  SERMON_MEDIA_READ_SCOPE,
  SERMON_MEDIA_WRITE_SCOPE,
  type SermonMediaInitRequest,
} from '../src/lib/syncshow/SermonMedia.ts'
import {
  cancelSermonMediaUpload,
  completeSermonMediaUpload,
  getSermonMediaUpload,
  initializeSermonMediaUpload,
  putSermonMediaChunk,
  recoverSermonMediaFinalization,
  sermonMediaCommunityNamespace,
  type SermonMediaAuthority,
} from '../src/lib/syncshow/SermonMediaStore.ts'
import {
  assembleSermonMediaObject,
  storeSermonMediaChunk,
} from '../src/lib/syncshow/SermonMediaStorage.ts'
import {
  createSermonRevision,
} from '../src/lib/syncshow/SermonDocument.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'

type AnyRecord = Record<string, any>
const liveDatabaseUrl = process.env.SERVICE_PLAN_LIVE_DATABASE_URL
const FINALIZATION_WORKER_KEY = '__heritageSermonMediaFinalizationWorker'
const execFileAsync = promisify(execFile)
const communityServerRoot = fileURLToPath(new URL('..', import.meta.url))
const maintenanceScript = fileURLToPath(new URL(
  '../scripts/sermon-media-maintenance.mjs',
  import.meta.url,
))

function relationshipId(value: unknown) {
  return value && typeof value === 'object' && 'id' in value
    ? (value as { id: number | string }).id
    : value as number | string
}

function mp3Bytes(seed: number) {
  const value = Buffer.alloc(256, seed)
  Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(value, 0)
  Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(value, 100)
  return value
}

function body(value: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(value)
      controller.close()
    },
  })
}

function request(payload: Payload) {
  return {
    headers: new Headers(),
    payload,
    routeParams: {},
    transactionID: undefined,
  } as any
}

async function relativeObjectFiles(root: string) {
  const objectsRoot = path.join(root, 'objects')
  const result: string[] = []
  const visit = async (directory: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const value = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(value)
      } else if (entry.isFile()) {
        result.push(path.relative(root, value))
      } else {
        throw new Error('Unexpected object-store entry in live regression.')
      }
    }
  }
  await visit(objectsRoot)
  return result.sort()
}

function withTimeout<T>(promise: Promise<T>, label: string) {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} exceeded the real PostgreSQL deadline`))
      }, 20_000)
      timer.unref()
    }),
  ])
}

async function waitForUploadState(
  payload: Payload,
  authority: SermonMediaAuthority,
  uploadId: string,
  expectedState: string,
) {
  return await withTimeout((async () => {
    while (true) {
      const upload = await getSermonMediaUpload(
        request(payload),
        authority,
        uploadId,
      )
      if (upload.state === expectedState) return upload
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  })(), `upload ${uploadId} to reach ${expectedState}`)
}

async function createCanonicalSermon(
  payload: Payload,
  communityId: number | string,
  suffix: string,
  recordingId: string,
  bytes: Uint8Array,
) {
  const syncId = `sermon-media-lock-${suffix}-${recordingId}`
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const document = createSermonRevision({
    schemaVersion: 3,
    kind: 'syncshow-sermon',
    id: syncId,
    titles: { en: `Lock-order sermon ${recordingId}` },
    defaultLanguage: 'en',
    speaker: { id: null, name: 'Concurrency test pastor' },
    serviceDate: '2026-08-02',
    series: null,
    outline: [],
    sources: [],
    references: [],
    media: [{
      id: recordingId,
      kind: 'audio',
      language: 'en',
      mediaType: 'audio/mpeg',
      fileName: `${recordingId}.mp3`,
      sha256,
      sizeBytes: bytes.byteLength,
      durationSeconds: null,
      status: 'pending',
      title: 'Private recording',
      url: null,
    }],
    publication: {
      status: 'draft',
      visibility: 'private',
      publishedAt: null,
      canonicalUrl: null,
    },
    body: [],
  })
  const sermon = await payload.create({
    collection: 'sermons',
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    context: { syncShowSermonMutation: true },
    data: {
      community: communityId,
      status: 'draft',
      title: `Lock-order sermon ${recordingId}`,
      slug: `lock-order-${suffix}-${recordingId}`,
      speaker: 'Concurrency test pastor',
      preachedAt: '2026-08-02T00:00:00.000Z',
      syncId,
      syncVersion: 1,
      syncCurrentDocumentSource: document.source,
      syncCurrentRevision: document.sha256,
      syncArchived: false,
      syncPublicationStatus: 'draft',
      syncVisibility: 'private',
      syncSourceObjects: [],
      syncChangedAt: new Date().toISOString(),
    } as never,
  }) as AnyRecord
  const init: SermonMediaInitRequest = {
    schemaVersion: 1,
    sermon: {
      syncId,
      expectedSyncVersion: 1,
      expectedCurrentRevision: document.sha256,
    },
    recording: {
      id: recordingId,
      kind: 'audio',
      language: 'en',
      mediaType: 'audio/mpeg',
      fileName: `${recordingId}.mp3`,
      sha256,
      sizeBytes: bytes.byteLength,
      durationSeconds: null,
    },
  }
  return { sermon, init }
}

test('two real PostgreSQL slots cannot deadlock init with chunk/finalization', {
  skip: !liveDatabaseUrl,
  timeout: 120_000,
}, async () => {
  assertDisposableLiveDatabase({
    databaseUrl: liveDatabaseUrl,
    expectedDatabase: 'heritage_syncshow_payload_live',
    expectedMarker: 'heritage-community-syncshow-payload-live-v1',
    variableName: 'SERVICE_PLAN_LIVE_DATABASE_URL',
  })
  const resolvedConfig = await config
  resolvedConfig.db = postgresAdapter({
    pool: { connectionString: liveDatabaseUrl },
    push: false,
  }) as typeof resolvedConfig.db
  const payload = await getPayload({ config })
  const storageRoot = await mkdtemp(path.join(
    tmpdir(),
    'heritage-sermon-media-postgres-',
  ))
  const previousStorage = process.env.HERITAGE_SERMON_MEDIA_PATH
  const previousMediaEnabled =
    process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
  process.env.HERITAGE_SERMON_MEDIA_PATH = storageRoot
  const created: {
    sermons: Array<number | string>
    connections: Array<number | string>
    grants: Array<number | string>
    memberships: Array<number | string>
    users: Array<number | string>
    community?: number | string
  } = {
    sermons: [],
    connections: [],
    grants: [],
    memberships: [],
    users: [],
  }

  try {
    const community = (await payload.find({
      collection: 'communities',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { slug: { equals: 'local-church' } },
    })).docs[0] as AnyRecord
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
    })).docs[0] as AnyRecord
    assert.ok(membership)
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
    const secondManager = await payload.create({
      collection: 'users',
      depth: 0,
      overrideAccess: true,
      data: {
        displayName: 'Media concurrency manager',
        email: `media-lock-${suffix}@example.test`,
        password: randomUUID(),
        systemRole: 'member',
      } as never,
    }) as AnyRecord
    created.users.push(secondManager.id)
    const secondMembership = await payload.create({
      collection: 'memberships',
      depth: 0,
      overrideAccess: true,
      data: {
        community: community.id,
        user: secondManager.id,
        role: 'leader',
        joinedAt: new Date().toISOString(),
      } as never,
    }) as AnyRecord
    created.memberships.push(secondMembership.id)
    const managerUserIds = [
      relationshipId(membership.user),
      relationshipId(secondManager.id),
    ]
    const scopes = [
      'syncshow:sermons:read',
      SERMON_MEDIA_READ_SCOPE,
      SERMON_MEDIA_WRITE_SCOPE,
    ]
    const authorities: SermonMediaAuthority[] = []
    for (let index = 0; index < 2; index += 1) {
      const grant = await payload.create({
        collection: 'syncshow-device-grants',
        depth: 0,
        overrideAccess: true,
        showHiddenFields: true,
        data: {
          community: community.id,
          requestedEmail: `media-lock-${index}@example.test`,
          clientName: `Media lock ${index}`,
          deviceId: `media-lock-device-${suffix}-${index}`,
          deviceSecretHash: hashOpaqueToken(
            `media-lock-secret-${suffix}-${index}`,
          ),
          userCodeHash: hashOpaqueToken(
            `media-lock-code-${suffix}-${index}`,
          ),
          codeChallenge: hashOpaqueToken(
            `media-lock-challenge-${suffix}-${index}`,
          ),
          scopes,
          status: 'consumed',
          expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
          approvedBy: managerUserIds[index],
          approvedAt: new Date().toISOString(),
          consumedAt: new Date().toISOString(),
        } as never,
      }) as AnyRecord
      created.grants.push(grant.id)
      const connection = await payload.create({
        collection: 'syncshow-connections',
        depth: 0,
        overrideAccess: true,
        showHiddenFields: true,
        data: {
          community: community.id,
          user: managerUserIds[index],
          grant: grant.id,
          clientName: `Media lock ${index}`,
          tokenHash: hashOpaqueToken(
            `media-lock-token-${suffix}-${index}`,
          ),
          scopes,
          expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        } as never,
      }) as AnyRecord
      created.connections.push(connection.id)
      authorities.push({
        connectionId: Number(connection.id),
        communityId: Number(community.id),
        userId: Number(managerUserIds[index]),
        mode: 'write',
      })
    }

    const claimAbandonedFinalization = async (
      label: string,
      seed: number,
    ) => {
      const value = mp3Bytes(seed)
      const fixture = await createCanonicalSermon(
        payload,
        community.id,
        suffix,
        `recording-${label}`,
        value,
      )
      created.sermons.push(fixture.sermon.id)
      const upload = await initializeSermonMediaUpload(
        request(payload),
        authorities[1],
        fixture.init,
        `${label}-init-${suffix}`,
      )
      const stored = await putSermonMediaChunk(
        request(payload),
        authorities[1],
        upload.upload.id,
        {
          index: 0,
          contentLength: String(value.byteLength),
          contentRange:
            `bytes 0-${value.byteLength - 1}/${value.byteLength}`,
          sha256: fixture.init.recording.sha256,
        },
        `${label}-chunk-${suffix}`,
        async headers => await storeSermonMediaChunk({
          uploadId: upload.upload.id,
          headers,
          body: body(value),
        }),
      )
      ;(globalThis as AnyRecord)[FINALIZATION_WORKER_KEY] = {
        running: true,
        queue: [],
      }
      const completion = await completeSermonMediaUpload(
        request(payload),
        authorities[1],
        upload.upload.id,
        `${label}-complete-${suffix}`,
      )
      assert.equal(completion.accepted, true)
      assert.equal(completion.upload.state, 'finalizing')
      ;(globalThis as AnyRecord)[FINALIZATION_WORKER_KEY] = {
        running: false,
        queue: [],
      }
      await (payload.db as AnyRecord).pool.query(`
        UPDATE "syncshow_sermon_media_uploads"
        SET "finalization_lease_expires_at" = now() - interval '1 second'
        WHERE "upload_id" = $1
      `, [upload.upload.id])
      return {
        ...upload,
        fixture,
        storedChunk: stored.chunk,
        value,
      }
    }

    const recoverableBytes = mp3Bytes(7)
    const recoverableFixture = await createCanonicalSermon(
      payload,
      community.id,
      suffix,
      'recording-recoverable',
      recoverableBytes,
    )
    created.sermons.push(recoverableFixture.sermon.id)
    const recoverableKey = `recoverable-init-${suffix}`
    const acceptedRecovery = await initializeSermonMediaUpload(
      request(payload),
      authorities[0],
      recoverableFixture.init,
      recoverableKey,
    )
    const replayedRecovery = await initializeSermonMediaUpload(
      request(payload),
      authorities[0],
      recoverableFixture.init,
      recoverableKey,
    )
    assert.equal(replayedRecovery.created, false)
    assert.equal(
      replayedRecovery.upload.id,
      acceptedRecovery.upload.id,
    )
    await assert.rejects(
      initializeSermonMediaUpload(
        request(payload),
        authorities[0],
        recoverableFixture.init,
        `recoverable-new-key-${suffix}`,
      ),
      (error: unknown) =>
        (error as { code?: unknown })?.code === 'UPLOAD_ALREADY_EXISTS',
    )
    assert.equal(
      (await getSermonMediaUpload(
        request(payload),
        authorities[0],
        acceptedRecovery.upload.id,
      )).id,
      acceptedRecovery.upload.id,
    )
    await putSermonMediaChunk(
      request(payload),
      authorities[0],
      acceptedRecovery.upload.id,
      {
        index: 0,
        contentLength: String(recoverableBytes.byteLength),
        contentRange:
          `bytes 0-${recoverableBytes.byteLength - 1}/${recoverableBytes.byteLength}`,
        sha256: recoverableFixture.init.recording.sha256,
      },
      `recoverable-chunk-${suffix}`,
      async headers => await storeSermonMediaChunk({
        uploadId: acceptedRecovery.upload.id,
        headers,
        body: body(recoverableBytes),
      }),
    )
    const cancelledRecovery = await cancelSermonMediaUpload(
      request(payload),
      authorities[0],
      acceptedRecovery.upload.id,
      `recoverable-cancel-${suffix}`,
    )
    assert.equal(cancelledRecovery.state, 'cancelled')
    await assert.rejects(
      access(path.join(
        storageRoot,
        'staging',
        acceptedRecovery.upload.id,
      )),
      (error: unknown) =>
        (error as NodeJS.ErrnoException)?.code === 'ENOENT',
    )

    const staleBytes = mp3Bytes(8)
    const staleFixture = await createCanonicalSermon(
      payload,
      community.id,
      suffix,
      'recording-stale-recovery',
      staleBytes,
    )
    created.sermons.push(staleFixture.sermon.id)
    const staleKey = `stale-init-${suffix}`
    const acceptedStale = await initializeSermonMediaUpload(
      request(payload),
      authorities[0],
      staleFixture.init,
      staleKey,
    )
    await putSermonMediaChunk(
      request(payload),
      authorities[0],
      acceptedStale.upload.id,
      {
        index: 0,
        contentLength: String(staleBytes.byteLength),
        contentRange:
          `bytes 0-${staleBytes.byteLength - 1}/${staleBytes.byteLength}`,
        sha256: staleFixture.init.recording.sha256,
      },
      `stale-chunk-${suffix}`,
      async headers => await storeSermonMediaChunk({
        uploadId: acceptedStale.upload.id,
        headers,
        body: body(staleBytes),
      }),
    )
    await payload.update({
      collection: 'sermons',
      id: staleFixture.sermon.id,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
      context: { syncShowSermonMutation: true },
      data: { syncArchived: true } as never,
    })
    await assert.rejects(
      initializeSermonMediaUpload(
        request(payload),
        authorities[0],
        staleFixture.init,
        staleKey,
      ),
      (error: unknown) =>
        error instanceof Error
        && (error as { code?: unknown }).code === 'STALE_SERMON_BINDING',
    )
    const staleState = await (payload.db as AnyRecord).pool.query(`
      SELECT "state"
      FROM "syncshow_sermon_media_uploads"
      WHERE "upload_id" = $1
    `, [acceptedStale.upload.id])
    assert.equal(staleState.rows[0]?.state, 'superseded')
    await assert.rejects(
      access(path.join(
        storageRoot,
        'staging',
        acceptedStale.upload.id,
      )),
      (error: unknown) =>
        (error as NodeJS.ErrnoException)?.code === 'ENOENT',
    )

    const bytes = [mp3Bytes(1), mp3Bytes(2)]
    const fixtures = await Promise.all(bytes.map(
      (value, index) => createCanonicalSermon(
        payload,
        community.id,
        suffix,
        `recording-${index}`,
        value,
      ),
    ))
    created.sermons.push(...fixtures.map(item => item.sermon.id))
    const uploads = await Promise.all(fixtures.map(
      (fixture, index) => initializeSermonMediaUpload(
        request(payload),
        authorities[index],
        fixture.init,
        `initial-upload-${suffix}-${index}`,
      ),
    ))

    const releases: Array<() => void> = []
    const entered = fixtures.map(() => {
      let resolve!: () => void
      const promise = new Promise<void>(done => {
        resolve = done
      })
      return { promise, resolve }
    })
    const chunks = uploads.map((upload, index) =>
      putSermonMediaChunk(
        request(payload),
        authorities[index],
        upload.upload.id,
        {
          index: 0,
          contentLength: String(bytes[index].byteLength),
          contentRange: `bytes 0-${bytes[index].byteLength - 1}/${bytes[index].byteLength}`,
          sha256: fixtures[index].init.recording.sha256,
        },
        `chunk-${suffix}-${index}`,
        async headers => {
          entered[index].resolve()
          await new Promise<void>(resolve => releases[index] = resolve)
          return await storeSermonMediaChunk({
            uploadId: upload.upload.id,
            headers,
            body: body(bytes[index]),
          })
        },
      )
    )
    await Promise.all(entered.map(item => item.promise))
    const competingInits = fixtures.map((fixture, index) =>
      initializeSermonMediaUpload(
        request(payload),
        authorities[index],
        fixture.init,
        `competing-init-${suffix}-${index}`,
      )
    )
    await new Promise(resolve => setTimeout(resolve, 100))
    releases[1]()
    releases[0]()
    const chunkResults = await withTimeout(
      Promise.all(chunks),
      'two-slot chunk commits',
    )
    assert.equal(chunkResults.length, 2)
    const initResults = await withTimeout(
      Promise.allSettled(competingInits),
      'two-slot competing init',
    )
    assert.deepEqual(
      initResults.map(result => result.status),
      ['rejected', 'rejected'],
    )

    const completionRace = await withTimeout(
      Promise.allSettled([
        completeSermonMediaUpload(
          request(payload),
          authorities[0],
          uploads[0].upload.id,
          `complete-${suffix}`,
        ),
        initializeSermonMediaUpload(
          request(payload),
          authorities[1],
          fixtures[0].init,
          `completion-race-${suffix}`,
        ),
      ]),
      'completion versus init',
    )
    assert.ok(completionRace.some(result => result.status === 'fulfilled'))
    assert.ok(completionRace.some(result => result.status === 'rejected'))
    const completedUpload = await waitForUploadState(
      payload,
      authorities[0],
      uploads[0].upload.id,
      'complete',
    )
    assert.equal(completedUpload.id, uploads[0].upload.id)
    const recoveredComplete = await initializeSermonMediaUpload(
      request(payload),
      authorities[1],
      fixtures[0].init,
      `complete-recovery-${suffix}`,
    )
    assert.equal(recoveredComplete.created, false)
    assert.equal(recoveredComplete.upload.id, uploads[0].upload.id)
    assert.equal(recoveredComplete.upload.state, 'complete')

    const otherCommunity = await payload.create({
      collection: 'communities',
      depth: 0,
      overrideAccess: true,
      data: {
        name: 'Disposable media FK tenant',
        slug: `media-fk-${suffix}`,
        timeZone: 'UTC',
        joinPolicy: 'invite',
      } as never,
    }) as AnyRecord
    created.community = otherCommunity.id
    const otherDigest = 'e'.repeat(64)
    const otherNamespace = sermonMediaCommunityNamespace(
      Number(otherCommunity.id),
    )
    const insertedObject = (await (payload.db as AnyRecord).pool.query(`
      INSERT INTO "syncshow_sermon_media_objects" (
        "community_id",
        "sha256",
        "size_bytes",
        "media_type",
        "storage_key",
        "verified_at",
        "updated_at",
        "created_at"
      ) VALUES ($1, $2, 1, 'audio/mpeg', $3, now(), now(), now())
      RETURNING "id"
    `, [
      otherCommunity.id,
      otherDigest,
      `objects/${otherNamespace}/sha256/ee/${otherDigest}`,
    ])).rows[0]
    await assert.rejects(
      (payload.db as AnyRecord).pool.query(`
        UPDATE "syncshow_sermon_media_uploads"
        SET "state" = 'complete', "object_id" = $1, "completed_at" = now()
        WHERE "upload_id" = $2
      `, [insertedObject.id, uploads[1].upload.id]),
      /syncshow_sermon_media_uploads_object_fk/,
    )
    await (payload.db as AnyRecord).pool.query(
      `DELETE FROM "syncshow_sermon_media_objects" WHERE "id" = $1`,
      [insertedObject.id],
    )

    await cancelSermonMediaUpload(
      request(payload),
      authorities[1],
      uploads[1].upload.id,
      `cancel-${suffix}`,
    )

    const restartBytes = mp3Bytes(9)
    const restartFixture = await createCanonicalSermon(
      payload,
      community.id,
      suffix,
      'recording-restart-recovery',
      restartBytes,
    )
    created.sermons.push(restartFixture.sermon.id)
    const restartUpload = await initializeSermonMediaUpload(
      request(payload),
      authorities[1],
      restartFixture.init,
      `restart-init-${suffix}`,
    )
    await putSermonMediaChunk(
      request(payload),
      authorities[1],
      restartUpload.upload.id,
      {
        index: 0,
        contentLength: String(restartBytes.byteLength),
        contentRange:
          `bytes 0-${restartBytes.byteLength - 1}/${restartBytes.byteLength}`,
        sha256: restartFixture.init.recording.sha256,
      },
      `restart-chunk-${suffix}`,
      async headers => await storeSermonMediaChunk({
        uploadId: restartUpload.upload.id,
        headers,
        body: body(restartBytes),
      }),
    )

    // Hold the in-process drain to model a durable 202 whose response and
    // process-local job are both lost. The claim itself remains in PostgreSQL.
    ;(globalThis as AnyRecord)[FINALIZATION_WORKER_KEY] = {
      running: true,
      queue: [],
    }
    const completionKey = `restart-complete-${suffix}`
    const acceptedCompletion = await completeSermonMediaUpload(
      request(payload),
      authorities[1],
      restartUpload.upload.id,
      completionKey,
    )
    assert.equal(acceptedCompletion.accepted, true)
    assert.equal(acceptedCompletion.upload.state, 'finalizing')
    const lostResponseReplay = await completeSermonMediaUpload(
      request(payload),
      authorities[1],
      restartUpload.upload.id,
      completionKey,
    )
    assert.equal(lostResponseReplay.accepted, true)
    assert.equal(lostResponseReplay.upload.id, restartUpload.upload.id)
    assert.equal(lostResponseReplay.upload.state, 'finalizing')

    // Drop the held queue like a process restart and make the durable lease
    // stale. Disabled recovery and revoked authority must both fail closed.
    ;(globalThis as AnyRecord)[FINALIZATION_WORKER_KEY] = {
      running: false,
      queue: [],
    }
    await (payload.db as AnyRecord).pool.query(`
      UPDATE "syncshow_sermon_media_uploads"
      SET "finalization_lease_expires_at" = now() - interval '1 second'
      WHERE "upload_id" = $1
    `, [restartUpload.upload.id])
    process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = 'false'
    assert.equal(
      await recoverSermonMediaFinalization(payload),
      false,
    )
    const stillFinalizing = await (payload.db as AnyRecord).pool.query(`
      SELECT "state"
      FROM "syncshow_sermon_media_uploads"
      WHERE "upload_id" = $1
    `, [restartUpload.upload.id])
    assert.equal(stillFinalizing.rows[0]?.state, 'finalizing')

    process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = 'true'
    assert.equal(
      await recoverSermonMediaFinalization(payload),
      true,
    )
    const recoveredRestart = await waitForUploadState(
      payload,
      authorities[1],
      restartUpload.upload.id,
      'complete',
    )
    assert.equal(recoveredRestart.id, restartUpload.upload.id)
    const completedReplay = await completeSermonMediaUpload(
      request(payload),
      authorities[1],
      restartUpload.upload.id,
      completionKey,
    )
    assert.equal(completedReplay.accepted, false)
    assert.equal(completedReplay.upload.state, 'complete')

    const revokedUpload = await claimAbandonedFinalization('revoked', 10)
    const revokedOrphan = await assembleSermonMediaObject({
      uploadId: revokedUpload.upload.id,
      communityNamespace: sermonMediaCommunityNamespace(
        authorities[1].communityId,
      ),
      chunks: [revokedUpload.storedChunk],
      expectedSha256: revokedUpload.fixture.init.recording.sha256,
      expectedSizeBytes: revokedUpload.value.byteLength,
      expectedMediaType: 'audio/mpeg',
    })
    await access(path.join(storageRoot, revokedOrphan.storageKey))
    await (payload.db as AnyRecord).pool.query(`
      UPDATE "syncshow_connections"
      SET "revoked_at" = now()
      WHERE "id" = $1
    `, [authorities[1].connectionId])
    process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = 'false'
    assert.equal(
      await recoverSermonMediaFinalization(payload),
      false,
    )
    const revokedState = await (payload.db as AnyRecord).pool.query(`
      SELECT "state"
      FROM "syncshow_sermon_media_uploads"
      WHERE "upload_id" = $1
    `, [revokedUpload.upload.id])
    assert.equal(revokedState.rows[0]?.state, 'expired')
    await assert.rejects(
      access(path.join(
        storageRoot,
        'staging',
        revokedUpload.upload.id,
      )),
      (error: unknown) =>
        (error as NodeJS.ErrnoException)?.code === 'ENOENT',
    )
    await (payload.db as AnyRecord).pool.query(`
      UPDATE "syncshow_connections"
      SET "revoked_at" = NULL
      WHERE "id" = $1
    `, [authorities[1].connectionId])

    const maintenanceResult = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', maintenanceScript],
      {
        cwd: communityServerRoot,
        env: {
          ...process.env,
          DATABASE_URL: liveDatabaseUrl,
          HERITAGE_SERMON_MEDIA_PATH: storageRoot,
          HERITAGE_SERMON_MEDIA_MAINTENANCE_QUIESCED: 'true',
          HERITAGE_SERMON_MEDIA_MAINTENANCE_REQUIRE_BACKUP_READY: 'true',
          HERITAGE_SERMON_MEDIA_ORPHAN_GRACE_SECONDS: '86400',
        },
        timeout: 20_000,
        encoding: 'utf8',
      },
    )
    assert.equal(maintenanceResult.stderr, '')
    const maintenanceReport = JSON.parse(
      maintenanceResult.stdout.trim(),
    ) as AnyRecord
    assert.equal(maintenanceReport.active.uploads, 0)
    assert.equal(maintenanceReport.active.finalizing, 0)
    assert.equal(maintenanceReport.stagingDirectories, 0)
    assert.ok(maintenanceReport.removedOrphanObjects >= 1)
    await assert.rejects(
      access(path.join(storageRoot, revokedOrphan.storageKey)),
      (error: unknown) =>
        (error as NodeJS.ErrnoException)?.code === 'ENOENT',
    )
    const retainedObjectRows = await (payload.db as AnyRecord).pool.query(`
      SELECT "storage_key"
      FROM "syncshow_sermon_media_objects"
      ORDER BY "storage_key"
    `)
    assert.deepEqual(
      await relativeObjectFiles(storageRoot),
      retainedObjectRows.rows.map(
        (row: AnyRecord) => String(row.storage_key),
      ),
    )

    process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = 'true'
    const expiredAuthorityUpload =
      await claimAbandonedFinalization('expired-authority', 11)
    await (payload.db as AnyRecord).pool.query(`
      UPDATE "syncshow_connections"
      SET "expires_at" = now() - interval '1 second'
      WHERE "id" = $1
    `, [authorities[1].connectionId])
    process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = 'false'
    assert.equal(
      await recoverSermonMediaFinalization(payload),
      false,
    )
    const expiredAuthorityState =
      await (payload.db as AnyRecord).pool.query(`
        SELECT "state"
        FROM "syncshow_sermon_media_uploads"
        WHERE "upload_id" = $1
      `, [expiredAuthorityUpload.upload.id])
    assert.equal(expiredAuthorityState.rows[0]?.state, 'expired')
    await assert.rejects(
      access(path.join(
        storageRoot,
        'staging',
        expiredAuthorityUpload.upload.id,
      )),
      (error: unknown) =>
        (error as NodeJS.ErrnoException)?.code === 'ENOENT',
    )
    await (payload.db as AnyRecord).pool.query(`
      UPDATE "syncshow_connections"
      SET "expires_at" = now() + interval '1 hour'
      WHERE "id" = $1
    `, [authorities[1].connectionId])
    process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = 'true'
  } finally {
    const pool = (payload.db as AnyRecord).pool
    const connectionIds = created.connections.map(Number)
    const objectIds = connectionIds.length
      ? (await pool.query(`
          SELECT DISTINCT "object_id"
          FROM "syncshow_sermon_media_uploads"
          WHERE "connection_id" = ANY($1::integer[])
            AND "object_id" IS NOT NULL
        `, [connectionIds]).catch(() => ({ rows: [] }))).rows
        .map((item: AnyRecord) => Number(item.object_id))
      : []
    await pool.query(`
      DELETE FROM "syncshow_sermon_media_chunks"
      WHERE "upload_id" IN (
        SELECT "id" FROM "syncshow_sermon_media_uploads"
        WHERE "connection_id" = ANY($1::integer[])
      )
    `, [connectionIds]).catch(() => undefined)
    await pool.query(`
      DELETE FROM "syncshow_sermon_media_uploads"
      WHERE "connection_id" = ANY($1::integer[])
    `, [connectionIds]).catch(() => undefined)
    if (objectIds.length) {
      await pool.query(`
        DELETE FROM "syncshow_sermon_media_objects"
        WHERE "id" = ANY($1::integer[])
      `, [objectIds]).catch(() => undefined)
    }
    for (const [collection, ids] of [
      ['syncshow-connections', created.connections],
      ['syncshow-device-grants', created.grants],
      ['sermons', created.sermons],
      ['memberships', created.memberships],
      ['users', created.users],
      ['communities', created.community ? [created.community] : []],
    ] as const) {
      for (const id of ids) {
        await payload.delete({
          collection,
          id,
          overrideAccess: true,
        } as never).catch(() => undefined)
      }
    }
    if (previousStorage === undefined) {
      delete process.env.HERITAGE_SERMON_MEDIA_PATH
    } else {
      process.env.HERITAGE_SERMON_MEDIA_PATH = previousStorage
    }
    if (previousMediaEnabled === undefined) {
      delete process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
    } else {
      process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED =
        previousMediaEnabled
    }
    delete (globalThis as AnyRecord)[FINALIZATION_WORKER_KEY]
    await rm(storageRoot, { recursive: true, force: true })
    const database = payload.db as AnyRecord
    if (database.pool) {
      const ending = database.pool.end()
      const endedNormally = await Promise.race([
        ending.then(() => true),
        new Promise<false>(resolve => setTimeout(() => resolve(false), 1_000)),
      ])
      if (!endedNormally) {
        const idleClients = new Set(
          (database.pool._idle || []).map(
            (entry: { client?: object }) => entry.client,
          ),
        )
        for (const client of database.pool._clients || []) {
          if (idleClients.has(client)) continue
          if (typeof client.release === 'function') client.release(true)
          else await client.end?.()
        }
        await ending
      }
    }
    await database.destroy?.()
  }
})

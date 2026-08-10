import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  sermonMediaCommunityNamespace,
  sweepSermonMediaUploads,
} from '../src/lib/syncshow/SermonMediaStore.ts'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  SermonMediaError,
  type SermonMediaChunkHeaders,
} from '../src/lib/syncshow/SermonMedia.ts'
import {
  assembleSermonMediaObject,
  cleanupSermonMediaStaging,
  sermonMediaObjectKey,
  storeSermonMediaChunk,
  verifySermonMediaObject,
} from '../src/lib/syncshow/SermonMediaStorage.ts'

const COMMUNITY_NAMESPACE = sermonMediaCommunityNamespace(7)

function digest(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function stream(value: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(value)
      controller.close()
    },
  })
}

function pacedStream(
  value: Uint8Array,
  partSize: number,
  delayMs: number,
) {
  let offset = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= value.byteLength) {
        controller.close()
        return
      }
      await new Promise(resolve => setTimeout(resolve, delayMs))
      const end = Math.min(offset + partSize, value.byteLength)
      controller.enqueue(value.subarray(offset, end))
      offset = end
    },
  })
}

function headers(value: Uint8Array): SermonMediaChunkHeaders {
  return {
    index: 0,
    startByte: 0,
    endByte: value.byteLength - 1,
    totalBytes: value.byteLength,
    sizeBytes: value.byteLength,
    sha256: digest(value),
  }
}

function mp3Bytes() {
  const value = Buffer.alloc(256)
  Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(value, 0)
  Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(value, 100)
  return value
}

function box(type: string, payload = Buffer.alloc(0)) {
  const value = Buffer.alloc(8 + payload.length)
  value.writeUInt32BE(value.length, 0)
  value.write(type, 4, 4, 'latin1')
  payload.copy(value, 8)
  return value
}

function mp4Bytes() {
  const ftypPayload = Buffer.alloc(16)
  ftypPayload.write('M4A ', 0, 4, 'latin1')
  ftypPayload.writeUInt32BE(0, 4)
  ftypPayload.write('isom', 8, 4, 'latin1')
  ftypPayload.write('M4A ', 12, 4, 'latin1')
  const handlerPayload = Buffer.alloc(12)
  handlerPayload.write('soun', 8, 4, 'latin1')
  const moov = box('moov', box('trak', box('mdia', box(
    'hdlr',
    handlerPayload,
  ))))
  return Buffer.concat([box('ftyp', ftypPayload), moov])
}

async function withStorage(
  callback: (root: string) => Promise<void>,
) {
  const root = await mkdtemp(path.join(tmpdir(), 'heritage-sermon-media-'))
  const previous = process.env.HERITAGE_SERMON_MEDIA_PATH
  process.env.HERITAGE_SERMON_MEDIA_PATH = root
  try {
    await callback(root)
  } finally {
    if (previous === undefined) {
      delete process.env.HERITAGE_SERMON_MEDIA_PATH
    } else {
      process.env.HERITAGE_SERMON_MEDIA_PATH = previous
    }
    await rm(root, { recursive: true, force: true })
  }
}

async function storeOne(uploadId: string, value: Uint8Array) {
  const chunkHeaders = headers(value)
  const chunk = await storeSermonMediaChunk({
    uploadId,
    headers: chunkHeaders,
    body: stream(value),
  })
  return { chunk, chunkHeaders }
}

test('MP3 chunks stream privately and completion is crash-safe/idempotent', async () => {
  await withStorage(async root => {
    const uploadId = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const value = mp3Bytes()
    const { chunk } = await storeOne(uploadId, value)
    const expectedSha256 = digest(value)
    const first = await assembleSermonMediaObject({
      uploadId,
      communityNamespace: COMMUNITY_NAMESPACE,
      chunks: [chunk],
      expectedSha256,
      expectedSizeBytes: value.byteLength,
      expectedMediaType: 'audio/mpeg',
    })
    assert.deepEqual(first, {
      storageKey: sermonMediaObjectKey(
        COMMUNITY_NAMESPACE,
        expectedSha256,
      ),
      sha256: expectedSha256,
      sizeBytes: value.byteLength,
    })
    assert.equal(await verifySermonMediaObject(first), true)

    // Simulate a crash after the atomic object rename but before the database
    // completion transaction. Reassembly verifies/reuses the same object.
    const replay = await assembleSermonMediaObject({
      uploadId,
      communityNamespace: COMMUNITY_NAMESPACE,
      chunks: [chunk],
      expectedSha256,
      expectedSizeBytes: value.byteLength,
      expectedMediaType: 'audio/mpeg',
    })
    assert.deepEqual(replay, first)
    assert.deepEqual(
      await readFile(path.join(root, first.storageKey)),
      value,
    )

    await cleanupSermonMediaStaging(uploadId)
    await assert.rejects(
      access(path.join(root, 'staging', uploadId)),
      /ENOENT/,
    )
    assert.equal(await verifySermonMediaObject(first), true)
  })
})

test('M4A/MP4 completion requires an ISO BMFF audio track', async () => {
  await withStorage(async () => {
    const uploadId = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
    const value = mp4Bytes()
    const { chunk } = await storeOne(uploadId, value)
    const object = await assembleSermonMediaObject({
      uploadId,
      communityNamespace: COMMUNITY_NAMESPACE,
      chunks: [chunk],
      expectedSha256: digest(value),
      expectedSizeBytes: value.byteLength,
      expectedMediaType: 'audio/mp4',
    })
    assert.equal(await verifySermonMediaObject(object), true)
  })
})

test('hash, length, and container spoofing fail closed', async () => {
  await withStorage(async () => {
    const badChunkId = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
    const value = mp3Bytes()
    await assert.rejects(
      storeSermonMediaChunk({
        uploadId: badChunkId,
        headers: { ...headers(value), sha256: '0'.repeat(64) },
        body: stream(value),
      }),
      (error: unknown) =>
        error instanceof SermonMediaError
        && error.code === 'CHUNK_HASH_MISMATCH'
        && error.status === 422,
    )
    await assert.rejects(
      storeSermonMediaChunk({
        uploadId: badChunkId,
        headers: { ...headers(value), sizeBytes: value.length + 1 },
        body: stream(value),
      }),
      (error: unknown) =>
        error instanceof SermonMediaError
        && error.code === 'CONTENT_LENGTH_MISMATCH',
    )

    const spoofId = 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD'
    const spoof = Buffer.from('not an mp3 despite its claimed MIME type')
    const { chunk } = await storeOne(spoofId, spoof)
    await assert.rejects(
      assembleSermonMediaObject({
        uploadId: spoofId,
        communityNamespace: COMMUNITY_NAMESPACE,
        chunks: [chunk],
        expectedSha256: digest(spoof),
        expectedSizeBytes: spoof.byteLength,
        expectedMediaType: 'audio/mpeg',
      }),
      (error: unknown) =>
        error instanceof SermonMediaError
        && error.code === 'INVALID_MEDIA_CONTAINER'
        && error.status === 422,
    )
  })
})

test('chunk timeout resets only when a slow stream makes byte progress', async () => {
  await withStorage(async () => {
    const uploadId = 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'
    const value = mp3Bytes()
    const startedAt = Date.now()
    const chunk = await storeSermonMediaChunk({
      uploadId,
      headers: headers(value),
      body: pacedStream(value, 32, 20),
      streamTiming: {
        inactivityMs: 100,
        totalMs: 1_000,
      },
    })
    assert.equal(chunk.sha256, digest(value))
    assert.ok(
      Date.now() - startedAt >= 100,
      'the whole transfer should outlive one inactivity window',
    )
  })
})

test('chunk timeout cancels a stream that stops making progress', async () => {
  await withStorage(async () => {
    const uploadId = 'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH'
    const value = mp3Bytes()
    let cancelled = false
    const stalled = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(value.subarray(0, 32))
      },
      cancel() {
        cancelled = true
      },
    })
    await assert.rejects(
      storeSermonMediaChunk({
        uploadId,
        headers: headers(value),
        body: stalled,
        streamTiming: {
          inactivityMs: 50,
          totalMs: 500,
        },
      }),
      (error: unknown) =>
        error instanceof SermonMediaError
        && error.code === 'CHUNK_STREAM_TIMEOUT'
        && error.status === 408,
    )
    assert.equal(cancelled, true)
  })
})

test('MP4 box parsing has a bounded anti-DoS budget', async () => {
  await withStorage(async () => {
    const uploadId = 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE'
    const boxes = Array.from({ length: 16_385 }, () => box('free'))
    const value = Buffer.concat(boxes)
    const { chunk } = await storeOne(uploadId, value)
    await assert.rejects(
      assembleSermonMediaObject({
        uploadId,
        communityNamespace: COMMUNITY_NAMESPACE,
        chunks: [chunk],
        expectedSha256: digest(value),
        expectedSizeBytes: value.byteLength,
        expectedMediaType: 'audio/mp4',
      }),
      (error: unknown) =>
        error instanceof SermonMediaError
        && error.code === 'INVALID_MEDIA_CONTAINER',
    )
  })
})

test('object namespaces are stable and isolate the same digest by Community', () => {
  const first = sermonMediaCommunityNamespace(7)
  const restored = sermonMediaCommunityNamespace(7)
  const other = sermonMediaCommunityNamespace(8)
  const digestValue = 'a'.repeat(64)
  assert.equal(first, restored)
  assert.notEqual(first, other)
  assert.notEqual(
    sermonMediaObjectKey(first, digestValue),
    sermonMediaObjectKey(other, digestValue),
  )
})

test('terminal cleanup never follows a staging symlink', async () => {
  await withStorage(async root => {
    const uploadId = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
    const outside = await mkdtemp(path.join(tmpdir(), 'heritage-outside-'))
    try {
      await writeFile(path.join(outside, 'keep.txt'), 'keep')
      await mkdir(path.join(root, 'staging'), { recursive: true })
      await symlink(outside, path.join(root, 'staging', uploadId))
      await assert.rejects(
        cleanupSermonMediaStaging(uploadId),
        (error: unknown) =>
          error instanceof SermonMediaError
          && error.code === 'STORAGE_UNAVAILABLE',
      )
      assert.equal(
        await readFile(path.join(outside, 'keep.txt'), 'utf8'),
        'keep',
      )
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })
})

test('runtime sweep commits expiry before deleting terminal staging', async () => {
  await withStorage(async root => {
    const uploadId = 'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII'
    const stagingFile = path.join(
      root,
      'staging',
      uploadId,
      'chunks',
      '00000000.chunk',
    )
    await mkdir(path.dirname(stagingFile), { recursive: true })
    await writeFile(stagingFile, 'pending terminal cleanup')

    const events: string[] = []
    let nextTransaction = 0
    let cleanupPhaseCall = 0
    const sessions = {
      '1': {
        db: {
          execute: async () => {
            events.push('expire')
            return [{ uploadId }]
          },
        },
      },
      '2': {
        db: {
          execute: async () => {
            cleanupPhaseCall += 1
            if (cleanupPhaseCall === 1) {
              events.push('select-terminal')
              return [{ id: 17, uploadId }]
            }
            if (cleanupPhaseCall === 2) {
              await assert.rejects(
                access(stagingFile),
                (error: unknown) =>
                  (error as NodeJS.ErrnoException)?.code === 'ENOENT',
              )
              events.push('mark-cleaned')
              return []
            }
            if (cleanupPhaseCall === 3) {
              events.push('capacity')
              return [{
                activeUploads: '0',
                finalizingUploads: '0',
                reservedBytes: '0',
              }]
            }
            if (cleanupPhaseCall === 4) {
              events.push('retained')
              return [{
                retainedObjects: '0',
                retainedBytes: '0',
              }]
            }
            throw new Error('Unexpected maintenance database call.')
          },
        },
      },
    }
    const payload = {
      db: {
        sessions,
        beginTransaction: async () => {
          nextTransaction += 1
          events.push(`begin-${nextTransaction}`)
          return nextTransaction
        },
        commitTransaction: async (transactionId: number) => {
          events.push(`commit-${transactionId}`)
        },
        rollbackTransaction: async (transactionId: number) => {
          events.push(`rollback-${transactionId}`)
        },
      },
    }
    const result = await sweepSermonMediaUploads(payload as never)
    assert.equal(result.expiredUploads, 1)
    assert.equal(result.cleanedStaging, 1)
    assert.deepEqual(events, [
      'begin-1',
      'expire',
      'commit-1',
      'begin-2',
      'select-terminal',
      'mark-cleaned',
      'capacity',
      'retained',
      'commit-2',
    ])

    const uncommittedUploadId = 'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ'
    const uncommittedFile = path.join(
      root,
      'staging',
      uncommittedUploadId,
      'chunks',
      '00000000.chunk',
    )
    await mkdir(path.dirname(uncommittedFile), { recursive: true })
    await writeFile(uncommittedFile, 'must survive ambiguous expiry')
    const failingPayload = {
      db: {
        sessions: {
          '1': {
            db: {
              execute: async () => [{ uploadId: uncommittedUploadId }],
            },
          },
        },
        beginTransaction: async () => 1,
        commitTransaction: async () => {
          throw new Error('simulated expiry commit failure')
        },
        rollbackTransaction: async () => undefined,
      },
    }
    await assert.rejects(
      sweepSermonMediaUploads(failingPayload as never),
      /simulated expiry commit failure/,
    )
    await access(uncommittedFile)
  })
})

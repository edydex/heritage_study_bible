import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { PayloadRequest } from 'payload'
import sharp from 'sharp'
import {
  ServiceDocumentAssetError,
  readServiceDocumentAsset,
  storeServiceDocumentAsset,
} from '../src/lib/syncshow/ServiceDocumentAssetStore.ts'

function request(bytes: Buffer, metadata: {
  width: number
  height: number
}) {
  return {
    headers: new Headers({
      'content-type': 'image/png',
      'content-length': String(bytes.length),
      'x-heritage-asset-width': String(metadata.width),
      'x-heritage-asset-height': String(metadata.height),
      'x-heritage-asset-orientation': '1',
    }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
  } as PayloadRequest
}

function managerRequest(bytes: Buffer) {
  return {
    headers: new Headers({
      'content-type': 'image/png',
      'content-length': String(bytes.length),
    }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
  } as PayloadRequest
}

function videoRequest(bytes: Buffer, mediaType = 'video/mp4') {
  return {
    headers: new Headers({
      'content-type': mediaType,
      'content-length': String(bytes.length),
    }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 7))
        controller.enqueue(bytes.subarray(7))
        controller.close()
      },
    }),
  } as PayloadRequest
}

test('stores and reads an exact tenant-private service image', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'heritage-service-assets-'))
  const previous = process.env.HERITAGE_SERMON_MEDIA_PATH
  process.env.HERITAGE_SERMON_MEDIA_PATH = root
  try {
    const bytes = await sharp({
      create: {
        width: 32,
        height: 18,
        channels: 4,
        background: '#123456',
      },
    }).png().toBuffer()
    const sha256 = (await import('node:crypto'))
      .createHash('sha256')
      .update(bytes)
      .digest('hex')
    const stored = await storeServiceDocumentAsset(
      request(bytes, { width: 32, height: 18 }),
      17,
      `sha256:${sha256}`,
    )
    assert.deepEqual(await readServiceDocumentAsset(17, {
      ...stored,
      kind: 'image',
    }), bytes)
    const managerStored = await storeServiceDocumentAsset(
      managerRequest(bytes),
      17,
      `sha256:${sha256}`,
      { requireDeclaredMetadata: false },
    )
    assert.equal(managerStored.width, 32)
    assert.equal(managerStored.height, 18)
    assert.equal(managerStored.orientation, 1)
    await assert.rejects(
      readServiceDocumentAsset(18, { ...stored, kind: 'image' }),
      error => error instanceof ServiceDocumentAssetError
        && error.code === 'SERVICE_ASSET_NOT_FOUND',
    )
  } finally {
    if (previous === undefined) delete process.env.HERITAGE_SERMON_MEDIA_PATH
    else process.env.HERITAGE_SERMON_MEDIA_PATH = previous
    await rm(root, { recursive: true, force: true })
  }
})

test('streams and reads an exact tenant-private service video', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'heritage-service-video-'))
  const previous = process.env.HERITAGE_SERMON_MEDIA_PATH
  process.env.HERITAGE_SERMON_MEDIA_PATH = root
  try {
    const bytes = Buffer.alloc(48)
    bytes.writeUInt32BE(bytes.length, 0)
    bytes.write('ftyp', 4, 'ascii')
    bytes.write('isom', 8, 'ascii')
    const sha256 = (await import('node:crypto'))
      .createHash('sha256')
      .update(bytes)
      .digest('hex')
    const stored = await storeServiceDocumentAsset(
      videoRequest(bytes),
      17,
      `sha256:${sha256}`,
    )
    assert.deepEqual(stored, {
      id: `sha256:${sha256}`,
      kind: 'video',
      sha256,
      mediaType: 'video/mp4',
      size: bytes.length,
    })
    assert.deepEqual(await readServiceDocumentAsset(17, stored), bytes)
    await assert.rejects(
      storeServiceDocumentAsset(
        videoRequest(bytes, 'video/webm'),
        17,
        `sha256:${sha256}`,
      ),
      error => error instanceof ServiceDocumentAssetError
        && error.code === 'INVALID_SERVICE_ASSET',
    )

    const fake = Buffer.from('not an mp4 video')
    const fakeSha256 = (await import('node:crypto'))
      .createHash('sha256')
      .update(fake)
      .digest('hex')
    await assert.rejects(
      storeServiceDocumentAsset(videoRequest(fake), 17, `sha256:${fakeSha256}`),
      error => error instanceof ServiceDocumentAssetError
        && error.code === 'INVALID_SERVICE_ASSET',
    )
  } finally {
    if (previous === undefined) delete process.env.HERITAGE_SERMON_MEDIA_PATH
    else process.env.HERITAGE_SERMON_MEDIA_PATH = previous
    await rm(root, { recursive: true, force: true })
  }
})

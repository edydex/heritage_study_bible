import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import sharp from 'sharp'
import {
  readPrivateSermonObject,
  sermonMediaObjectKey,
  storePrivateSermonObject,
  storePrivateStreamObject,
} from './SermonMediaStorage.ts'
import { sermonMediaCommunityNamespace } from './SermonMediaStore.ts'

export const MAX_SERVICE_DOCUMENT_ASSET_BYTES = 75 * 1024 * 1024
export const MAX_SERVICE_DOCUMENT_VIDEO_BYTES = 250 * 1024 * 1024
export const MAX_SERVICE_DOCUMENT_ASSET_PIXELS = 100_000_000

const ASSET_ID_PATTERN = /^sha256:([a-f0-9]{64})$/
const MEDIA_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpeg'],
  ['image/webp', 'webp'],
])
const VIDEO_TYPES = new Map([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
])

type ServiceAssetMetadata = Readonly<{
  id: string
  kind?: 'image' | 'video'
  sha256: string
  mediaType: string
  size: number
  width?: number
  height?: number
  orientation?: number
}>

export class ServiceDocumentAssetError extends Error {
  code: string
  status: number
  retryable: boolean

  constructor(code: string, message: string, status = 422, retryable = false) {
    super(message)
    this.name = 'ServiceDocumentAssetError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

function fail(code: string, message: string, status = 422): never {
  throw new ServiceDocumentAssetError(code, message, status)
}

export function serviceDocumentAssetId(value: unknown) {
  const id = String(value || '')
  const match = ASSET_ID_PATTERN.exec(id)
  if (!match) fail('INVALID_SERVICE_ASSET_ID', 'Service media identity is invalid.', 404)
  return Object.freeze({ id, sha256: match[1] })
}

function positiveHeader(req: PayloadRequest, name: string, maximum: number) {
  const source = req.headers.get(name)
  if (!source || !/^[1-9]\d*$/.test(source)) {
    fail('INVALID_SERVICE_ASSET_METADATA', 'Service media metadata is incomplete.')
  }
  const value = Number(source)
  if (!Number.isSafeInteger(value) || value > maximum) {
    fail('INVALID_SERVICE_ASSET_METADATA', 'Service media metadata is invalid.')
  }
  return value
}

function optionalPositiveHeader(req: PayloadRequest, name: string, maximum: number) {
  const source = req.headers.get(name)
  if (source == null || source === '') return null
  if (!/^[1-9]\d*$/.test(source)) {
    fail('INVALID_SERVICE_ASSET_METADATA', 'Service image metadata is invalid.')
  }
  const value = Number(source)
  if (!Number.isSafeInteger(value) || value > maximum) {
    fail('INVALID_SERVICE_ASSET_METADATA', 'Service image metadata is invalid.')
  }
  return value
}

async function boundedBody(req: PayloadRequest, expectedSize: number, maximumBytes: number) {
  if (!req.body) fail('INVALID_SERVICE_ASSET', 'Service media body is missing.')
  const reader = req.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > expectedSize || size > maximumBytes) {
        await reader.cancel('service media exceeded its declared size')
          .catch(() => undefined)
        fail('SERVICE_ASSET_SIZE_MISMATCH', 'Service media size does not match its metadata.', 413)
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock?.()
  }
  if (size !== expectedSize) {
    fail('SERVICE_ASSET_SIZE_MISMATCH', 'Service media size does not match its metadata.')
  }
  return Buffer.concat(chunks, size)
}

export async function storeServiceDocumentAsset(
  req: PayloadRequest,
  communityId: number,
  routeAssetId: unknown,
  options: { requireDeclaredMetadata?: boolean } = {},
): Promise<ServiceAssetMetadata> {
  const identity = serviceDocumentAssetId(routeAssetId)
  const mediaType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  const expectedImageFormat = MEDIA_TYPES.get(mediaType)
  const expectedVideoFormat = VIDEO_TYPES.get(mediaType)
  if (!expectedImageFormat && !expectedVideoFormat) {
    fail(
      'INVALID_SERVICE_ASSET_TYPE',
      'Service media must be PNG, JPEG, WebP, MP4, or WebM.',
      415,
    )
  }
  const maximumBytes = expectedVideoFormat
    ? MAX_SERVICE_DOCUMENT_VIDEO_BYTES
    : MAX_SERVICE_DOCUMENT_ASSET_BYTES
  const size = positiveHeader(req, 'content-length', maximumBytes)
  const communityNamespace = sermonMediaCommunityNamespace(communityId)

  if (expectedVideoFormat) {
    try {
      await storePrivateStreamObject({
        body: req.body ?? null,
        communityNamespace,
        expectedSha256: identity.sha256,
        expectedSize: size,
        maximumBytes,
        validateHead: head => (
          expectedVideoFormat === 'mp4'
            ? head.byteLength >= 12
              && Buffer.from(head).subarray(4, 8).toString('ascii') === 'ftyp'
            : head.byteLength >= 4
              && head[0] === 0x1a
              && head[1] === 0x45
              && head[2] === 0xdf
              && head[3] === 0xa3
        ),
      })
    } catch (error) {
      if (['INVALID_PRIVATE_OBJECT', 'CONTENT_LENGTH_MISMATCH', 'CHUNK_HASH_MISMATCH']
        .includes(String((error as { code?: unknown })?.code || ''))) {
        fail('INVALID_SERVICE_ASSET', 'Service video upload failed validation.')
      }
      throw new ServiceDocumentAssetError(
        'SERVICE_ASSET_STORAGE_UNAVAILABLE',
        'Community could not retain the private service video.',
        503,
        true,
      )
    }
    return Object.freeze({
      ...identity,
      kind: 'video' as const,
      mediaType,
      size,
    }) satisfies ServiceAssetMetadata
  }

  const requireDeclaredMetadata = options.requireDeclaredMetadata !== false
  const declaredWidth = requireDeclaredMetadata
    ? positiveHeader(req, 'x-heritage-asset-width', 32768)
    : optionalPositiveHeader(req, 'x-heritage-asset-width', 32768)
  const declaredHeight = requireDeclaredMetadata
    ? positiveHeader(req, 'x-heritage-asset-height', 32768)
    : optionalPositiveHeader(req, 'x-heritage-asset-height', 32768)
  const declaredOrientation = requireDeclaredMetadata
    ? positiveHeader(req, 'x-heritage-asset-orientation', 8)
    : optionalPositiveHeader(req, 'x-heritage-asset-orientation', 8)
  if ((declaredWidth || 0) * (declaredHeight || 0) > MAX_SERVICE_DOCUMENT_ASSET_PIXELS) {
    fail('SERVICE_ASSET_PIXEL_LIMIT', 'Service image dimensions are too large.', 413)
  }
  const bytes = await boundedBody(req, size, maximumBytes)
  if (createHash('sha256').update(bytes).digest('hex') !== identity.sha256) {
    fail('SERVICE_ASSET_HASH_MISMATCH', 'Service image failed its content checksum.')
  }
  let metadata
  try {
    metadata = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: MAX_SERVICE_DOCUMENT_ASSET_PIXELS,
    }).metadata()
  } catch {
    fail('INVALID_SERVICE_ASSET', 'Service image container is invalid.')
  }
  const actualOrientation = Number.isSafeInteger(metadata.orientation)
    ? Number(metadata.orientation)
    : 1
  const width = Number(metadata.width)
  const height = Number(metadata.height)
  if (
    metadata.format !== expectedImageFormat
    || !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width < 1
    || height < 1
    || width > 32768
    || height > 32768
    || width * height > MAX_SERVICE_DOCUMENT_ASSET_PIXELS
    || (declaredWidth !== null && declaredWidth !== width)
    || (declaredHeight !== null && declaredHeight !== height)
    || (declaredOrientation !== null && declaredOrientation !== actualOrientation)
  ) {
    fail('SERVICE_ASSET_METADATA_MISMATCH', 'Service image does not match its declared metadata.')
  }
  try {
    await storePrivateSermonObject({
      bytes,
      communityNamespace,
      expectedSha256: identity.sha256,
      maximumBytes: MAX_SERVICE_DOCUMENT_ASSET_BYTES,
    })
  } catch (error) {
    throw new ServiceDocumentAssetError(
      'SERVICE_ASSET_STORAGE_UNAVAILABLE',
      'Community could not retain the private service image.',
      503,
      true,
    )
  }
  return Object.freeze({
    ...identity,
    kind: 'image' as const,
    mediaType,
    size,
    width,
    height,
    orientation: actualOrientation,
  }) satisfies ServiceAssetMetadata
}

export async function readServiceDocumentAsset(
  communityId: number,
  rawAsset: unknown,
) {
  const asset = rawAsset as Partial<ServiceAssetMetadata> | null
  const identity = serviceDocumentAssetId(asset?.id)
  const kind = asset?.kind === 'video' ? 'video' : 'image'
  const maximumBytes = kind === 'video'
    ? MAX_SERVICE_DOCUMENT_VIDEO_BYTES
    : MAX_SERVICE_DOCUMENT_ASSET_BYTES
  if (
    asset?.sha256 !== identity.sha256
    || asset?.id !== identity.id
    || !(kind === 'video' ? VIDEO_TYPES : MEDIA_TYPES).has(String(asset?.mediaType || ''))
    || !Number.isSafeInteger(asset?.size)
    || Number(asset?.size) < 1
    || Number(asset?.size) > maximumBytes
  ) {
    fail('INVALID_SERVICE_ASSET_METADATA', 'Shared service media metadata is invalid.', 500)
  }
  try {
    return await readPrivateSermonObject({
      storageKey: sermonMediaObjectKey(
        sermonMediaCommunityNamespace(communityId),
        identity.sha256,
      ),
      sha256: identity.sha256,
      sizeBytes: Number(asset?.size),
    }, maximumBytes)
  } catch {
    fail('SERVICE_ASSET_NOT_FOUND', 'The shared service media is unavailable.', 404)
  }
}

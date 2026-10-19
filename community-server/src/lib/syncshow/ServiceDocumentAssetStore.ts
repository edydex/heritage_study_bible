import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import sharp from 'sharp'
import {
  readPrivateSermonObject,
  sermonMediaObjectKey,
  storePrivateSermonObject,
} from './SermonMediaStorage.ts'
import { sermonMediaCommunityNamespace } from './SermonMediaStore.ts'

export const MAX_SERVICE_DOCUMENT_ASSET_BYTES = 75 * 1024 * 1024
export const MAX_SERVICE_DOCUMENT_ASSET_PIXELS = 100_000_000

const ASSET_ID_PATTERN = /^sha256:([a-f0-9]{64})$/
const MEDIA_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpeg'],
  ['image/webp', 'webp'],
])

type ServiceAssetMetadata = Readonly<{
  id: string
  sha256: string
  mediaType: string
  size: number
  width: number
  height: number
  orientation: number
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
  if (!match) fail('INVALID_SERVICE_ASSET_ID', 'Service image identity is invalid.', 404)
  return Object.freeze({ id, sha256: match[1] })
}

function positiveHeader(req: PayloadRequest, name: string, maximum: number) {
  const source = req.headers.get(name)
  if (!source || !/^[1-9]\d*$/.test(source)) {
    fail('INVALID_SERVICE_ASSET_METADATA', 'Service image metadata is incomplete.')
  }
  const value = Number(source)
  if (!Number.isSafeInteger(value) || value > maximum) {
    fail('INVALID_SERVICE_ASSET_METADATA', 'Service image metadata is invalid.')
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

async function boundedBody(req: PayloadRequest, expectedSize: number) {
  if (!req.body) fail('INVALID_SERVICE_ASSET', 'Service image body is missing.')
  const reader = req.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > expectedSize || size > MAX_SERVICE_DOCUMENT_ASSET_BYTES) {
        await reader.cancel('service image exceeded its declared size')
          .catch(() => undefined)
        fail('SERVICE_ASSET_SIZE_MISMATCH', 'Service image size does not match its metadata.', 413)
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock?.()
  }
  if (size !== expectedSize) {
    fail('SERVICE_ASSET_SIZE_MISMATCH', 'Service image size does not match its metadata.')
  }
  return Buffer.concat(chunks, size)
}

export async function storeServiceDocumentAsset(
  req: PayloadRequest,
  communityId: number,
  routeAssetId: unknown,
  options: { requireDeclaredMetadata?: boolean } = {},
) {
  const identity = serviceDocumentAssetId(routeAssetId)
  const mediaType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  const expectedFormat = MEDIA_TYPES.get(mediaType)
  if (!expectedFormat) {
    fail('INVALID_SERVICE_ASSET_TYPE', 'Service images must be PNG, JPEG, or WebP.', 415)
  }
  const size = positiveHeader(req, 'content-length', MAX_SERVICE_DOCUMENT_ASSET_BYTES)
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
  const bytes = await boundedBody(req, size)
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
    metadata.format !== expectedFormat
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
      communityNamespace: sermonMediaCommunityNamespace(communityId),
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
  if (
    asset?.sha256 !== identity.sha256
    || asset?.id !== identity.id
    || !MEDIA_TYPES.has(String(asset?.mediaType || ''))
    || !Number.isSafeInteger(asset?.size)
    || Number(asset?.size) < 1
    || Number(asset?.size) > MAX_SERVICE_DOCUMENT_ASSET_BYTES
  ) {
    fail('INVALID_SERVICE_ASSET_METADATA', 'Shared service image metadata is invalid.', 500)
  }
  try {
    return await readPrivateSermonObject({
      storageKey: sermonMediaObjectKey(
        sermonMediaCommunityNamespace(communityId),
        identity.sha256,
      ),
      sha256: identity.sha256,
      sizeBytes: Number(asset?.size),
    }, MAX_SERVICE_DOCUMENT_ASSET_BYTES)
  } catch {
    fail('SERVICE_ASSET_NOT_FOUND', 'The shared service image is unavailable.', 404)
  }
}

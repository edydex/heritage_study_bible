import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto'
import {
  MAX_SERMON_SOURCE_EXTRACTED_TEXT_BYTES,
  MAX_SERMON_SOURCE_UPLOAD_BYTES,
  SERMON_SOURCE_EXTRACTOR,
  SERMON_SOURCE_EXTRACTION_SCHEMA_VERSION,
  type SermonSourceExtraction,
} from './SermonSourceExtraction.ts'
import {
  readPrivateSermonObject,
  sermonMediaObjectKey,
  type StoredSermonMediaObject,
} from './SermonMediaStorage.ts'
import { sermonMediaCommunityNamespace } from './SermonMediaStore.ts'

const TOKEN_SCHEMA_VERSION = 1
const SHA256_PATTERN = /^[a-f0-9]{64}$/

type TokenPayload = Readonly<{
  schemaVersion: typeof TOKEN_SCHEMA_VERSION
  communityId: number
  fileName: string
  format: SermonSourceExtraction['format']
  mediaType: string
  sizeBytes: number
  sha256: string
  extractedTextSizeBytes: number
  extractedTextSha256: string
  extractor: typeof SERMON_SOURCE_EXTRACTOR
  suggestedKind: SermonSourceExtraction['suggestedKind']
}>

export type RetainedSermonSource = Readonly<{
  token: string
  payload: TokenPayload
  extractedText: string
}>

export class SermonSourceUploadTokenError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 422) {
    super(message)
    this.name = 'SermonSourceUploadTokenError'
    this.code = code
    this.status = status
  }
}

function fail(code: string, message: string, status = 422): never {
  throw new SermonSourceUploadTokenError(code, message, status)
}

function secret() {
  const value = process.env.PAYLOAD_SECRET || ''
  if (Buffer.byteLength(value, 'utf8') < 32) {
    fail(
      'SOURCE_TOKEN_UNAVAILABLE',
      'Private pastor-source review is not configured.',
      503,
    )
  }
  return value
}

function signature(source: string) {
  return createHmac('sha256', secret())
    .update('heritage-sermon-source-upload-v1\0', 'utf8')
    .update(source, 'ascii')
    .digest('base64url')
}

function canonicalPayload(extraction: SermonSourceExtraction, communityId: number): TokenPayload {
  if (!Number.isSafeInteger(communityId) || communityId < 1) {
    fail('INVALID_COMMUNITY', 'The pastor source has no valid Community.')
  }
  const extractedTextSizeBytes = Buffer.byteLength(extraction.extractedText, 'utf8')
  return Object.freeze({
    schemaVersion: TOKEN_SCHEMA_VERSION,
    communityId,
    fileName: extraction.fileName,
    format: extraction.format,
    mediaType: extraction.mediaType,
    sizeBytes: extraction.sizeBytes,
    sha256: extraction.sha256,
    extractedTextSizeBytes,
    extractedTextSha256: extraction.extractedTextSha256,
    extractor: extraction.extractor,
    suggestedKind: extraction.suggestedKind,
  })
}

function encodePayload(payload: TokenPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function createSermonSourceUploadToken(
  extraction: SermonSourceExtraction,
  communityId: number,
) {
  const source = encodePayload(canonicalPayload(extraction, communityId))
  return `${source}.${signature(source)}`
}

function parsePayload(token: unknown, expectedCommunityId: number): TokenPayload {
  if (typeof token !== 'string' || token.length < 80 || token.length > 4096) {
    fail('INVALID_SOURCE_TOKEN', 'The retained pastor source token is invalid.')
  }
  const [source, supplied, extra] = token.split('.')
  if (!source || !supplied || extra !== undefined) {
    fail('INVALID_SOURCE_TOKEN', 'The retained pastor source token is invalid.')
  }
  const expected = signature(source)
  const expectedBytes = Buffer.from(expected, 'ascii')
  const suppliedBytes = Buffer.from(supplied, 'ascii')
  if (
    expectedBytes.length !== suppliedBytes.length
    || !timingSafeEqual(expectedBytes, suppliedBytes)
  ) {
    fail('INVALID_SOURCE_TOKEN', 'The retained pastor source token is invalid.')
  }
  let value: Record<string, unknown>
  try {
    value = JSON.parse(Buffer.from(source, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    fail('INVALID_SOURCE_TOKEN', 'The retained pastor source token is invalid.')
  }
  const expectedKeys = [
    'schemaVersion',
    'communityId',
    'fileName',
    'format',
    'mediaType',
    'sizeBytes',
    'sha256',
    'extractedTextSizeBytes',
    'extractedTextSha256',
    'extractor',
    'suggestedKind',
  ].sort()
  const actualKeys = Object.keys(value).sort()
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
    || value.schemaVersion !== TOKEN_SCHEMA_VERSION
    || value.communityId !== expectedCommunityId
    || typeof value.fileName !== 'string'
    || !value.fileName
    || value.fileName.length > 255
    || !['pdf', 'docx', 'pptx', 'markdown', 'text'].includes(String(value.format))
    || typeof value.mediaType !== 'string'
    || !Number.isSafeInteger(value.sizeBytes)
    || Number(value.sizeBytes) < 1
    || Number(value.sizeBytes) > MAX_SERMON_SOURCE_UPLOAD_BYTES
    || typeof value.sha256 !== 'string'
    || !SHA256_PATTERN.test(value.sha256)
    || !Number.isSafeInteger(value.extractedTextSizeBytes)
    || Number(value.extractedTextSizeBytes) < 1
    || Number(value.extractedTextSizeBytes) > MAX_SERMON_SOURCE_EXTRACTED_TEXT_BYTES
    || typeof value.extractedTextSha256 !== 'string'
    || !SHA256_PATTERN.test(value.extractedTextSha256)
    || value.extractor !== SERMON_SOURCE_EXTRACTOR
    || !['manuscript', 'slide-notes'].includes(String(value.suggestedKind))
  ) {
    fail('INVALID_SOURCE_TOKEN', 'The retained pastor source token is invalid.')
  }
  return Object.freeze(value as TokenPayload)
}

function descriptor(
  communityId: number,
  sha256: string,
  sizeBytes: number,
): StoredSermonMediaObject {
  return Object.freeze({
    storageKey: sermonMediaObjectKey(
      sermonMediaCommunityNamespace(communityId),
      sha256,
    ),
    sha256,
    sizeBytes,
  })
}

export async function retainSermonSourceFromToken(
  token: unknown,
  communityId: number,
): Promise<RetainedSermonSource> {
  const payload = parsePayload(token, communityId)
  // Verify both layers still exist. The exact original remains private; only
  // the deterministic extraction is materialized for the review form.
  await readPrivateSermonObject(
    descriptor(communityId, payload.sha256, payload.sizeBytes),
    MAX_SERMON_SOURCE_UPLOAD_BYTES,
  )
  const extracted = await readPrivateSermonObject(
    descriptor(
      communityId,
      payload.extractedTextSha256,
      payload.extractedTextSizeBytes,
    ),
    MAX_SERMON_SOURCE_EXTRACTED_TEXT_BYTES,
  )
  let extractedText: string
  try {
    extractedText = new TextDecoder('utf-8', { fatal: true }).decode(extracted)
  } catch {
    fail('SOURCE_EXTRACTION_CORRUPT', 'The retained deterministic extraction is not valid UTF-8.', 500)
  }
  if (
    Buffer.byteLength(extractedText, 'utf8') !== payload.extractedTextSizeBytes
    || createHash('sha256')
      .update(extractedText, 'utf8')
      .digest('hex') !== payload.extractedTextSha256
  ) {
    fail('SOURCE_EXTRACTION_CORRUPT', 'The retained deterministic extraction is invalid.', 500)
  }
  return Object.freeze({ token: String(token), payload, extractedText })
}

export { SERMON_SOURCE_EXTRACTION_SCHEMA_VERSION }

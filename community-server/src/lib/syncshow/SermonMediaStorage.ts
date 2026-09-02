import { createHash, randomBytes } from 'node:crypto'
import {
  constants,
} from 'node:fs'
import {
  lstat,
  link,
  mkdir,
  open,
  readdir,
  rename,
  rmdir,
  stat,
  statfs,
  unlink,
} from 'node:fs/promises'
import path from 'node:path'
import {
  SERMON_MEDIA_MAXIMUM_BYTES,
  SermonMediaError,
  type SermonMediaChunkHeaders,
} from './SermonMedia.ts'

const UPLOAD_ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const CHUNK_KEY_PATTERN =
  /^staging\/[A-Za-z0-9_-]{32,128}\/chunks\/[0-9]{8}-[a-f0-9]{64}\.chunk$/
const OBJECT_KEY_PATTERN =
  /^objects\/[a-f0-9]{64}\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/
const FILE_MODE = 0o600
const DIRECTORY_MODE = 0o700
const CHUNK_STREAM_INACTIVITY_MS = 45_000
const CHUNK_STREAM_TOTAL_MS = 15 * 60 * 1000

export type StoredSermonMediaChunk = Readonly<{
  storageKey: string
  sha256: string
  sizeBytes: number
}>

export type StoredSermonMediaObject = Readonly<{
  storageKey: string
  sha256: string
  sizeBytes: number
}>

type AcceptedMediaType = 'audio/mpeg' | 'audio/mp4'

type ChunkStreamTiming = Readonly<{
  inactivityMs: number
  totalMs: number
}>

function chunkStreamTiming(
  override: Partial<ChunkStreamTiming> | undefined,
): ChunkStreamTiming {
  const inactivityMs =
    override?.inactivityMs ?? CHUNK_STREAM_INACTIVITY_MS
  const totalMs = override?.totalMs ?? CHUNK_STREAM_TOTAL_MS
  if (
    !Number.isSafeInteger(inactivityMs)
    || inactivityMs < 1
    || !Number.isSafeInteger(totalMs)
    || totalMs < inactivityMs
  ) {
    throw new SermonMediaError(
      'INVALID_STREAM_TIMING',
      'The recording chunk stream timing is invalid.',
      500,
    )
  }
  return Object.freeze({ inactivityMs, totalMs })
}

function storageError(message: string, cause?: unknown): SermonMediaError {
  const error = new SermonMediaError(
    'STORAGE_UNAVAILABLE',
    message,
    503,
    true,
  )
  if (cause !== undefined) {
    Object.defineProperty(error, 'cause', {
      configurable: true,
      value: cause,
    })
  }
  return error
}

export function sermonMediaStorageRoot() {
  const configured =
    process.env.HERITAGE_SERMON_MEDIA_PATH || '/app/private/sermon-media'
  if (
    !path.isAbsolute(configured)
    || configured.includes('\0')
    || path.normalize(configured) !== configured
  ) {
    throw storageError(
      'HERITAGE_SERMON_MEDIA_PATH must be a normalized absolute path.',
    )
  }
  return configured
}

function assertUploadId(value: string) {
  if (!UPLOAD_ID_PATTERN.test(value)) {
    throw new SermonMediaError(
      'INVALID_UPLOAD_ID',
      'The recording upload ID is invalid.',
      404,
    )
  }
}

function assertDigest(value: string) {
  if (!SHA256_PATTERN.test(value)) {
    throw new SermonMediaError(
      'INVALID_SHA256',
      'A lowercase SHA-256 digest is required.',
    )
  }
}

function absoluteStoragePath(root: string, relativeKey: string) {
  if (
    relativeKey.startsWith('/')
    || relativeKey.includes('\\')
    || relativeKey.split('/').some(segment =>
      !segment || segment === '.' || segment === '..'
    )
  ) {
    throw storageError('A sermon-media storage key is invalid.')
  }
  const resolved = path.resolve(root, ...relativeKey.split('/'))
  const prefix = `${root}${path.sep}`
  if (!resolved.startsWith(prefix)) {
    throw storageError('A sermon-media storage key escaped its root.')
  }
  return resolved
}

async function assertDirectoryNotSymlink(value: string) {
  const metadata = await lstat(value)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw storageError(
      'Sermon-media storage contains a symbolic link or non-directory component.',
    )
  }
}

async function ensureRoot(root: string) {
  let created = false
  try {
    await mkdir(root, { mode: DIRECTORY_MODE })
    created = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') {
      throw storageError(
        'The private sermon-media storage root is unavailable.',
        error,
      )
    }
  }
  try {
    await assertDirectoryNotSymlink(root)
    if (created) await fsyncDirectory(path.dirname(root))
  } catch (error) {
    if (error instanceof SermonMediaError) throw error
    throw storageError('The private sermon-media storage root is unavailable.', error)
  }
}

async function ensurePrivateDirectory(root: string, relative: string) {
  await ensureRoot(root)
  let current = root
  for (const segment of relative.split('/')) {
    if (!segment || segment === '.' || segment === '..') {
      throw storageError('A sermon-media directory key is invalid.')
    }
    const parent = current
    current = path.join(parent, segment)
    let created = false
    try {
      await mkdir(current, { mode: DIRECTORY_MODE })
      created = true
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      if (code !== 'EEXIST') {
        throw storageError(
          'The private sermon-media staging directory is unavailable.',
          error,
        )
      }
    }
    try {
      await assertDirectoryNotSymlink(current)
      if (created) await fsyncDirectory(parent)
    } catch (error) {
      if (error instanceof SermonMediaError) throw error
      throw storageError(
        'The private sermon-media staging directory is unavailable.',
        error,
      )
    }
  }
  return current
}

async function fsyncDirectory(value: string) {
  let handle
  try {
    handle = await open(value, constants.O_RDONLY)
    await handle.sync()
  } finally {
    await handle?.close()
  }
}

async function verifyRegularFile(
  value: string,
  expectedSize: number,
  expectedSha256: string,
  validateHead: ((head: Uint8Array) => boolean) | null = null,
) {
  const metadata = await lstat(value)
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw storageError(
      'Sermon-media storage contains a symbolic link or non-file object.',
    )
  }
  if (metadata.size !== expectedSize) return false
  const hash = createHash('sha256')
  const head = Buffer.alloc(Math.min(64, expectedSize))
  let headSize = 0
  const handle = await open(
    value,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  )
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    let position = 0
    while (true) {
      const result = await handle.read(
        buffer,
        0,
        buffer.length,
        position,
      )
      if (!result.bytesRead) break
      if (headSize < head.length) {
        const retained = Math.min(result.bytesRead, head.length - headSize)
        buffer.copy(head, headSize, 0, retained)
        headSize += retained
      }
      position += result.bytesRead
      hash.update(buffer.subarray(0, result.bytesRead))
    }
  } finally {
    await handle.close()
  }
  if (hash.digest('hex') !== expectedSha256) return false
  if (validateHead && !validateHead(head.subarray(0, headSize))) {
    throw new SermonMediaError(
      'INVALID_PRIVATE_OBJECT',
      'The existing private service asset container is invalid.',
      422,
    )
  }
  return true
}

async function removeTemp(value: string) {
  try {
    const metadata = await lstat(value)
    if (!metadata.isSymbolicLink() && metadata.isFile()) await unlink(value)
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
  }
}

async function readExactly(
  handle: Awaited<ReturnType<typeof open>>,
  position: number,
  size: number,
) {
  const result = Buffer.alloc(size)
  let offset = 0
  while (offset < size) {
    const read = await handle.read(
      result,
      offset,
      size - offset,
      position + offset,
    )
    if (!read.bytesRead) return null
    offset += read.bytesRead
  }
  return result
}

function isMpegAudioFrameHeader(value: Buffer, offset: number) {
  if (offset < 0 || offset + 4 > value.length) return false
  const first = value[offset]
  const second = value[offset + 1]
  const third = value[offset + 2]
  const version = second & 0x18
  const layer = second & 0x06
  const bitrate = third & 0xf0
  const sampleRate = third & 0x0c
  return first === 0xff
    && (second & 0xe0) === 0xe0
    && version !== 0x08
    && layer !== 0
    && bitrate !== 0
    && bitrate !== 0xf0
    && sampleRate !== 0x0c
}

async function validateMpegAudio(
  handle: Awaited<ReturnType<typeof open>>,
  sizeBytes: number,
) {
  if (sizeBytes < 8) return false
  const prefix = await readExactly(handle, 0, Math.min(10, sizeBytes))
  if (!prefix) return false
  let audioOffset = 0
  if (prefix.length >= 10 && prefix.subarray(0, 3).toString('ascii') === 'ID3') {
    if (
      prefix[3] === 0xff
      || prefix[4] === 0xff
      || [prefix[6], prefix[7], prefix[8], prefix[9]]
        .some(byte => (byte & 0x80) !== 0)
    ) {
      return false
    }
    const tagSize =
      (prefix[6] << 21)
      | (prefix[7] << 14)
      | (prefix[8] << 7)
      | prefix[9]
    audioOffset = 10 + tagSize + ((prefix[5] & 0x10) ? 10 : 0)
  }
  if (audioOffset < 0 || audioOffset > sizeBytes - 4) return false
  const scanBytes = Math.min(128 * 1024, sizeBytes - audioOffset)
  const scan = await readExactly(handle, audioOffset, scanBytes)
  if (!scan) return false
  let firstFrame = -1
  for (let index = 0; index <= scan.length - 4; index += 1) {
    if (isMpegAudioFrameHeader(scan, index)) {
      firstFrame = index
      break
    }
  }
  if (firstFrame < 0) return false
  // Requiring a second plausible MPEG frame in a bounded window rejects a
  // renamed arbitrary file while tolerating ID3/Xing metadata and VBR audio.
  const secondStart = firstFrame + 24
  const secondEnd = Math.min(scan.length - 4, firstFrame + 4096)
  for (let index = secondStart; index <= secondEnd; index += 1) {
    if (isMpegAudioFrameHeader(scan, index)) return true
  }
  return false
}

type IsoBox = Readonly<{
  type: string
  dataStart: number
  end: number
}>

const MAX_ISO_BOXES = 16_384
type IsoBoxBudget = { remaining: number }

async function isoBoxes(
  handle: Awaited<ReturnType<typeof open>>,
  start: number,
  end: number,
  budget: IsoBoxBudget,
) {
  const boxes: IsoBox[] = []
  let position = start
  while (position < end) {
    budget.remaining -= 1
    if (budget.remaining < 0) return null
    if (end - position < 8) return null
    const header = await readExactly(handle, position, 8)
    if (!header) return null
    let boxSize = header.readUInt32BE(0)
    const type = header.subarray(4, 8).toString('latin1')
    let headerSize = 8
    if (boxSize === 1) {
      const extended = await readExactly(handle, position + 8, 8)
      if (!extended) return null
      const value = extended.readBigUInt64BE(0)
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null
      boxSize = Number(value)
      headerSize = 16
    } else if (boxSize === 0) {
      boxSize = end - position
    }
    if (boxSize < headerSize || position + boxSize > end) return null
    boxes.push({
      type,
      dataStart: position + headerSize,
      end: position + boxSize,
    })
    position += boxSize
  }
  return boxes
}

async function mp4ContainsAudioTrack(
  handle: Awaited<ReturnType<typeof open>>,
  moov: IsoBox,
  budget: IsoBoxBudget,
) {
  const moovBoxes = await isoBoxes(
    handle,
    moov.dataStart,
    moov.end,
    budget,
  )
  if (!moovBoxes) return false
  for (const trak of moovBoxes.filter(box => box.type === 'trak')) {
    const trakBoxes = await isoBoxes(
      handle,
      trak.dataStart,
      trak.end,
      budget,
    )
    if (!trakBoxes) return false
    for (const mdia of trakBoxes.filter(box => box.type === 'mdia')) {
      const mediaBoxes = await isoBoxes(
        handle,
        mdia.dataStart,
        mdia.end,
        budget,
      )
      if (!mediaBoxes) return false
      for (const handler of mediaBoxes.filter(box => box.type === 'hdlr')) {
        if (handler.end - handler.dataStart < 12) return false
        const payload = await readExactly(handle, handler.dataStart, 12)
        if (
          payload
          && payload.subarray(8, 12).toString('ascii') === 'soun'
        ) {
          return true
        }
      }
    }
  }
  return false
}

async function validateMp4Audio(
  handle: Awaited<ReturnType<typeof open>>,
  sizeBytes: number,
) {
  const budget = { remaining: MAX_ISO_BOXES }
  const boxes = await isoBoxes(handle, 0, sizeBytes, budget)
  if (!boxes) return false
  const ftyp = boxes.find(box => box.type === 'ftyp')
  const moov = boxes.find(box => box.type === 'moov')
  if (
    !ftyp
    || !moov
    || ftyp.end - ftyp.dataStart < 8
    || ftyp.end - ftyp.dataStart > 64 * 1024
  ) {
    return false
  }
  const brandData = await readExactly(
    handle,
    ftyp.dataStart,
    ftyp.end - ftyp.dataStart,
  )
  if (!brandData) return false
  const acceptedBrands = new Set([
    'M4A ',
    'M4B ',
    'isom',
    'iso2',
    'mp41',
    'mp42',
  ])
  const brands: string[] = [brandData.subarray(0, 4).toString('latin1')]
  for (let offset = 8; offset + 4 <= brandData.length; offset += 4) {
    brands.push(brandData.subarray(offset, offset + 4).toString('latin1'))
  }
  return brands.some(brand => acceptedBrands.has(brand))
    && await mp4ContainsAudioTrack(handle, moov, budget)
}

async function validateMediaContainer(
  value: string,
  sizeBytes: number,
  mediaType: AcceptedMediaType,
) {
  const handle = await open(
    value,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  )
  try {
    const valid = mediaType === 'audio/mpeg'
      ? await validateMpegAudio(handle, sizeBytes)
      : await validateMp4Audio(handle, sizeBytes)
    if (!valid) {
      throw new SermonMediaError(
        'INVALID_MEDIA_CONTAINER',
        mediaType === 'audio/mpeg'
          ? 'The uploaded recording is not a valid MP3 audio container.'
          : 'The uploaded recording is not a valid MP4/M4A audio container.',
        422,
      )
    }
  } finally {
    await handle.close()
  }
}

async function exclusiveTempFile(directory: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const value = path.join(
      directory,
      `${randomBytes(24).toString('hex')}.tmp`,
    )
    try {
      const handle = await open(
        value,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY
          | constants.O_NOFOLLOW,
        FILE_MODE,
      )
      return { handle, path: value }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') {
        throw storageError(
          'The private sermon-media staging file could not be created.',
          error,
        )
      }
    }
  }
  throw storageError(
    'The private sermon-media staging file could not be allocated.',
  )
}

export function sermonMediaStagingKey(uploadId: string) {
  assertUploadId(uploadId)
  return `staging/${uploadId}`
}

export function sermonMediaChunkKey(
  uploadId: string,
  index: number,
  sha256: string,
) {
  assertUploadId(uploadId)
  assertDigest(sha256)
  if (!Number.isSafeInteger(index) || index < 0 || index > 99_999_999) {
    throw new SermonMediaError(
      'INVALID_CHUNK_INDEX',
      'The recording chunk index is invalid.',
    )
  }
  return `staging/${uploadId}/chunks/${String(index).padStart(8, '0')}-${sha256}.chunk`
}

export function sermonMediaObjectKey(
  communityNamespace: string,
  sha256: string,
) {
  if (!SHA256_PATTERN.test(communityNamespace)) {
    throw storageError('The private Community object namespace is invalid.')
  }
  assertDigest(sha256)
  return `objects/${communityNamespace}/sha256/${sha256.slice(0, 2)}/${sha256}`
}

/**
 * Stores a small, already-buffered private sermon object (pastor original or
 * deterministic text extraction) in the same tenant-isolated,
 * content-addressed store as recordings. Unlike recording finalization this
 * deliberately performs no audio-container check; callers validate the source
 * format before storage and supply the exact digest.
 */
export async function storePrivateSermonObject({
  bytes,
  communityNamespace,
  expectedSha256,
  maximumBytes = 32 * 1024 * 1024,
}: {
  bytes: Uint8Array
  communityNamespace: string
  expectedSha256: string
  maximumBytes?: number
}): Promise<StoredSermonMediaObject> {
  assertDigest(expectedSha256)
  if (
    !(bytes instanceof Uint8Array)
    || !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
    || bytes.byteLength < 1
    || bytes.byteLength > maximumBytes
    || createHash('sha256').update(bytes).digest('hex') !== expectedSha256
  ) {
    throw new SermonMediaError(
      'INVALID_PRIVATE_OBJECT',
      'The private sermon source bytes are invalid.',
      422,
    )
  }
  const root = sermonMediaStorageRoot()
  const storageKey = sermonMediaObjectKey(
    communityNamespace,
    expectedSha256,
  )
  const objectDirectory = await ensurePrivateDirectory(
    root,
    `objects/${communityNamespace}/sha256/${expectedSha256.slice(0, 2)}`,
  )
  const destination = absoluteStoragePath(root, storageKey)
  try {
    const existing = await verifyRegularFile(
      destination,
      bytes.byteLength,
      expectedSha256,
    )
    if (!existing) {
      throw storageError(
        'A conflicting private sermon object already exists.',
      )
    }
    return Object.freeze({
      storageKey,
      sha256: expectedSha256,
      sizeBytes: bytes.byteLength,
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
  }

  const temporary = await exclusiveTempFile(objectDirectory)
  let closed = false
  try {
    let offset = 0
    while (offset < bytes.byteLength) {
      const result = await temporary.handle.write(
        bytes,
        offset,
        bytes.byteLength - offset,
      )
      if (result.bytesWritten < 1) {
        throw storageError('The private sermon source could not be written completely.')
      }
      offset += result.bytesWritten
    }
    await temporary.handle.sync()
    await temporary.handle.close()
    closed = true
    try {
      // Hard-link publication is atomic and cannot replace an existing
      // content-addressed object during a concurrent identical upload.
      await link(temporary.path, destination)
      await fsyncDirectory(objectDirectory)
      await removeTemp(temporary.path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error
      if (!await verifyRegularFile(
        destination,
        bytes.byteLength,
        expectedSha256,
      )) {
        throw storageError('A conflicting private sermon object already exists.')
      }
      await removeTemp(temporary.path)
    }
    return Object.freeze({
      storageKey,
      sha256: expectedSha256,
      sizeBytes: bytes.byteLength,
    })
  } catch (error) {
    if (!closed) await temporary.handle.close().catch(() => undefined)
    await removeTemp(temporary.path).catch(() => undefined)
    if (error instanceof SermonMediaError) throw error
    throw storageError('The private sermon source could not be stored.', error)
  }
}

/**
 * Streams a larger private object into the tenant-isolated content-addressed
 * store. Publication happens only after size, digest, and caller-supplied
 * container-header validation all succeed, so an interrupted or disguised
 * upload can never become a readable service asset.
 */
export async function storePrivateStreamObject({
  body,
  communityNamespace,
  expectedSha256,
  expectedSize,
  maximumBytes,
  validateHead,
}: {
  body: ReadableStream<Uint8Array> | null
  communityNamespace: string
  expectedSha256: string
  expectedSize: number
  maximumBytes: number
  validateHead?: (head: Uint8Array) => boolean
}): Promise<StoredSermonMediaObject> {
  assertDigest(expectedSha256)
  if (
    !body
    || !Number.isSafeInteger(expectedSize)
    || expectedSize < 1
    || !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
    || expectedSize > maximumBytes
  ) {
    throw new SermonMediaError(
      'INVALID_PRIVATE_OBJECT',
      'The private service asset stream is invalid.',
      422,
    )
  }

  const root = sermonMediaStorageRoot()
  const storageKey = sermonMediaObjectKey(communityNamespace, expectedSha256)
  const objectDirectory = await ensurePrivateDirectory(
    root,
    `objects/${communityNamespace}/sha256/${expectedSha256.slice(0, 2)}`,
  )
  const destination = absoluteStoragePath(root, storageKey)
  try {
    const existing = await verifyRegularFile(
      destination,
      expectedSize,
      expectedSha256,
      validateHead || null,
    )
    if (!existing) throw storageError('A conflicting private service asset already exists.')
    return Object.freeze({ storageKey, sha256: expectedSha256, sizeBytes: expectedSize })
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
  }

  const temporary = await exclusiveTempFile(objectDirectory)
  const hash = createHash('sha256')
  const headChunks: Uint8Array[] = []
  let headSize = 0
  let sizeBytes = 0
  let closed = false
  try {
    const reader = body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!(value instanceof Uint8Array)) {
          throw new SermonMediaError(
            'INVALID_PRIVATE_OBJECT',
            'The private service asset stream is invalid.',
            422,
          )
        }
        if (value.byteLength === 0) continue
        sizeBytes += value.byteLength
        if (sizeBytes > expectedSize || sizeBytes > maximumBytes) {
          await reader.cancel('private service asset exceeded its declared size')
            .catch(() => undefined)
          throw new SermonMediaError(
            'CONTENT_LENGTH_MISMATCH',
            'The private service asset contains more bytes than declared.',
            422,
          )
        }
        hash.update(value)
        if (headSize < 64) {
          const retained = value.subarray(0, Math.min(value.byteLength, 64 - headSize))
          headChunks.push(retained.slice())
          headSize += retained.byteLength
        }
        let offset = 0
        while (offset < value.byteLength) {
          const result = await temporary.handle.write(value, offset, value.byteLength - offset)
          if (result.bytesWritten < 1) {
            throw storageError('The private service asset could not be written completely.')
          }
          offset += result.bytesWritten
        }
      }
    } finally {
      reader.releaseLock()
    }
    if (sizeBytes !== expectedSize) {
      throw new SermonMediaError(
        'CONTENT_LENGTH_MISMATCH',
        'The private service asset size does not match its metadata.',
        422,
      )
    }
    if (hash.digest('hex') !== expectedSha256) {
      throw new SermonMediaError(
        'CHUNK_HASH_MISMATCH',
        'The private service asset failed its content checksum.',
        422,
      )
    }
    if (validateHead && !validateHead(
      Buffer.concat(headChunks.map(chunk => Buffer.from(chunk)), headSize),
    )) {
      throw new SermonMediaError(
        'INVALID_PRIVATE_OBJECT',
        'The private service asset container is invalid.',
        422,
      )
    }
    await temporary.handle.sync()
    await temporary.handle.close()
    closed = true
    try {
      await link(temporary.path, destination)
      await fsyncDirectory(objectDirectory)
      await removeTemp(temporary.path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error
      if (!await verifyRegularFile(
        destination,
        expectedSize,
        expectedSha256,
        validateHead || null,
      )) {
        throw storageError('A conflicting private service asset already exists.')
      }
      await removeTemp(temporary.path)
    }
    return Object.freeze({ storageKey, sha256: expectedSha256, sizeBytes })
  } catch (error) {
    if (!closed) await temporary.handle.close().catch(() => undefined)
    await removeTemp(temporary.path).catch(() => undefined)
    if (error instanceof SermonMediaError) throw error
    throw storageError('The private service asset could not be stored.', error)
  }
}

export async function storeSermonMediaChunk({
  uploadId,
  headers,
  body,
  streamTiming,
}: {
  uploadId: string
  headers: SermonMediaChunkHeaders
  body: ReadableStream<Uint8Array> | null
  streamTiming?: Partial<ChunkStreamTiming>
}): Promise<StoredSermonMediaChunk> {
  if (!body) {
    throw new SermonMediaError(
      'INVALID_CHUNK_BODY',
      'The recording chunk body is missing.',
      422,
    )
  }
  const root = sermonMediaStorageRoot()
  const incomingDirectory = await ensurePrivateDirectory(
    root,
    `staging/${uploadId}/incoming`,
  )
  const chunksDirectory = await ensurePrivateDirectory(
    root,
    `staging/${uploadId}/chunks`,
  )
  const temporary = await exclusiveTempFile(incomingDirectory)
  const hash = createHash('sha256')
  let sizeBytes = 0
  let closed = false
  const timing = chunkStreamTiming(streamTiming)
  const streamStartedAt = Date.now()
  let lastProgressAt = streamStartedAt
  try {
    const reader = body.getReader()
    try {
      while (true) {
        const now = Date.now()
        const inactivityRemaining =
          lastProgressAt + timing.inactivityMs - now
        const totalRemaining =
          streamStartedAt + timing.totalMs - now
        if (inactivityRemaining <= 0 || totalRemaining <= 0) {
          await reader.cancel('sermon-media chunk stream deadline')
            .catch(() => undefined)
          throw new SermonMediaError(
            'CHUNK_STREAM_TIMEOUT',
            inactivityRemaining <= 0
              ? 'The recording chunk body stopped making progress.'
              : 'The recording chunk body exceeded its total transfer limit.',
            408,
            true,
          )
        }
        const remainingMs = Math.min(
          inactivityRemaining,
          totalRemaining,
        )
        const timeoutMessage =
          inactivityRemaining <= totalRemaining
            ? 'The recording chunk body stopped making progress.'
            : 'The recording chunk body exceeded its total transfer limit.'
        let timeout: ReturnType<typeof setTimeout> | undefined
        const timedOut = new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            reject(new SermonMediaError(
              'CHUNK_STREAM_TIMEOUT',
              timeoutMessage,
              408,
              true,
            ))
          }, remainingMs)
        })
        let next: ReadableStreamReadResult<Uint8Array>
        try {
          next = await Promise.race([reader.read(), timedOut])
        } catch (error) {
          if (
            error instanceof SermonMediaError
            && error.code === 'CHUNK_STREAM_TIMEOUT'
          ) {
            await reader.cancel('sermon-media chunk stream deadline')
              .catch(() => undefined)
          }
          throw error
        } finally {
          if (timeout) clearTimeout(timeout)
        }
        const { done, value } = next
        if (done) break
        if (!(value instanceof Uint8Array)) {
          throw new SermonMediaError(
            'INVALID_CHUNK_BODY',
            'The recording chunk stream is invalid.',
            422,
          )
        }
        if (value.byteLength === 0) continue
        sizeBytes += value.byteLength
        if (
          sizeBytes > headers.sizeBytes
          || sizeBytes > SERMON_MEDIA_MAXIMUM_BYTES
        ) {
          throw new SermonMediaError(
            'CONTENT_LENGTH_MISMATCH',
            'The recording chunk contains more bytes than declared.',
            422,
          )
        }
        hash.update(value)
        let offset = 0
        while (offset < value.byteLength) {
          const result = await temporary.handle.write(
            value,
            offset,
            value.byteLength - offset,
          )
          if (result.bytesWritten < 1) {
            throw storageError(
              'The recording chunk could not be written completely.',
            )
          }
          offset += result.bytesWritten
        }
        lastProgressAt = Date.now()
      }
    } finally {
      reader.releaseLock()
    }
    if (sizeBytes !== headers.sizeBytes) {
      throw new SermonMediaError(
        'CONTENT_LENGTH_MISMATCH',
        `The recording chunk must contain exactly ${headers.sizeBytes} bytes.`,
        422,
      )
    }
    const actualSha256 = hash.digest('hex')
    if (actualSha256 !== headers.sha256) {
      throw new SermonMediaError(
        'CHUNK_HASH_MISMATCH',
        'The recording chunk SHA-256 digest does not match its header.',
        422,
      )
    }
    await temporary.handle.sync()
    await temporary.handle.close()
    closed = true

    const storageKey = sermonMediaChunkKey(
      uploadId,
      headers.index,
      headers.sha256,
    )
    if (!CHUNK_KEY_PATTERN.test(storageKey)) {
      throw storageError('The derived recording chunk key is invalid.')
    }
    const destination = absoluteStoragePath(root, storageKey)
    try {
      const existing = await verifyRegularFile(
        destination,
        sizeBytes,
        headers.sha256,
      )
      if (!existing) {
        throw storageError(
          'A conflicting recording chunk already exists in private storage.',
        )
      }
      await removeTemp(temporary.path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        await rename(temporary.path, destination)
        await fsyncDirectory(chunksDirectory)
      } else {
        throw error
      }
    }
    return Object.freeze({
      storageKey,
      sha256: headers.sha256,
      sizeBytes,
    })
  } catch (error) {
    if (!closed) {
      await temporary.handle.close().catch(() => undefined)
    }
    await removeTemp(temporary.path).catch(() => undefined)
    if (error instanceof SermonMediaError) throw error
    throw storageError('The recording chunk could not be stored.', error)
  }
}

export async function assembleSermonMediaObject({
  uploadId,
  chunks,
  expectedSha256,
  expectedSizeBytes,
  expectedMediaType,
  communityNamespace,
}: {
  uploadId: string
  chunks: readonly StoredSermonMediaChunk[]
  expectedSha256: string
  expectedSizeBytes: number
  expectedMediaType: AcceptedMediaType
  communityNamespace: string
}): Promise<StoredSermonMediaObject> {
  assertUploadId(uploadId)
  assertDigest(expectedSha256)
  const root = sermonMediaStorageRoot()
  const assemblyDirectory = await ensurePrivateDirectory(
    root,
    `staging/${uploadId}/assemble`,
  )
  const objectDirectory = await ensurePrivateDirectory(
    root,
    `objects/${communityNamespace}/sha256/${expectedSha256.slice(0, 2)}`,
  )
  const temporary = await exclusiveTempFile(assemblyDirectory)
  const wholeHash = createHash('sha256')
  let totalBytes = 0
  let closed = false
  try {
    for (const chunk of chunks) {
      if (
        !CHUNK_KEY_PATTERN.test(chunk.storageKey)
        || !chunk.storageKey.startsWith(`staging/${uploadId}/chunks/`)
      ) {
        throw storageError('A stored recording chunk key is invalid.')
      }
      const chunkPath = absoluteStoragePath(root, chunk.storageKey)
      if (!await verifyRegularFile(
        chunkPath,
        chunk.sizeBytes,
        chunk.sha256,
      )) {
        throw storageError(
          'A stored recording chunk failed verification.',
        )
      }
      const source = await open(
        chunkPath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      )
      try {
        const buffer = Buffer.allocUnsafe(1024 * 1024)
        let position = 0
        while (true) {
          const result = await source.read(
            buffer,
            0,
            buffer.length,
            position,
          )
          if (!result.bytesRead) break
          position += result.bytesRead
          totalBytes += result.bytesRead
          if (
            totalBytes > expectedSizeBytes
            || totalBytes > SERMON_MEDIA_MAXIMUM_BYTES
          ) {
            throw new SermonMediaError(
              'OBJECT_LENGTH_MISMATCH',
              'The assembled recording is larger than declared.',
              422,
            )
          }
          const bytes = buffer.subarray(0, result.bytesRead)
          wholeHash.update(bytes)
          let offset = 0
          while (offset < bytes.byteLength) {
            const written = await temporary.handle.write(
              bytes,
              offset,
              bytes.byteLength - offset,
            )
            if (written.bytesWritten < 1) {
              throw storageError(
                'The complete recording could not be written.',
              )
            }
            offset += written.bytesWritten
          }
        }
      } finally {
        await source.close()
      }
    }
    if (totalBytes !== expectedSizeBytes) {
      throw new SermonMediaError(
        'OBJECT_LENGTH_MISMATCH',
        `The complete recording must contain exactly ${expectedSizeBytes} bytes.`,
        422,
      )
    }
    const actualSha256 = wholeHash.digest('hex')
    if (actualSha256 !== expectedSha256) {
      throw new SermonMediaError(
        'OBJECT_HASH_MISMATCH',
        'The complete recording SHA-256 digest does not match the sermon slot.',
        422,
      )
    }
    await temporary.handle.sync()
    await temporary.handle.close()
    closed = true
    await validateMediaContainer(
      temporary.path,
      totalBytes,
      expectedMediaType,
    )
    const storageKey = sermonMediaObjectKey(
      communityNamespace,
      expectedSha256,
    )
    if (!OBJECT_KEY_PATTERN.test(storageKey)) {
      throw storageError('The derived recording object key is invalid.')
    }
    const destination = absoluteStoragePath(root, storageKey)
    try {
      const existing = await verifyRegularFile(
        destination,
        totalBytes,
        expectedSha256,
      )
      if (!existing) {
        throw storageError(
          'A conflicting recording object already exists in private storage.',
        )
      }
      await removeTemp(temporary.path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        await rename(temporary.path, destination)
        await fsyncDirectory(objectDirectory)
      } else {
        throw error
      }
    }
    const persisted = await stat(destination)
    if (persisted.size !== totalBytes) {
      throw storageError('The completed recording did not persist safely.')
    }
    return Object.freeze({
      storageKey,
      sha256: expectedSha256,
      sizeBytes: totalBytes,
    })
  } catch (error) {
    if (!closed) {
      await temporary.handle.close().catch(() => undefined)
    }
    await removeTemp(temporary.path).catch(() => undefined)
    if (error instanceof SermonMediaError) throw error
    throw storageError('The recording object could not be assembled.', error)
  }
}

async function removeConfinedTree(value: string): Promise<void> {
  const metadata = await lstat(value)
  if (metadata.isSymbolicLink()) {
    throw storageError(
      'Private sermon-media staging cleanup refused a symbolic link.',
    )
  }
  if (metadata.isFile()) {
    await unlink(value)
    return
  }
  if (!metadata.isDirectory()) {
    throw storageError(
      'Private sermon-media staging cleanup found an unsupported object.',
    )
  }
  const entries = await readdir(value)
  for (const entry of entries) {
    if (
      !entry
      || entry === '.'
      || entry === '..'
      || entry.includes('/')
      || entry.includes('\\')
    ) {
      throw storageError(
        'Private sermon-media staging cleanup found an invalid name.',
      )
    }
    await removeConfinedTree(path.join(value, entry))
  }
  await rmdir(value)
}

export async function cleanupSermonMediaStaging(uploadId: string) {
  assertUploadId(uploadId)
  const root = sermonMediaStorageRoot()
  await ensureRoot(root)
  const stagingRoot = absoluteStoragePath(root, 'staging')
  try {
    await assertDirectoryNotSymlink(stagingRoot)
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return
    throw error
  }
  const uploadRoot = absoluteStoragePath(
    root,
    sermonMediaStagingKey(uploadId),
  )
  try {
    await removeConfinedTree(uploadRoot)
    await fsyncDirectory(stagingRoot)
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return
    if (error instanceof SermonMediaError) throw error
    throw storageError(
      'The terminal recording staging directory could not be cleaned.',
      error,
    )
  }
}

export async function verifySermonMediaObject(
  object: StoredSermonMediaObject,
) {
  if (!OBJECT_KEY_PATTERN.test(object.storageKey)) {
    throw storageError('A stored recording object key is invalid.')
  }
  const root = sermonMediaStorageRoot()
  await ensureRoot(root)
  const value = absoluteStoragePath(root, object.storageKey)
  return await verifyRegularFile(
    value,
    object.sizeBytes,
    object.sha256,
  )
}

/**
 * Opens a completed private recording without exposing its absolute path.
 *
 * The descriptor is revalidated against the content-addressed namespace, each
 * parent component is required to be a real directory, the final object is
 * opened with O_NOFOLLOW, and the descriptor must still be a regular file of
 * the exact finalized size. Finalization is the full-byte digest boundary;
 * range playback does not rehash up to 1 GiB on every browser seek. Callers must either
 * consume one createReadStream() result (which closes the descriptor) or call
 * close() themselves.
 */
export async function openSermonMediaObjectForRead(
  object: StoredSermonMediaObject,
) {
  if (
    !OBJECT_KEY_PATTERN.test(object.storageKey)
    || !SHA256_PATTERN.test(object.sha256)
    || !Number.isSafeInteger(object.sizeBytes)
    || object.sizeBytes < 1
    || object.sizeBytes > SERMON_MEDIA_MAXIMUM_BYTES
  ) {
    throw storageError('A stored recording object descriptor is invalid.')
  }
  const keyDigest = object.storageKey.split('/').at(-1)
  if (keyDigest !== object.sha256) {
    throw storageError('A stored recording object key does not match its digest.')
  }

  const root = sermonMediaStorageRoot()
  await ensureRoot(root)
  const segments = object.storageKey.split('/')
  let parent = root
  try {
    for (const segment of segments.slice(0, -1)) {
      parent = path.join(parent, segment)
      await assertDirectoryNotSymlink(parent)
    }
  } catch (error) {
    if (error instanceof SermonMediaError) throw error
    throw storageError(
      'The private recording object directory is unavailable.',
      error,
    )
  }

  const value = absoluteStoragePath(root, object.storageKey)
  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    const linkMetadata = await lstat(value)
    if (linkMetadata.isSymbolicLink() || !linkMetadata.isFile()) {
      throw storageError(
        'Sermon-media storage contains a symbolic link or non-file object.',
      )
    }
    handle = await open(value, constants.O_RDONLY | constants.O_NOFOLLOW)
    const metadata = await handle.stat()
    if (
      !metadata.isFile()
      || metadata.size !== object.sizeBytes
      || metadata.dev !== linkMetadata.dev
      || metadata.ino !== linkMetadata.ino
    ) {
      throw storageError('The private recording object size is inconsistent.')
    }

    const opened = handle
    handle = null
    let claimed = false
    let closed = false
    let activeStream: ReturnType<typeof opened.createReadStream> | null = null
    return Object.freeze({
      sha256: object.sha256,
      sizeBytes: object.sizeBytes,
      createReadStream(startByte = 0, endByte = object.sizeBytes - 1) {
        if (
          claimed
          || closed
          || !Number.isSafeInteger(startByte)
          || !Number.isSafeInteger(endByte)
          || startByte < 0
          || endByte < startByte
          || endByte >= object.sizeBytes
        ) {
          throw storageError('The private recording byte range is invalid.')
        }
        const stream = opened.createReadStream({
          start: startByte,
          end: endByte,
          autoClose: true,
        })
        claimed = true
        activeStream = stream
        stream.once('close', () => {
          closed = true
          activeStream = null
        })
        return stream
      },
      async close() {
        if (closed) return
        if (activeStream) {
          const stream = activeStream
          const didClose = stream.closed
            ? null
            : new Promise<void>(resolve => stream.once('close', resolve))
          stream.destroy()
          await didClose
          activeStream = null
          closed = true
          return
        }
        claimed = true
        closed = true
        await opened.close()
      },
    })
  } catch (error) {
    await handle?.close().catch(() => undefined)
    if (error instanceof SermonMediaError) throw error
    throw storageError('The private recording object could not be opened.', error)
  }
}

export async function readPrivateSermonObject(
  object: StoredSermonMediaObject,
  maximumBytes = 32 * 1024 * 1024,
) {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
    || object.sizeBytes > maximumBytes
  ) {
    throw new SermonMediaError(
      'PRIVATE_OBJECT_TOO_LARGE',
      'The private sermon object is too large to read in one review request.',
      413,
    )
  }
  const opened = await openSermonMediaObjectForRead(object)
  const chunks: Buffer[] = []
  let sizeBytes = 0
  try {
    const stream = opened.createReadStream()
    for await (const raw of stream) {
      const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
      sizeBytes += chunk.byteLength
      if (sizeBytes > maximumBytes || sizeBytes > object.sizeBytes) {
        stream.destroy()
        throw new SermonMediaError(
          'PRIVATE_OBJECT_TOO_LARGE',
          'The private sermon object exceeded its reviewed size.',
          413,
        )
      }
      chunks.push(chunk)
    }
  } finally {
    await opened.close()
  }
  const result = Buffer.concat(chunks)
  if (
    result.byteLength !== object.sizeBytes
    || createHash('sha256').update(result).digest('hex') !== object.sha256
  ) {
    throw storageError('The private sermon object failed its final read check.')
  }
  return result
}

export async function sermonMediaFilesystemCapacity() {
  const root = sermonMediaStorageRoot()
  await ensureRoot(root)
  try {
    const filesystem = await statfs(root, { bigint: true })
    const available = filesystem.bavail * filesystem.bsize
    const total = filesystem.blocks * filesystem.bsize
    return Object.freeze({
      availableBytes: available > BigInt(Number.MAX_SAFE_INTEGER)
        ? Number.MAX_SAFE_INTEGER
        : Number(available),
      totalBytes: total > BigInt(Number.MAX_SAFE_INTEGER)
        ? Number.MAX_SAFE_INTEGER
        : Number(total),
    })
  } catch (error) {
    throw storageError(
      'Private sermon-media filesystem capacity is unavailable.',
      error,
    )
  }
}

export async function sermonMediaAvailableBytes() {
  return (await sermonMediaFilesystemCapacity()).availableBytes
}

export async function sermonMediaStorageRootIsReady() {
  const root = sermonMediaStorageRoot()
  try {
    const metadata = await lstat(root)
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw storageError(
        'The private sermon-media storage root is not a real directory.',
      )
    }
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return false
    if (error instanceof SermonMediaError) throw error
    throw storageError(
      'The private sermon-media storage root cannot be inspected.',
      error,
    )
  }
}

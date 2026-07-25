import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SYNCSHOW_PROTOCOL_VERSION = 1
export const SYNCSHOW_READ_SCOPE = 'syncshow:songs:read'
export const SYNCSHOW_WRITE_SCOPE = 'syncshow:songs:write'
export const SYNCSHOW_SCOPES = [SYNCSHOW_READ_SCOPE, SYNCSHOW_WRITE_SCOPE] as const
export const SYNCSHOW_MAX_REQUEST_BYTES = 2 * 1024 * 1024
export const SYNCSHOW_MAX_DOCUMENT_BYTES = 512 * 1024
export const SYNCSHOW_MAX_DOCUMENTS = 32
export const SYNCSHOW_MAX_PAGE_SIZE = 200

const SONG_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const PKCE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const VISIBILITIES = new Set(['private', 'public', 'scheduled-public'])
const RIGHTS_STATUSES = new Set([
  'needs-review',
  'metadata-only',
  'public-domain',
  'licensed',
  'permission-granted',
  'community-translation',
  'mixed',
])

export class SyncShowProtocolError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'SyncShowProtocolError'
    this.code = code
    this.status = status
  }
}

function fail(code: string, message: string, status = 400): never {
  throw new SyncShowProtocolError(code, message, status)
}

function objectRecord(value: unknown, field = 'Request body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_OBJECT', `${field} must be an object.`)
  }
  return value as Record<string, unknown>
}

function boundedText(
  value: unknown,
  field: string,
  maximum: number,
  { required = false }: { required?: boolean } = {},
) {
  if (value === undefined) return undefined
  if (typeof value !== 'string') fail('INVALID_TEXT', `${field} must be text.`)
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (required && !normalized) fail('MISSING_FIELD', `${field} is required.`)
  if (normalized.length > maximum) fail('TEXT_TOO_LONG', `${field} must be ${maximum} characters or fewer.`)
  if (normalized.includes('\0')) fail('INVALID_TEXT', `${field} cannot contain a null character.`)
  return normalized
}

function textList(value: unknown, field: string, maximumItems = 64, maximumLength = 200) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) fail('INVALID_LIST', `${field} must be a list.`)
  if (value.length > maximumItems) fail('TOO_MANY_VALUES', `${field} can contain at most ${maximumItems} values.`)
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    const normalized = boundedText(item, field, maximumLength, { required: true }) as string
    const identity = normalized.toLocaleLowerCase()
    if (seen.has(identity)) continue
    seen.add(identity)
    result.push(normalized)
  }
  return result
}

function optionalUrl(value: unknown, field: string) {
  const text = boundedText(value, field, 2048)
  if (text === undefined || text === '') return text
  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    return fail('INVALID_URL', `${field} must be a valid HTTP or HTTPS URL.`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    fail('INVALID_URL', `${field} must be a valid HTTP or HTTPS URL without embedded credentials.`)
  }
  return parsed.toString()
}

export function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : ''
}

export function normalizePkceChallenge(value: unknown) {
  const challenge = String(value || '').trim()
  if (!PKCE_PATTERN.test(challenge)) {
    fail('INVALID_PKCE_CHALLENGE', 'codeChallenge must be a 43 to 128 character base64url value.')
  }
  return challenge
}

export function pkceChallengeForVerifier(value: unknown) {
  const verifier = String(value || '').trim()
  if (!PKCE_PATTERN.test(verifier)) {
    fail('INVALID_PKCE_VERIFIER', 'codeVerifier must be a 43 to 128 character base64url value.', 401)
  }
  return createHash('sha256').update(verifier).digest('base64url')
}

export function pkceChallengeMatches(verifier: unknown, expectedChallenge: unknown) {
  const actual = Buffer.from(pkceChallengeForVerifier(verifier))
  const expected = Buffer.from(String(expectedChallenge || ''))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/**
 * Derive the one opaque access token for a device grant. The server keeps only
 * the device-secret hash, while the approved device can reproduce the same
 * token during a short retry window if the first HTTP response is lost.
 */
export function syncShowAccessToken(
  serverSecret: string,
  deviceId: string,
  deviceSecret: string,
  codeChallenge: string,
) {
  return createHmac('sha256', serverSecret)
    .update('heritage-syncshow-access-v1\0')
    .update(deviceId)
    .update('\0')
    .update(deviceSecret)
    .update('\0')
    .update(codeChallenge)
    .digest('base64url')
}

export function songEtag(song: Record<string, unknown>) {
  return `"song:${String(song.syncId || '')}:${Number(song.syncVersion || 0)}"`
}

export function listEtag(songs: Array<Record<string, unknown>>) {
  const hash = createHash('sha256')
  for (const song of songs) {
    hash.update(`${String(song.syncId || '')}\0${String(song.syncVersion || 0)}\0${String(song.updatedAt || '')}\0`)
  }
  return `"songs:${hash.digest('hex')}"`
}

export function isSongVisibleToMember(song: Record<string, unknown>, now = new Date()) {
  if (song.status !== 'published') return false
  if (song.visibility === 'public') return true
  if (song.visibility !== 'scheduled-public') return false
  const publishAt = Date.parse(String(song.publishAt || ''))
  return Number.isFinite(publishAt) && publishAt <= now.getTime()
}

export function deviceGrantPollingStatus(
  grant: Record<string, unknown>,
  now = new Date(),
  consumedRetryMs = 15 * 60_000,
) {
  const consumedAt = Date.parse(String(grant.consumedAt || ''))
  const recentlyConsumed = grant.status === 'consumed'
    && Number.isFinite(consumedAt)
    && consumedAt > now.getTime() - consumedRetryMs
  const expired = Date.parse(String(grant.expiresAt || '')) <= now.getTime()
  return expired && !recentlyConsumed ? 'expired' : String(grant.status || 'pending')
}

function yamlScalar(value: string) {
  return JSON.stringify(value)
}

function songDocumentBody(lyrics: unknown) {
  const body = String(lyrics || '').replace(/\r\n?/g, '\n').trim()
  if (!body) return ''
  if (/^\^[^\s]/m.test(body)) return body

  const heading = /^(verse|stanza|chorus|refrain|bridge|tag|intro|outro|ending|куплет|припев|бридж|вступление|окончание)\s*(\d*)\s*:?\s*$/iu
  return body
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block.split('\n').map(line => line.trimEnd()).filter((line, lineIndex, all) => (
        line.trim() || (lineIndex > 0 && lineIndex < all.length - 1)
      ))
      const match = heading.exec(lines[0] || '')
      let marker = String(index + 1)
      let content = lines
      if (match) {
        const kind = match[1].toLocaleLowerCase()
        marker = match[2] || (
          ['chorus', 'refrain', 'припев'].includes(kind) ? 'chorus'
            : ['bridge', 'бридж'].includes(kind) ? 'bridge'
              : ['tag'].includes(kind) ? 'tag'
                : ['intro', 'вступление'].includes(kind) ? 'intro'
                  : ['outro', 'ending', 'окончание'].includes(kind) ? 'outro'
                    : String(index + 1)
        )
        content = lines.slice(1)
      }
      return `^${marker}\n${content.join('\n')}`.trimEnd()
    })
    .filter(Boolean)
    .join('\n\n')
}

function safeDocumentId(base: string, suffix = '') {
  const preferred = `${base}${suffix}`
  if (SONG_ID_PATTERN.test(preferred)) return preferred
  const hash = createHash('sha256').update(preferred).digest('hex').slice(0, 12)
  const remaining = Math.max(1, 128 - hash.length - suffix.length - 1)
  const prefix = base
    .replace(/[^A-Za-z0-9._:-]+/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, remaining)
    .replace(/[._:-]+$/, '') || 'song'
  return `${prefix}-${hash}${suffix}`.slice(0, 128)
}

function legacyAttribution(song: Record<string, unknown>) {
  return [
    boundedText(song.copyright ?? undefined, 'Copyright', 5000),
    boundedText(song.rightsNotes ?? undefined, 'Rights notes', 10_000),
  ].filter(Boolean).join('\n')
}

function synthesizeDocument(
  song: Record<string, unknown>,
  {
    id,
    language,
    lyrics,
    title,
    translationOf,
  }: { id: string; language: string; lyrics: unknown; title: unknown; translationOf?: string },
) {
  const body = songDocumentBody(lyrics)
  if (!body) return null
  const lines = [
    '---',
    `id: ${yamlScalar(id)}`,
    `title: ${yamlScalar(String(title || song.title || 'Untitled song'))}`,
    `language: ${language}`,
  ]
  if (translationOf) lines.push(`translationOf: ${yamlScalar(translationOf)}`)
  // Payload/Postgres represents an unset optional field as null. Treat null
  // as absent while keeping every other unexpected legacy shape fail-closed.
  const license = boundedText(song.license ?? undefined, 'License', 300)
  const authors = textList(song.authors ?? undefined, 'Authors', 64, 120)
  const source = optionalUrl(song.sourceUrl ?? undefined, 'Source URL')
  const attribution = legacyAttribution(song)
  if (license) lines.push(`license: ${yamlScalar(license)}`)
  if (authors?.length) lines.push(`authors: ${JSON.stringify(authors)}`)
  if (source) lines.push(`source: ${yamlScalar(source)}`)
  if (attribution) lines.push(`attribution: ${yamlScalar(attribution.slice(0, 2048))}`)
  lines.push('---', '', body)
  const documentSource = `${lines.join('\n')}\n`
  return {
    id,
    source: documentSource,
    revision: createHash('sha256').update(documentSource).digest('hex'),
  }
}

export type SyncShowDocument = {
  id: string
  source: string
  revision: string
}

export function synthesizeLegacySyncDocuments(song: Record<string, unknown>): SyncShowDocument[] {
  const storedIds = new Map<string, string>()
  const untouchedDocuments: SyncShowDocument[] = []
  if (Array.isArray(song.syncDocuments)) {
    for (const raw of song.syncDocuments) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      const record = raw as Record<string, unknown>
      if (typeof record.id !== 'string' || !SONG_ID_PATTERN.test(record.id) || typeof record.source !== 'string') continue
      const { metadata } = parseSimpleFrontMatter(record.source)
      const language = String(metadata.language || '').toLowerCase().split(/[-_]/)[0]
      if (language && !storedIds.has(language)) storedIds.set(language, record.id)
      if (language !== 'en' && language !== 'ru') {
        untouchedDocuments.push({
          id: record.id,
          source: record.source,
          revision: createHash('sha256').update(record.source).digest('hex'),
        })
      }
    }
  }
  const baseId = storedIds.get('en')
    || (!song.lyrics && storedIds.get('ru'))
    || safeDocumentId(String(song.syncId || song.slug || `heritage:${song.id || 'song'}`))
  const english = songDocumentBody(song.lyrics)
  const russian = songDocumentBody(song.russianLyrics)
  const documents: Array<SyncShowDocument | null> = []
  if (english) {
    documents.push(synthesizeDocument(song, {
      id: baseId,
      language: 'en',
      lyrics: song.lyrics,
      title: song.title,
    }))
  }
  if (russian) {
    const id = storedIds.get('ru') || (english ? safeDocumentId(baseId, '-ru') : baseId)
    documents.push(synthesizeDocument(song, {
      id,
      language: 'ru',
      lyrics: song.russianLyrics,
      title: song.russianTitle || song.title,
      translationOf: english ? baseId : undefined,
    }))
  }
  return [
    ...documents.filter((document): document is SyncShowDocument => Boolean(document)),
    ...untouchedDocuments,
  ]
}

export function normalizeSyncDocuments(value: unknown): SyncShowDocument[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) fail('INVALID_DOCUMENTS', 'syncDocuments must be a list.')
  if (value.length > SYNCSHOW_MAX_DOCUMENTS) {
    fail('TOO_MANY_DOCUMENTS', `syncDocuments can contain at most ${SYNCSHOW_MAX_DOCUMENTS} documents.`)
  }
  const ids = new Set<string>()
  let totalBytes = 0
  return value.map((raw, index) => {
    const document = objectRecord(raw, `syncDocuments[${index}]`)
    const id = boundedText(document.id, `syncDocuments[${index}].id`, 128, { required: true }) as string
    if (!SONG_ID_PATTERN.test(id)) {
      fail(
        'INVALID_DOCUMENT_ID',
        `syncDocuments[${index}].id must start with a letter or number and use only letters, numbers, dot, underscore, colon, or hyphen.`,
      )
    }
    if (ids.has(id)) fail('DUPLICATE_DOCUMENT_ID', `syncDocuments repeats document id "${id}".`)
    ids.add(id)
    if (typeof document.source !== 'string') {
      fail('INVALID_DOCUMENT_SOURCE', `syncDocuments[${index}].source must be UTF-8 text.`)
    }
    if (document.source.includes('\0')) {
      fail('INVALID_DOCUMENT_SOURCE', `syncDocuments[${index}].source cannot contain a null character.`)
    }
    const bytes = Buffer.byteLength(document.source, 'utf8')
    if (bytes > SYNCSHOW_MAX_DOCUMENT_BYTES) {
      fail(
        'DOCUMENT_TOO_LARGE',
        `syncDocuments[${index}].source must be ${SYNCSHOW_MAX_DOCUMENT_BYTES} bytes or fewer.`,
      )
    }
    totalBytes += bytes
    if (totalBytes > SYNCSHOW_MAX_REQUEST_BYTES) {
      fail('DOCUMENTS_TOO_LARGE', `Combined song documents must be ${SYNCSHOW_MAX_REQUEST_BYTES} bytes or fewer.`)
    }
    const calculatedRevision = createHash('sha256').update(document.source).digest('hex')
    if (document.revision !== undefined) {
      const suppliedRevision = String(document.revision || '').toLowerCase()
      if (!SHA256_PATTERN.test(suppliedRevision) || suppliedRevision !== calculatedRevision) {
        fail('REVISION_MISMATCH', `syncDocuments[${index}].revision does not match its source.`)
      }
    }
    const parsed = parseSimpleFrontMatter(document.source)
    if (parsed.metadata.id !== id) {
      fail('DOCUMENT_ID_MISMATCH', `syncDocuments[${index}] front matter id must match its document id.`)
    }
    if (typeof parsed.metadata.title !== 'string' || !parsed.metadata.title.trim()) {
      fail('MISSING_DOCUMENT_TITLE', `syncDocuments[${index}] must include a non-empty title.`)
    }
    if (typeof parsed.metadata.language !== 'string' || !parsed.metadata.language.trim()) {
      fail('MISSING_DOCUMENT_LANGUAGE', `syncDocuments[${index}] must include a language.`)
    }
    const lyricText = parsed.body
      .split('\n')
      .filter(line => line !== '---' && !/^\^[^\s]/.test(line))
      .join('')
      .trim()
    if (!lyricText) fail('EMPTY_DOCUMENT', `syncDocuments[${index}] must include lyric text.`)
    return { id, source: document.source, revision: calculatedRevision }
  })
}

function parseSimpleFrontMatter(source: string) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  if (lines[0]?.trim() !== '---') return { metadata: {} as Record<string, unknown>, body: normalized }
  const end = lines.slice(1, 102).findIndex(line => line.trim() === '---')
  if (end < 0) return { metadata: {} as Record<string, unknown>, body: normalized }
  const metadata: Record<string, unknown> = {}
  for (const line of lines.slice(1, end + 1)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]{0,63})\s*:\s*(.*)$/.exec(line)
    if (!match) continue
    let value: unknown = match[2].trim()
    if (String(value).startsWith('"') || String(value).startsWith('[')) {
      try {
        value = JSON.parse(String(value))
      } catch {
        // SyncShow's parser remains authoritative. This compatibility view
        // simply leaves malformed scalar text untouched.
      }
    }
    metadata[match[1]] = value
  }
  return { metadata, body: lines.slice(end + 2).join('\n').trim() }
}

function patchDocumentSource(
  source: string,
  updates: Record<string, string | string[] | null | undefined>,
  body: string | undefined,
) {
  const match = /^---(\r?\n)([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
  if (!match) return source
  const newline = match[1]
  const remaining = source.slice(match[0].length)
  const pending = new Map(Object.entries(updates).filter(([, value]) => value !== undefined))
  const lines: string[] = []
  for (const line of match[2].split(/\r?\n/)) {
    const keyMatch = /^([A-Za-z][A-Za-z0-9_-]{0,63})\s*:/.exec(line)
    if (!keyMatch || !pending.has(keyMatch[1])) {
      lines.push(line)
      continue
    }
    const value = pending.get(keyMatch[1])
    pending.delete(keyMatch[1])
    if (value === null || value === '' || (Array.isArray(value) && !value.length)) continue
    lines.push(`${keyMatch[1]}: ${JSON.stringify(value)}`)
  }
  for (const [key, value] of pending) {
    if (value === null || value === '' || (Array.isArray(value) && !value.length)) continue
    lines.push(`${key}: ${JSON.stringify(value)}`)
  }
  const header = `---${newline}${lines.join(newline)}${newline}---${newline}`
  if (body === undefined) return `${header}${remaining}`
  const normalizedBody = songDocumentBody(body).replace(/\n/g, newline)
  return `${header}${newline}${normalizedBody}${newline}`
}

/**
 * Apply Community admin edits to only the first editable English/Russian
 * document. Unknown metadata, section/slide body bytes, additional same-
 * language arrangements, and every other language remain untouched.
 */
export function mergeLegacyEditsIntoSyncDocuments(
  existingSong: Record<string, unknown>,
  changes: Record<string, unknown>,
) {
  const stored = normalizeSyncDocuments(existingSong.syncDocuments) || []
  const merged = { ...existingSong, ...changes }
  if (!stored.length) return synthesizeLegacySyncDocuments(merged)

  const changed = (field: string) => Object.prototype.hasOwnProperty.call(changes, field)
  const parsedDocuments = stored.map(document => {
    const { metadata } = parseSimpleFrontMatter(document.source)
    return {
      document,
      language: String(metadata.language || '').toLowerCase().split(/[-_]/)[0],
      metadata,
    }
  })
  const englishIndex = parsedDocuments.findIndex(item => item.language === 'en')
  const russianIndex = parsedDocuments.findIndex(item => item.language === 'ru')
  const primaryIndex = englishIndex >= 0 ? englishIndex : 0
  // A Russian-only record has no generic legacy lyrics. Entering English
  // lyrics in that state means "add English", while an arbitrary-language
  // record already projected into the generic legacy fields is edited in
  // place.
  const addingEnglish = englishIndex < 0
    && changed('lyrics')
    && !String(existingSong.lyrics || '').trim()
    && Boolean(String(merged.lyrics || '').trim())
  const oldLegacyAttribution = legacyAttribution(existingSong)
  const nextLegacyAttribution = legacyAttribution(merged)
  const removedIds = new Set<string>()
  const result: SyncShowDocument[] = []
  for (let index = 0; index < parsedDocuments.length; index += 1) {
    const { document, metadata } = parsedDocuments[index]
    const genericTarget = index === primaryIndex && !addingEnglish
    const russianTarget = index === russianIndex
    const commonMetadataTarget = index === primaryIndex || russianTarget
    const updates: Record<string, string | string[] | null | undefined> = {}
    let body: string | undefined
    let removeDocument = false
    if (genericTarget) {
      if (changed('title')) updates.title = String(merged.title || '')
      if (changed('lyrics') && !String(merged.lyrics || '').trim()) removeDocument = true
      if (changed('lyrics')) body = String(merged.lyrics || '')
    }
    if (russianTarget) {
      if (changed('russianTitle')) updates.title = String(merged.russianTitle || merged.title || '')
      if (changed('russianLyrics') && !String(merged.russianLyrics || '').trim()) removeDocument = true
      if (changed('russianLyrics')) body = String(merged.russianLyrics || '')
    }
    if (removeDocument) {
      removedIds.add(document.id)
      continue
    }
    if (commonMetadataTarget) {
      if (changed('authors')) updates.authors = Array.isArray(merged.authors) ? merged.authors.map(String) : null
      if (changed('license')) updates.license = String(merged.license || '') || null
      if (changed('sourceUrl')) updates.source = String(merged.sourceUrl || '') || null
      if (changed('copyright') || changed('rightsNotes')) {
        const current = typeof metadata.attribution === 'string' ? metadata.attribution.trim() : ''
        // Do not destroy a SyncShow-authored credit. Only update an attribution
        // that is absent or was previously generated from these legacy fields.
        if (!current || current === oldLegacyAttribution) {
          updates.attribution = nextLegacyAttribution || null
        }
      }
    }
    if (!Object.keys(updates).length && body === undefined) {
      result.push(document)
      continue
    }
    const patchedSource = patchDocumentSource(document.source, updates, body)
    result.push({
      id: document.id,
      source: patchedSource,
      revision: createHash('sha256').update(patchedSource).digest('hex'),
    })
  }

  const usedIds = new Set(result.map(document => document.id))
  const uniqueCandidate = (document: SyncShowDocument, suffix: string) => {
    let id = document.id
    let attempt = 1
    while (usedIds.has(id)) {
      id = safeDocumentId(document.id, attempt === 1 ? suffix : `${suffix}-${attempt}`)
      attempt += 1
    }
    if (id !== document.id) {
      const source = patchDocumentSource(document.source, { id }, undefined)
      document = {
        id,
        source,
        revision: createHash('sha256').update(source).digest('hex'),
      }
    }
    usedIds.add(document.id)
    return document
  }

  let addedDocument = false
  if (addingEnglish) {
    const candidate = synthesizeLegacySyncDocuments({ ...merged, syncDocuments: [] })
      .find(document => String(parseSimpleFrontMatter(document.source).metadata.language) === 'en')
    if (candidate) {
      const unique = uniqueCandidate(candidate, '-en')
      addedDocument = true
      result.unshift(unique)
    }
  }
  if ((changed('russianTitle') || changed('russianLyrics')) && russianIndex < 0 && merged.russianLyrics) {
    const candidate = synthesizeLegacySyncDocuments({ ...merged, syncDocuments: [] })
      .find(document => String(parseSimpleFrontMatter(document.source).metadata.language) === 'ru')
    if (candidate) {
      let unique = uniqueCandidate(candidate, '-ru')
      addedDocument = true
      result.push(unique)
    }
  }

  if (!addedDocument && !removedIds.size) return result
  if (!result.length) return result

  // A SyncShow song family must have exactly one root. Preserve the first
  // surviving pre-edit root when possible. If that root was removed, promote
  // the first surviving document deterministically and retarget every sibling.
  // Only translationOf changes; bodies and unknown metadata remain intact.
  const survivingIds = new Set(result.map(document => document.id))
  const survivingOriginalRoot = parsedDocuments.find(({ document, metadata }) => (
    survivingIds.has(document.id) && !String(metadata.translationOf || '')
  ))?.document.id
  const rootId = survivingOriginalRoot || result[0].id
  return result.map(document => {
    const { metadata } = parseSimpleFrontMatter(document.source)
    const currentParent = String(metadata.translationOf || '')
    const replacement = document.id === rootId ? null : rootId
    if ((replacement === null && !currentParent) || currentParent === replacement) return document
    const source = patchDocumentSource(document.source, { translationOf: replacement }, undefined)
    return {
      ...document,
      source,
      revision: createHash('sha256').update(source).digest('hex'),
    }
  })
}

function legacyLyricsFromDocument(source: string) {
  const { body } = parseSimpleFrontMatter(source)
  return body
    .split('\n')
    .map(line => {
      if (line === '---') return ''
      if (line.startsWith('^^')) return line.slice(1)
      const marker = /^\^([^\s].{0,63})\s*$/.exec(line)
      if (!marker) return line
      if (/^\d+$/.test(marker[1])) return `Verse ${marker[1]}`
      return marker[1]
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function legacyFieldsFromSyncDocuments(documents: SyncShowDocument[]) {
  const result: Record<string, unknown> = {}
  let fallbackUsed = false
  let firstUsableDocument: { title: string; lyrics: string } | null = null
  for (const document of documents) {
    const { metadata } = parseSimpleFrontMatter(document.source)
    const language = String(metadata.language || '').toLowerCase().split(/[-_]/)[0]
    const title = String(metadata.title || '').trim()
    const lyrics = legacyLyricsFromDocument(document.source)
    if (!lyrics) continue
    firstUsableDocument ||= { title, lyrics }
    if (language === 'ru' && result.russianLyrics === undefined) {
      result.russianLyrics = lyrics
      if (title) result.russianTitle = title
    } else if ((language === 'en' || (!fallbackUsed && language !== 'ru')) && result.lyrics === undefined) {
      result.lyrics = lyrics
      if (title) result.title = title
      fallbackUsed = true
    }
    if (result.authors === undefined
      && Array.isArray(metadata.authors)
      && metadata.authors.length
      && metadata.authors.every(author => typeof author === 'string' && author.trim())) {
      result.authors = metadata.authors
    }
    if (result.license === undefined && typeof metadata.license === 'string' && metadata.license.trim()) {
      result.license = metadata.license.trim()
    }
    if (result.sourceUrl === undefined && typeof metadata.source === 'string' && metadata.source.trim()) {
      try {
        const source = new URL(metadata.source)
        if (['http:', 'https:'].includes(source.protocol) && !source.username && !source.password) {
          result.sourceUrl = source.toString()
        }
      } catch {
        // Keep the source in the lossless SyncShow document, but do not put an
        // invalid URL into Heritage's link field.
      }
    }
  }
  // Heritage's legacy title is required even when a church has only Russian,
  // Ukrainian, or another non-English document. Keep language-specific fields,
  // while using the first usable canonical document for the generic listing.
  if (result.title === undefined && firstUsableDocument?.title) {
    result.title = firstUsableDocument.title
  }
  return result
}

export function effectiveSyncDocuments(song: Record<string, unknown>): SyncShowDocument[] {
  const stored = normalizeSyncDocuments(song.syncDocuments)
  return stored?.length ? stored : synthesizeLegacySyncDocuments(song)
}

function normalizeVisibility(value: unknown, existing?: Record<string, unknown>) {
  const visibility = value === undefined ? String(existing?.visibility || 'private') : String(value)
  if (!VISIBILITIES.has(visibility)) {
    fail('INVALID_VISIBILITY', 'visibility must be private, public, or scheduled-public.')
  }
  return visibility
}

export function normalizeSongMutation(
  raw: unknown,
  {
    existing,
    create = false,
  }: { existing?: Record<string, unknown>; create?: boolean } = {},
) {
  const input = objectRecord(raw)
  const data: Record<string, unknown> = {}
  const syncIdValue = input.syncId === undefined ? existing?.syncId : input.syncId
  if (create || input.syncId !== undefined) {
    const syncId = boundedText(syncIdValue, 'syncId', 128, { required: true }) as string
    if (!SONG_ID_PATTERN.test(syncId)) {
      fail(
        'INVALID_SYNC_ID',
        'syncId must start with a letter or number and use only letters, numbers, dot, underscore, colon, or hyphen.',
      )
    }
    if (existing?.syncId && syncId !== existing.syncId) fail('IMMUTABLE_SYNC_ID', 'syncId cannot be changed.', 409)
    data.syncId = syncId
  }

  const textFields: Array<[string, number, boolean?]> = [
    ['title', 200, create],
    ['description', 5000],
    ['russianTitle', 200],
    ['lyrics', SYNCSHOW_MAX_DOCUMENT_BYTES],
    ['chordSheet', SYNCSHOW_MAX_DOCUMENT_BYTES],
    ['russianLyrics', SYNCSHOW_MAX_DOCUMENT_BYTES],
    ['russianChordSheet', SYNCSHOW_MAX_DOCUMENT_BYTES],
    ['key', 32],
    ['ccliNumber', 100],
    ['license', 300],
    ['copyright', 5000],
    ['rightsNotes', 10_000],
  ]
  for (const [field, maximum, required] of textFields) {
    if (input[field] !== undefined) data[field] = boundedText(input[field], field, maximum, { required })
  }
  if (input.alternateTitles !== undefined) data.alternateTitles = textList(input.alternateTitles, 'alternateTitles')
  if (input.authors !== undefined) data.authors = textList(input.authors, 'authors', 64, 120)
  if (input.sourceUrl !== undefined) data.sourceUrl = optionalUrl(input.sourceUrl, 'sourceUrl')
  if (input.permissionUrl !== undefined) data.permissionUrl = optionalUrl(input.permissionUrl, 'permissionUrl')
  if (input.rightsStatus !== undefined) {
    if (!RIGHTS_STATUSES.has(String(input.rightsStatus))) {
      fail('INVALID_RIGHTS_STATUS', 'rightsStatus is not a supported Community song rights value.')
    }
    data.rightsStatus = input.rightsStatus
  }
  if (input.tempo !== undefined) {
    const tempo = Number(input.tempo)
    if (!Number.isInteger(tempo) || tempo < 1 || tempo > 400) {
      fail('INVALID_TEMPO', 'tempo must be a whole number from 1 to 400.')
    }
    data.tempo = tempo
  }

  const archived = input.archived === undefined
    ? existing?.status === 'archived'
    : input.archived === true
  if (archived) {
    data.status = 'archived'
    data.visibility = 'private'
    data.publishAt = null
  } else {
    const visibility = normalizeVisibility(input.visibility, existing)
    data.visibility = visibility
    if (visibility === 'scheduled-public') {
      const publishAtValue = input.publishAt === undefined ? existing?.publishAt : input.publishAt
      const timestamp = Date.parse(String(publishAtValue || ''))
      if (!Number.isFinite(timestamp)) {
        fail('MISSING_PUBLISH_AT', 'publishAt is required for scheduled-public songs.')
      }
      data.publishAt = new Date(timestamp).toISOString()
    } else {
      data.publishAt = null
    }
    data.status = visibility === 'private' ? 'draft' : 'published'
  }

  if (input.syncDocuments !== undefined) {
    const documents = normalizeSyncDocuments(input.syncDocuments) || []
    const mergedLegacy = { ...(existing || {}), ...data }
    if (!documents.length) {
      const existingDocuments = existing ? effectiveSyncDocuments(existing) : []
      const legacyDocuments = synthesizeLegacySyncDocuments(mergedLegacy)
      if (existingDocuments.length || legacyDocuments.length) {
        // An empty client library must never erase lyrics already held by the
        // Community. Materialize deterministic legacy documents instead.
        data.syncDocuments = existingDocuments.length ? existingDocuments : legacyDocuments
      } else {
        data.syncDocuments = []
      }
    } else {
      data.syncDocuments = documents
      Object.assign(data, legacyFieldsFromSyncDocuments(documents))
    }
  } else if (create) {
    data.syncDocuments = synthesizeLegacySyncDocuments(data)
  }
  if (create && !data.title) fail('MISSING_FIELD', 'title is required in the request or the first SyncShow document.')

  return data
}

export function serializeSongForSync(song: Record<string, unknown>, now = new Date()) {
  return {
    schemaVersion: SYNCSHOW_PROTOCOL_VERSION,
    syncId: String(song.syncId || ''),
    visibility: song.visibility || 'private',
    effectiveVisibility: isSongVisibleToMember(song, now) ? 'public' : 'private',
    publishAt: song.publishAt || null,
    syncVersion: Number(song.syncVersion || 1),
    syncDocuments: effectiveSyncDocuments(song),
    title: song.title || '',
    description: song.description || '',
    russianTitle: song.russianTitle || '',
    alternateTitles: Array.isArray(song.alternateTitles) ? song.alternateTitles : [],
    authors: Array.isArray(song.authors) ? song.authors : [],
    lyrics: song.lyrics || '',
    chordSheet: song.chordSheet || '',
    russianLyrics: song.russianLyrics || '',
    russianChordSheet: song.russianChordSheet || '',
    key: song.key || '',
    tempo: song.tempo || null,
    rightsStatus: song.rightsStatus || 'needs-review',
    ccliNumber: song.ccliNumber || '',
    license: song.license || '',
    copyright: song.copyright || '',
    rightsNotes: song.rightsNotes || '',
    sourceUrl: song.sourceUrl || '',
    permissionUrl: song.permissionUrl || '',
    archived: song.status === 'archived',
    createdAt: song.createdAt || null,
    updatedAt: song.updatedAt || null,
    etag: songEtag(song),
  }
}

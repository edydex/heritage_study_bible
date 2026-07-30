import { createHash } from 'node:crypto'
import {
  CANONICAL_BIBLE_BOOKS,
  normalizeBibleRange,
  type CanonicalBibleRange,
} from './BibleRange.ts'
import {
  createSermonRevision,
  type CanonicalSermonDocument,
} from './SermonDocument.ts'
import type { SermonWriteBody } from './CommunitySermonWire.ts'

export const MANAGER_SERMON_PREPARATION_SCHEMA_VERSION = 1
export const MAX_MANAGER_SERMON_PREPARATION_REQUEST_BYTES = 2 * 1024 * 1024

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/

type MutableRecord = Record<string, unknown>

export type ManagerSermonPreparationIntent = Readonly<{
  schemaVersion: typeof MANAGER_SERMON_PREPARATION_SCHEMA_VERSION
  requestId: string
  title: string
  speaker: string
  serviceDate: string
  language: string
  primaryPassage: Readonly<{
    bookId: string
    startChapter: number
    startVerse: number
    endChapter: number
    endVerse: number
  }>
  manuscript: string
  slideNotes: string
  reviewConfirmed: true
}>

export type PreparedManagerSermon = Readonly<{
  requestId: string
  idempotencyKey: string
  syncId: string
  write: SermonWriteBody
  document: CanonicalSermonDocument
  passageLabel: string
}>

export class ManagerSermonPreparationError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ManagerSermonPreparationError'
    this.code = code
  }
}

function fail(code: string, message: string): never {
  throw new ManagerSermonPreparationError(code, message)
}

function record(value: unknown, label: string): MutableRecord {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail('INVALID_PREPARATION', `${label} must be an object.`)
  }
  return value as MutableRecord
}

function exactKeys(value: MutableRecord, expected: readonly string[], label: string) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (
    actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])
  ) {
    fail('INVALID_PREPARATION', `${label} has unsupported or missing fields.`)
  }
}

function singleLine(
  value: unknown,
  label: string,
  maximum: number,
  { lowercase = false }: { lowercase?: boolean } = {},
): string {
  if (typeof value !== 'string') fail('INVALID_PREPARATION', `${label} must be text.`)
  let normalized = value.trim().normalize('NFC')
  if (lowercase) normalized = normalized.toLowerCase()
  if (!normalized) fail('INVALID_PREPARATION', `${label} is required.`)
  if (/\r|\n|[\u0000-\u001f\u007f]/u.test(normalized)) {
    fail('INVALID_PREPARATION', `${label} must be one line of ordinary text.`)
  }
  if (normalized.length > maximum) {
    fail('INVALID_PREPARATION', `${label} must be ${maximum} characters or fewer.`)
  }
  return normalized
}

function bodyText(value: unknown, label: string): string {
  if (typeof value !== 'string') fail('INVALID_PREPARATION', `${label} must be text.`)
  return value.replace(/\r\n?/g, '\n').normalize('NFC')
}

function passageIntent(value: unknown) {
  const passage = record(value, 'Primary passage')
  exactKeys(
    passage,
    ['bookId', 'startChapter', 'startVerse', 'endChapter', 'endVerse'],
    'Primary passage',
  )
  return {
    bookId: passage.bookId,
    start: {
      chapter: passage.startChapter,
      verse: passage.startVerse,
    },
    end: {
      chapter: passage.endChapter,
      verse: passage.endVerse,
    },
  }
}

function passageLabel(range: CanonicalBibleRange): string {
  const book = CANONICAL_BIBLE_BOOKS.find(candidate => candidate.id === range.bookId)
  if (!book || range.start.verse === null || range.end.verse === null) {
    fail('INVALID_PREPARATION', 'The primary passage must identify exact verses.')
  }
  if (range.start.chapter === range.end.chapter) {
    return range.start.verse === range.end.verse
      ? `${book.name} ${range.start.chapter}:${range.start.verse}`
      : `${book.name} ${range.start.chapter}:${range.start.verse}–${range.end.verse}`
  }
  return `${book.name} ${range.start.chapter}:${range.start.verse}–${range.end.chapter}:${range.end.verse}`
}

function sourceAndBody(
  kind: 'manuscript' | 'slide-notes',
  text: string,
  language: string,
  requestId: string,
) {
  if (!text.trim()) return null
  const label = kind === 'manuscript' ? 'manuscript' : 'slide notes'
  const sourceId = `source-${kind}`
  return {
    source: {
      id: sourceId,
      kind,
      fileName: `community-${label.replace(' ', '-')}.txt`,
      mediaType: 'text/plain; charset=utf-8',
      sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
      sizeBytes: Buffer.byteLength(text, 'utf8'),
      provenance: {
        providedBy: 'Community manager',
        receivedAt: null,
        sourceSystem: 'heritage-community-manager',
        externalId: `${requestId}:${kind}`,
      },
      languages: [language],
    },
    body: {
      id: `body-${kind}-${language.replace(/[^a-z0-9]/g, '-')}`,
      kind,
      language,
      sourceId,
      sectionId: null,
      text,
    },
  }
}

export function prepareManagerSermon(
  value: unknown,
): PreparedManagerSermon {
  const input = record(value, 'Sermon preparation')
  exactKeys(
    input,
    [
      'schemaVersion',
      'requestId',
      'title',
      'speaker',
      'serviceDate',
      'language',
      'primaryPassage',
      'manuscript',
      'slideNotes',
      'reviewConfirmed',
    ],
    'Sermon preparation',
  )
  if (input.schemaVersion !== MANAGER_SERMON_PREPARATION_SCHEMA_VERSION) {
    fail('INVALID_PREPARATION', 'This sermon preparation version is unsupported.')
  }
  const requestId = singleLine(input.requestId, 'Preparation request ID', 36, {
    lowercase: true,
  })
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    fail('INVALID_PREPARATION', 'Preparation request ID must be a version-4 UUID.')
  }
  const title = singleLine(input.title, 'Sermon title', 300)
  const speaker = singleLine(input.speaker, 'Speaker', 200)
  const serviceDate = singleLine(input.serviceDate, 'Service date', 10)
  const language = singleLine(input.language, 'Content language', 35, {
    lowercase: true,
  })
  if (!LANGUAGE_PATTERN.test(language)) {
    fail('INVALID_PREPARATION', 'Content language must be a tag such as en or ru.')
  }
  const manuscript = bodyText(input.manuscript, 'Manuscript')
  const slideNotes = bodyText(input.slideNotes, 'Slide notes')
  if (!manuscript.trim() && !slideNotes.trim()) {
    fail('MISSING_SERMON_TEXT', 'Paste the manuscript, the slide notes, or both.')
  }
  if (input.reviewConfirmed !== true) {
    fail(
      'REVIEW_REQUIRED',
      'Confirm the title, speaker, date, passage, and pasted text before creating the sermon.',
    )
  }

  let range: CanonicalBibleRange
  try {
    range = normalizeBibleRange(passageIntent(input.primaryPassage))
  } catch {
    fail('INVALID_PRIMARY_PASSAGE', 'Enter one valid primary Bible passage with exact verses.')
  }
  if (range.start.verse === null || range.end.verse === null) {
    fail('INVALID_PRIMARY_PASSAGE', 'The primary passage must identify exact verses.')
  }
  const label = passageLabel(range)
  const syncId = `sermon-${requestId}`
  const preparedEntries = [
    sourceAndBody('manuscript', manuscript, language, requestId),
    sourceAndBody('slide-notes', slideNotes, language, requestId),
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  let revision
  try {
    revision = createSermonRevision({
      schemaVersion: 3,
      kind: 'syncshow-sermon',
      id: syncId,
      titles: { [language]: title },
      defaultLanguage: language,
      speaker: { id: null, name: speaker },
      serviceDate,
      series: null,
      outline: [],
      sources: preparedEntries.map(entry => entry.source),
      references: [
        {
          id: `primary-${range.bookId}-${range.start.chapter}-${range.start.verse}-${range.end.chapter}-${range.end.verse}`,
          range,
          role: 'primary',
          source: 'pastor',
          reviewStatus: 'confirmed',
          enteredText: label,
          sourceId: null,
          sectionId: null,
          startOffset: null,
          endOffset: null,
        },
      ],
      media: [],
      publication: {
        status: 'ready',
        visibility: 'private',
        publishedAt: null,
        canonicalUrl: null,
      },
      body: preparedEntries.map(entry => entry.body),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The sermon is invalid.'
    fail('INVALID_PREPARATION', message)
  }

  return Object.freeze({
    requestId,
    idempotencyKey: `manager-sermon-${requestId}`,
    syncId,
    write: Object.freeze({
      syncId,
      revision: revision.sha256,
      documentSource: revision.source,
    }),
    document: revision.document,
    passageLabel: label,
  })
}

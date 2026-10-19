'use client'

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  CANONICAL_BIBLE_BOOKS,
  canonicalBibleChapterVerseMaximum,
} from '@/lib/syncshow/BibleRange'

const ENDPOINT = '/api/community/sermon-preparations'
const SOURCE_ENDPOINT = '/api/community/sermon-source-extractions'
const PENDING_IDENTITY_KEY = 'heritage:prepare-sermon:pending:v3'
const MAX_MENTIONED_PASSAGES = 64
const MAX_SOURCE_UPLOADS = 8

type PassageDraft = {
  bookId: string
  startChapter: string
  startVerse: string
  endChapter: string
  endVerse: string
}

type MentionedPassageDraft = PassageDraft & {
  clientId: string
}

type PassageSuggestion = {
  enteredText: string
  passage: {
    bookId: string
    startChapter: number
    startVerse: number
    endChapter: number
    endVerse: number
  }
}

type SourceUploadDraft = {
  clientId: string
  token: string
  fileName: string
  format: string
  mediaType: string
  sizeBytes: number
  sha256: string
  extractor: string
  extractedText: string
  extractedTextSha256: string
  kind: 'manuscript' | 'slide-notes'
  language: string
  reviewedText: string
  suggestedTitle: string | null
  suggestedReferences: PassageSuggestion[]
}

type PreparationDraft = {
  title: string
  speaker: string
  serviceDate: string
  language: string
  primaryPassage: PassageDraft
  mentionedPassages: MentionedPassageDraft[]
  manuscript: string
  slideNotes: string
  sourceUploads: SourceUploadDraft[]
  reviewConfirmed: boolean
}

type PreparedSermon = {
  recordId: number
  syncId: string
  syncVersion: number
  currentRevision: string
  title: string
  speaker: string
  serviceDate: string
  passageLabel: string
  publicationStatus: string
  visibility: string
  bodyEntryCount: number
  mentionedPassageCount: number
  uploadedSourceCount: number
}

type PreparationResponse = {
  schemaVersion: 3
  created: boolean
  sermon: PreparedSermon
}

type SourceExtractionResponseSource = Omit<
  SourceUploadDraft,
  'clientId' | 'kind' | 'language' | 'reviewedText'
> & {
  suggestedKind: SourceUploadDraft['kind']
}

class PreparationApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'PreparationApiError'
    this.status = status
  }
}

function freshRequestId(): string {
  return globalThis.crypto.randomUUID()
}

function localToday(now = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function emptyDraft(): PreparationDraft {
  return {
    title: '',
    speaker: '',
    serviceDate: '',
    language: 'en',
    primaryPassage: {
      bookId: 'Eph',
      startChapter: '1',
      startVerse: '1',
      endChapter: '1',
      endVerse: '1',
    },
    mentionedPassages: [],
    manuscript: '',
    slideNotes: '',
    sourceUploads: [],
    reviewConfirmed: false,
  }
}

function positiveInteger(value: string): number {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : 0
}

function passageBody(passage: PassageDraft) {
  return {
    bookId: passage.bookId,
    startChapter: positiveInteger(passage.startChapter),
    startVerse: positiveInteger(passage.startVerse),
    endChapter: positiveInteger(passage.endChapter),
    endVerse: positiveInteger(passage.endVerse),
  }
}

function preparationBody(draft: PreparationDraft, requestId: string) {
  return {
    schemaVersion: 3,
    requestId,
    title: draft.title,
    speaker: draft.speaker,
    serviceDate: draft.serviceDate,
    language: draft.language,
    primaryPassage: passageBody(draft.primaryPassage),
    mentionedPassages: draft.mentionedPassages.map(passageBody),
    manuscript: draft.manuscript,
    slideNotes: draft.slideNotes,
    sourceUploads: draft.sourceUploads.map(source => ({
      token: source.token,
      kind: source.kind,
      language: source.language,
      reviewedText: source.reviewedText,
    })),
    reviewConfirmed: draft.reviewConfirmed,
  }
}

async function draftFingerprint(draft: PreparationDraft): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(preparationBody(draft, '')))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

function pendingRequestId(fingerprint: string): string | null {
  try {
    const raw = globalThis.sessionStorage.getItem(PENDING_IDENTITY_KEY)
    const value = raw ? JSON.parse(raw) as Record<string, unknown> : null
    return value
      && value.schemaVersion === 3
      && value.fingerprint === fingerprint
      && typeof value.requestId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId)
      ? value.requestId
      : null
  } catch {
    return null
  }
}

function rememberPendingIdentity(fingerprint: string, requestId: string) {
  try {
    globalThis.sessionStorage.setItem(PENDING_IDENTITY_KEY, JSON.stringify({
      schemaVersion: 3,
      fingerprint,
      requestId,
    }))
  } catch {
    // Browser storage is a retry aid only. Server-side idempotency still
    // protects retries that stay on this page.
  }
}

function clearPendingIdentity() {
  try {
    globalThis.sessionStorage.removeItem(PENDING_IDENTITY_KEY)
  } catch {
    // A completed response is already definitive even if storage is blocked.
  }
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index])
}

function parsePreparationResponse(value: unknown): PreparationResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Sermon preparation response is invalid.')
  }
  const response = value as Record<string, unknown>
  const sermon = response.sermon as Record<string, unknown> | undefined
  if (
    !hasExactKeys(response, ['schemaVersion', 'created', 'sermon'])
    || response.schemaVersion !== 3
    || typeof response.created !== 'boolean'
    || !sermon
    || !hasExactKeys(sermon, [
      'recordId',
      'syncId',
      'syncVersion',
      'currentRevision',
      'title',
      'speaker',
      'serviceDate',
      'passageLabel',
      'publicationStatus',
      'visibility',
      'bodyEntryCount',
      'mentionedPassageCount',
      'uploadedSourceCount',
    ])
    || !Number.isSafeInteger(sermon.recordId)
    || typeof sermon.syncId !== 'string'
    || !Number.isSafeInteger(sermon.syncVersion)
    || typeof sermon.currentRevision !== 'string'
    || !/^[a-f0-9]{64}$/.test(sermon.currentRevision)
    || typeof sermon.title !== 'string'
    || typeof sermon.speaker !== 'string'
    || typeof sermon.serviceDate !== 'string'
    || typeof sermon.passageLabel !== 'string'
    || typeof sermon.publicationStatus !== 'string'
    || typeof sermon.visibility !== 'string'
    || !Number.isSafeInteger(sermon.bodyEntryCount)
    || !Number.isSafeInteger(sermon.mentionedPassageCount)
    || Number(sermon.mentionedPassageCount) < 0
    || !Number.isSafeInteger(sermon.uploadedSourceCount)
    || Number(sermon.uploadedSourceCount) < 0
  ) {
    throw new Error('Sermon preparation response is invalid.')
  }
  return value as PreparationResponse
}

function parseSourceResponse(value: unknown): SourceExtractionResponseSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Pastor source extraction response is invalid.')
  }
  const response = value as Record<string, unknown>
  const source = response.source as Record<string, unknown> | undefined
  const references = source?.suggestedReferences
  if (
    !hasExactKeys(response, ['schemaVersion', 'source'])
    || response.schemaVersion !== 1
    || !source
    || !hasExactKeys(source, [
      'token',
      'fileName',
      'format',
      'mediaType',
      'sizeBytes',
      'sha256',
      'extractor',
      'extractedText',
      'extractedTextSha256',
      'suggestedKind',
      'suggestedTitle',
      'suggestedReferences',
    ])
    || typeof source.token !== 'string'
    || typeof source.fileName !== 'string'
    || typeof source.format !== 'string'
    || typeof source.mediaType !== 'string'
    || !Number.isSafeInteger(source.sizeBytes)
    || typeof source.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(source.sha256)
    || typeof source.extractor !== 'string'
    || typeof source.extractedText !== 'string'
    || typeof source.extractedTextSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(source.extractedTextSha256)
    || !['manuscript', 'slide-notes'].includes(String(source.suggestedKind))
    || (source.suggestedTitle !== null && typeof source.suggestedTitle !== 'string')
    || !Array.isArray(references)
  ) {
    throw new Error('Pastor source extraction response is invalid.')
  }
  return source as unknown as SourceExtractionResponseSource
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  if (value >= 1024) return `${Math.ceil(value / 1024)} KB`
  return `${value} bytes`
}

function errorMessage(error: unknown): string {
  if (error instanceof PreparationApiError) {
    if (error.status === 401) {
      return 'Your Community sign-in expired. Sign in again, then return to Prepare a sermon.'
    }
    if (error.status === 403) {
      return 'Your current Community role cannot prepare sermons. Ask an owner, admin, or leader.'
    }
    return error.message
  }
  return 'The Community server could not safely prepare this sermon. Try again without changing the form; the retry will reuse the same request identity.'
}

async function submitPreparation(
  draft: PreparationDraft,
  requestId: string,
): Promise<PreparationResponse> {
  const body = preparationBody(draft, requestId)
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(body),
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': `manager-sermon-${requestId}`,
    },
  })
  let value: unknown = null
  try {
    value = await response.json()
  } catch {
    if (response.ok) throw new Error('Sermon preparation response is not JSON.')
  }
  if (!response.ok) {
    const details = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
    throw new PreparationApiError(
      response.status,
      typeof details.error === 'string'
        ? details.error
        : `Sermon preparation failed (${response.status}).`,
    )
  }
  return parsePreparationResponse(value)
}

export default function PrepareSermonClient() {
  const [draft, setDraft] = useState<PreparationDraft>(emptyDraft)
  const [requestId, setRequestId] = useState(freshRequestId)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PreparationResponse | null>(null)
  const sourceInput = useRef<HTMLInputElement>(null)
  const selectedBook = useMemo(() => (
    CANONICAL_BIBLE_BOOKS.find(book => book.id === draft.primaryPassage.bookId)
      || CANONICAL_BIBLE_BOOKS[0]
  ), [draft.primaryPassage.bookId])
  const startVerseMaximum = canonicalBibleChapterVerseMaximum(
    selectedBook.id,
    positiveInteger(draft.primaryPassage.startChapter),
  ) ?? 0
  const endVerseMaximum = canonicalBibleChapterVerseMaximum(
    selectedBook.id,
    positiveInteger(draft.primaryPassage.endChapter),
  ) ?? 0

  function invalidatePriorAttempt() {
    setRequestId(freshRequestId())
    setError(null)
    setResult(null)
  }

  function updateField<
    K extends keyof Omit<PreparationDraft, 'primaryPassage' | 'mentionedPassages'>
  >(
    field: K,
    value: PreparationDraft[K],
  ) {
    setDraft(current => ({
      ...current,
      [field]: value,
      ...(field === 'reviewConfirmed' ? {} : { reviewConfirmed: false }),
    }))
    invalidatePriorAttempt()
  }

  function updatePassage(field: keyof PassageDraft, value: string) {
    setDraft(current => ({
      ...current,
      primaryPassage: { ...current.primaryPassage, [field]: value },
      reviewConfirmed: false,
    }))
    invalidatePriorAttempt()
  }

  function addMentionedPassage() {
    setDraft(current => {
      if (current.mentionedPassages.length >= MAX_MENTIONED_PASSAGES) return current
      return {
        ...current,
        mentionedPassages: [
          ...current.mentionedPassages,
          {
            clientId: freshRequestId(),
            bookId: current.primaryPassage.bookId,
            startChapter: '1',
            startVerse: '1',
            endChapter: '1',
            endVerse: '1',
          },
        ],
        reviewConfirmed: false,
      }
    })
    invalidatePriorAttempt()
  }

  function updateMentionedPassage(
    clientId: string,
    field: keyof PassageDraft,
    value: string,
  ) {
    setDraft(current => ({
      ...current,
      mentionedPassages: current.mentionedPassages.map(passage => (
        passage.clientId === clientId
          ? { ...passage, [field]: value }
          : passage
      )),
      reviewConfirmed: false,
    }))
    invalidatePriorAttempt()
  }

  function removeMentionedPassage(clientId: string) {
    setDraft(current => ({
      ...current,
      mentionedPassages: current.mentionedPassages.filter(
        passage => passage.clientId !== clientId,
      ),
      reviewConfirmed: false,
    }))
    invalidatePriorAttempt()
  }

  function updateSource(
    clientId: string,
    patch: Partial<Pick<SourceUploadDraft, 'kind' | 'language' | 'reviewedText'>>,
  ) {
    setDraft(current => ({
      ...current,
      sourceUploads: current.sourceUploads.map(source => (
        source.clientId === clientId ? { ...source, ...patch } : source
      )),
      reviewConfirmed: false,
    }))
    invalidatePriorAttempt()
  }

  function removeSource(clientId: string) {
    setDraft(current => ({
      ...current,
      sourceUploads: current.sourceUploads.filter(source => source.clientId !== clientId),
      reviewConfirmed: false,
    }))
    invalidatePriorAttempt()
  }

  function passageDraft(suggestion: PassageSuggestion): PassageDraft {
    return {
      bookId: suggestion.passage.bookId,
      startChapter: String(suggestion.passage.startChapter),
      startVerse: String(suggestion.passage.startVerse),
      endChapter: String(suggestion.passage.endChapter),
      endVerse: String(suggestion.passage.endVerse),
    }
  }

  function useSuggestedPrimary(suggestion: PassageSuggestion) {
    const next = passageDraft(suggestion)
    setDraft(current => ({
      ...current,
      primaryPassage: next,
      mentionedPassages: current.mentionedPassages.filter(passage => (
        JSON.stringify(passageBody(passage)) !== JSON.stringify(passageBody(next))
      )),
      reviewConfirmed: false,
    }))
    invalidatePriorAttempt()
  }

  function addSuggestedMention(suggestion: PassageSuggestion) {
    const next = passageDraft(suggestion)
    setDraft(current => {
      const key = JSON.stringify(passageBody(next))
      if (
        current.mentionedPassages.length >= MAX_MENTIONED_PASSAGES
        || JSON.stringify(passageBody(current.primaryPassage)) === key
        || current.mentionedPassages.some(passage => (
          JSON.stringify(passageBody(passage)) === key
        ))
      ) return current
      return {
        ...current,
        mentionedPassages: [
          ...current.mentionedPassages,
          { clientId: freshRequestId(), ...next },
        ],
        reviewConfirmed: false,
      }
    })
    invalidatePriorAttempt()
  }

  async function uploadSources(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || uploading) return
    if (draft.sourceUploads.length + files.length > MAX_SOURCE_UPLOADS) {
      setError(`Keep at most ${MAX_SOURCE_UPLOADS} pastor source files in one sermon.`)
      return
    }
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        const form = new FormData()
        form.set('file', file, file.name)
        const response = await fetch(SOURCE_ENDPOINT, {
          method: 'POST',
          body: form,
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        let value: unknown = null
        try {
          value = await response.json()
        } catch {
          // The error below keeps the response boundary explicit.
        }
        if (!response.ok) {
          const details = value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {}
          throw new PreparationApiError(
            response.status,
            typeof details.error === 'string'
              ? details.error
              : `Pastor source extraction failed (${response.status}).`,
          )
        }
        const source = parseSourceResponse(value)
        setDraft(current => ({
          ...current,
          title: current.title || source.suggestedTitle || '',
          sourceUploads: [
            ...current.sourceUploads,
            {
              ...source,
              clientId: freshRequestId(),
              kind: source.suggestedKind,
              language: current.language,
              reviewedText: source.extractedText,
            },
          ],
          reviewConfirmed: false,
        }))
      }
      invalidatePriorAttempt()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setUploading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || uploading || result) return
    setBusy(true)
    setError(null)
    try {
      const fingerprint = await draftFingerprint(draft)
      const effectiveRequestId = pendingRequestId(fingerprint) || requestId
      setRequestId(effectiveRequestId)
      rememberPendingIdentity(fingerprint, effectiveRequestId)
      const response = await submitPreparation(draft, effectiveRequestId)
      clearPendingIdentity()
      setResult(response)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  function startAnother() {
    clearPendingIdentity()
    setDraft(emptyDraft())
    setRequestId(freshRequestId())
    setError(null)
    setResult(null)
  }

  return (
    <section className="heritage-sermon-preparation">
      <header className="heritage-sermon-preparation__heading">
        <p className="heritage-admin-eyebrow">Planning</p>
        <h1>Prepare a sermon</h1>
        <p>
          Turn the pastor&apos;s reviewed manuscript or slide notes into one exact
          private sermon that can be selected in a service plan and read by
          SyncShow.
        </p>
      </header>

      <div className="heritage-sermon-preparation__boundary" role="note">
        <strong>This does not publish anything.</strong>
        <span>
          Uploaded originals stay in private content-addressed storage. Community
          retains the exact deterministic extraction and your editable reviewed
          copy; only a later manager publication review can expose selected text,
          audio, or an explicitly approved original download.
        </span>
      </div>

      {result && (
        <section className="heritage-sermon-preparation__success" aria-live="polite">
          <p className="heritage-admin-eyebrow">
            {result.created ? 'Sermon prepared' : 'Existing result recovered'}
          </p>
          <h2>{result.sermon.title}</h2>
          <p>
            {result.sermon.speaker} · {result.sermon.serviceDate} ·{' '}
            {result.sermon.passageLabel}
          </p>
          <p>
            Private {result.sermon.publicationStatus} record ·{' '}
            {result.sermon.bodyEntryCount}{' '}
            {result.sermon.bodyEntryCount === 1 ? 'written section' : 'written sections'}
            {' · '}
            {result.sermon.mentionedPassageCount}{' '}
            {result.sermon.mentionedPassageCount === 1
              ? 'confirmed other passage'
              : 'confirmed other passages'}
            {' · '}
            {result.sermon.uploadedSourceCount}{' '}
            {result.sermon.uploadedSourceCount === 1
              ? 'retained original'
              : 'retained originals'}
          </p>
          <div className="heritage-sermon-preparation__actions">
            <a className="btn btn--style-primary" href="/admin/plan-service">
              Add it to the shared service
            </a>
            <a className="btn" href="/admin/sermon-publications">
              Open publication review
            </a>
            <button className="btn" type="button" onClick={startAnother}>
              Prepare another sermon
            </button>
          </div>
          <details>
            <summary>Technical identity</summary>
            <code>{result.sermon.currentRevision}</code>
          </details>
        </section>
      )}

      {!result && (
        <form onSubmit={submit} className="heritage-sermon-preparation__form">
          <fieldset disabled={busy}>
            <legend>Pastor source files</legend>
            <p className="heritage-sermon-preparation__help">
              Upload PDF, DOCX, PPTX, Markdown, or text. Extraction is
              deterministic and only proposes text, a title, and Bible
              references. Review every proposal before confirmation.
            </p>
            <input
              ref={sourceInput}
              className="heritage-sermon-preparation__source-input"
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.md,.markdown,.txt,.text"
              disabled={busy || uploading || draft.sourceUploads.length >= MAX_SOURCE_UPLOADS}
              onChange={uploadSources}
            />
            <div className="heritage-sermon-preparation__source-actions">
              <button
                className="btn btn--style-primary"
                type="button"
                disabled={busy || uploading || draft.sourceUploads.length >= MAX_SOURCE_UPLOADS}
                onClick={() => sourceInput.current?.click()}
              >
                {uploading ? 'Extracting source…' : 'Upload pastor source'}
              </button>
              <span>{draft.sourceUploads.length} of {MAX_SOURCE_UPLOADS} retained</span>
            </div>
            {draft.sourceUploads.length === 0 ? (
              <p className="heritage-sermon-preparation__empty">
                No files uploaded. You may still paste reviewed text below.
              </p>
            ) : (
              <div className="heritage-sermon-preparation__sources">
                {draft.sourceUploads.map(source => (
                  <article className="heritage-sermon-preparation__source" key={source.clientId}>
                    <header>
                      <div>
                        <strong>{source.fileName}</strong>
                        <span>{source.format.toUpperCase()} · {formatBytes(source.sizeBytes)}</span>
                      </div>
                      <button className="btn" type="button" onClick={() => removeSource(source.clientId)}>
                        Remove
                      </button>
                    </header>
                    <p className="heritage-sermon-preparation__source-private">
                      Exact original retained privately · SHA-256 {source.sha256.slice(0, 12)}…
                    </p>
                    <div className="heritage-sermon-preparation__grid">
                      <label>
                        <span>Content type</span>
                        <select
                          value={source.kind}
                          onChange={event => updateSource(source.clientId, {
                            kind: event.target.value as SourceUploadDraft['kind'],
                          })}
                        >
                          <option value="manuscript">Pastor manuscript</option>
                          <option value="slide-notes">Sermon slide notes</option>
                        </select>
                      </label>
                      <label>
                        <span>Language</span>
                        <input
                          required
                          maxLength={35}
                          value={source.language}
                          onChange={event => updateSource(source.clientId, {
                            language: event.target.value,
                          })}
                        />
                      </label>
                    </div>
                    {source.suggestedTitle ? (
                      <div className="heritage-sermon-preparation__proposal">
                        <span>Suggested title: “{source.suggestedTitle}”</span>
                        <button className="btn" type="button" onClick={() => updateField('title', source.suggestedTitle || '')}>
                          Use title
                        </button>
                      </div>
                    ) : null}
                    {source.suggestedReferences.length ? (
                      <div className="heritage-sermon-preparation__proposals">
                        <strong>References found — confirm their role</strong>
                        {source.suggestedReferences.map(suggestion => (
                          <div className="heritage-sermon-preparation__proposal" key={`${source.clientId}-${suggestion.enteredText}`}>
                            <span>{suggestion.enteredText}</span>
                            <div>
                              <button className="btn" type="button" onClick={() => useSuggestedPrimary(suggestion)}>
                                Use as primary
                              </button>
                              <button className="btn" type="button" onClick={() => addSuggestedMention(suggestion)}>
                                Add as other
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="heritage-sermon-preparation__help">
                        No exact Bible references were proposed; enter them manually below.
                      </p>
                    )}
                    <label>
                      <span>Reviewed text used by the sermon</span>
                      <textarea
                        required
                        rows={14}
                        value={source.reviewedText}
                        onChange={event => updateSource(source.clientId, {
                          reviewedText: event.target.value,
                        })}
                      />
                    </label>
                    <details>
                      <summary>Compare deterministic extraction</summary>
                      <p>Extractor {source.extractor} · SHA-256 {source.extractedTextSha256}</p>
                      <pre>{source.extractedText}</pre>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset disabled={busy || uploading}>
            <legend>Service and speaker</legend>
            <div className="heritage-sermon-preparation__grid">
              <label>
                <span>Sermon title</span>
                <input
                  required
                  maxLength={300}
                  value={draft.title}
                  onChange={event => updateField('title', event.target.value)}
                  placeholder="Faithful Prayer"
                />
              </label>
              <label>
                <span>Speaker</span>
                <input
                  required
                  maxLength={200}
                  value={draft.speaker}
                  onChange={event => updateField('speaker', event.target.value)}
                  placeholder="Pastor name"
                />
              </label>
              <div className="heritage-sermon-preparation__date-field">
                <label htmlFor="sermon-service-date">Service date</label>
                <div className="heritage-sermon-preparation__date-control">
                  <input
                    id="sermon-service-date"
                    required
                    type="date"
                    value={draft.serviceDate}
                    onChange={event => updateField('serviceDate', event.target.value)}
                  />
                  <button
                    className="btn"
                    type="button"
                    onClick={() => updateField('serviceDate', localToday())}
                  >
                    Use today
                  </button>
                </div>
              </div>
              <label>
                <span>Content language</span>
                <input
                  required
                  maxLength={35}
                  value={draft.language}
                  onChange={event => updateField('language', event.target.value)}
                  placeholder="en"
                  aria-describedby="sermon-language-help"
                />
                <small id="sermon-language-help">Use a language tag such as en or ru.</small>
              </label>
            </div>
          </fieldset>

          <fieldset disabled={busy || uploading}>
            <legend>Confirmed primary passage</legend>
            <p className="heritage-sermon-preparation__help">
              Use the passage the congregation reads before this sermon. Exact
              verses let the Study Bible link the sermon back to this text.
            </p>
            <div className="heritage-sermon-preparation__passage">
              <label>
                <span>Book</span>
                <select
                  value={draft.primaryPassage.bookId}
                  onChange={event => updatePassage('bookId', event.target.value)}
                >
                  {CANONICAL_BIBLE_BOOKS.map(book => (
                    <option value={book.id} key={book.id}>{book.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Start chapter</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={selectedBook.chapters}
                  value={draft.primaryPassage.startChapter}
                  onChange={event => updatePassage('startChapter', event.target.value)}
                />
              </label>
              <label>
                <span>Start verse</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={startVerseMaximum}
                  value={draft.primaryPassage.startVerse}
                  onChange={event => updatePassage('startVerse', event.target.value)}
                />
              </label>
              <label>
                <span>End chapter</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={selectedBook.chapters}
                  value={draft.primaryPassage.endChapter}
                  onChange={event => updatePassage('endChapter', event.target.value)}
                />
              </label>
              <label>
                <span>End verse</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={endVerseMaximum}
                  value={draft.primaryPassage.endVerse}
                  onChange={event => updatePassage('endVerse', event.target.value)}
                />
              </label>
            </div>
          </fieldset>

          <fieldset disabled={busy || uploading}>
            <legend>Other passages used in this sermon</legend>
            <p className="heritage-sermon-preparation__help">
              Optional. Add only passages the sermon actually cites or explains.
              Once reviewed and published, each one powers the Study Bible&apos;s
              small “Appears in sermons” link for those verses. Exact duplicates,
              including the primary passage, are safely collapsed.
            </p>
            {draft.mentionedPassages.length === 0 && (
              <p className="heritage-sermon-preparation__empty">
                No other passages have been added.
              </p>
            )}
            <div className="heritage-sermon-preparation__mentioned-list">
              {draft.mentionedPassages.map((passage, index) => {
                const book = CANONICAL_BIBLE_BOOKS.find(
                  candidate => candidate.id === passage.bookId,
                ) || CANONICAL_BIBLE_BOOKS[0]
                const mentionedStartVerseMaximum = canonicalBibleChapterVerseMaximum(
                  book.id,
                  positiveInteger(passage.startChapter),
                ) ?? 0
                const mentionedEndVerseMaximum = canonicalBibleChapterVerseMaximum(
                  book.id,
                  positiveInteger(passage.endChapter),
                ) ?? 0
                const labelPrefix = `Other passage ${index + 1}`
                return (
                  <section
                    className="heritage-sermon-preparation__mentioned-row"
                    aria-label={labelPrefix}
                    key={passage.clientId}
                  >
                    <div className="heritage-sermon-preparation__mentioned-heading">
                      <strong>{labelPrefix}</strong>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => removeMentionedPassage(passage.clientId)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="heritage-sermon-preparation__passage">
                      <label>
                        <span>Book</span>
                        <select
                          value={passage.bookId}
                          onChange={event => updateMentionedPassage(
                            passage.clientId,
                            'bookId',
                            event.target.value,
                          )}
                        >
                          {CANONICAL_BIBLE_BOOKS.map(candidate => (
                            <option value={candidate.id} key={candidate.id}>
                              {candidate.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Start chapter</span>
                        <input
                          required
                          type="number"
                          min={1}
                          max={book.chapters}
                          value={passage.startChapter}
                          onChange={event => updateMentionedPassage(
                            passage.clientId,
                            'startChapter',
                            event.target.value,
                          )}
                        />
                      </label>
                      <label>
                        <span>Start verse</span>
                        <input
                          required
                          type="number"
                          min={1}
                          max={mentionedStartVerseMaximum}
                          value={passage.startVerse}
                          onChange={event => updateMentionedPassage(
                            passage.clientId,
                            'startVerse',
                            event.target.value,
                          )}
                        />
                      </label>
                      <label>
                        <span>End chapter</span>
                        <input
                          required
                          type="number"
                          min={1}
                          max={book.chapters}
                          value={passage.endChapter}
                          onChange={event => updateMentionedPassage(
                            passage.clientId,
                            'endChapter',
                            event.target.value,
                          )}
                        />
                      </label>
                      <label>
                        <span>End verse</span>
                        <input
                          required
                          type="number"
                          min={1}
                          max={mentionedEndVerseMaximum}
                          value={passage.endVerse}
                          onChange={event => updateMentionedPassage(
                            passage.clientId,
                            'endVerse',
                            event.target.value,
                          )}
                        />
                      </label>
                    </div>
                  </section>
                )
              })}
            </div>
            <div className="heritage-sermon-preparation__mentioned-actions">
              <button
                className="btn"
                type="button"
                disabled={draft.mentionedPassages.length >= MAX_MENTIONED_PASSAGES}
                onClick={addMentionedPassage}
              >
                Add another passage
              </button>
              <span aria-live="polite">
                {draft.mentionedPassages.length} of {MAX_MENTIONED_PASSAGES} added
              </span>
            </div>
          </fieldset>

          <fieldset disabled={busy || uploading}>
            <legend>Reviewed sermon text</legend>
            <p className="heritage-sermon-preparation__help">
              Uploaded reviewed text counts as a source. You may also paste
              text directly; line breaks are preserved and nothing is
              summarized or rewritten.
            </p>
            <label>
              <span>Pastor&apos;s manuscript</span>
              <textarea
                rows={16}
                value={draft.manuscript}
                onChange={event => updateField('manuscript', event.target.value)}
                placeholder="Paste the pastor's sermon writeup here."
              />
            </label>
            <label>
              <span>Slide notes</span>
              <textarea
                rows={10}
                value={draft.slideNotes}
                onChange={event => updateField('slideNotes', event.target.value)}
                placeholder="Paste the text intended for sermon slides here."
              />
            </label>
          </fieldset>

          <label className="heritage-sermon-preparation__confirmation">
            <input
              type="checkbox"
              disabled={busy || uploading}
              checked={draft.reviewConfirmed}
              onChange={event => updateField('reviewConfirmed', event.target.checked)}
            />
            <span>
              I reviewed the title, speaker, date, primary passage, every other
              passage listed above, each uploaded original and deterministic
              extraction, and all reviewed or pasted text. Create one private
              Ready sermon for service planning.
            </span>
          </label>

          {error && <p className="heritage-sermon-preparation__error" role="alert">{error}</p>}

          <div className="heritage-sermon-preparation__actions">
            <button
              className="btn btn--style-primary"
              type="submit"
              disabled={busy || uploading || !draft.reviewConfirmed}
            >
              {busy ? 'Preparing sermon…' : 'Create private Ready sermon'}
            </button>
            {busy ? (
              <span className="btn" aria-disabled="true">Cancel</span>
            ) : (
              <a className="btn" href="/admin">Cancel</a>
            )}
          </div>
        </form>
      )}
    </section>
  )
}

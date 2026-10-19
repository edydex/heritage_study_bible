'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  buildSermonPublishIntent,
  buildSermonWithdrawIntent,
  createEmptyPublicationReviewDraft,
  directAudioPreviewUrl,
  hasDirectAudioDraft,
  isPublicMediaSelectable,
  isSermonPublicationConflict,
  managedRecordingInventoryMatchesDetail,
  parseManagedRecordingInventory,
  parseSermonPublicationDetail,
  parseSermonPublicationList,
  parseSermonPublicationMutationResponse,
  resolveSermonPublicationReviewTarget,
  reviewableSermonPublications,
  SermonPublicationReviewDataError,
  type ManagedRecordingInventory,
  type PublicationReviewDraft,
  type SermonMediaReviewEntry,
  type SermonPublicationDetail,
  type SermonPublicationListItem,
  type SermonPublicationReviewTarget,
} from './sermonPublicationReviewModel'
import { formatBibleRange } from '@/lib/syncshow/BibleRange'

const LIST_PATH = '/api/community/sermon-publications'

type BusyAction = 'publish' | 'withdraw' | null
type Notice = { kind: 'success' | 'info'; text: string }
type MutationClaim = Readonly<{
  id: number
  syncId: string
  detailRequest: number
}>
type ManagedRecordingState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'ready'; inventory: ManagedRecordingInventory }>
  | Readonly<{ kind: 'error'; message: string }>
type SermonPublicationReviewClientProps = Readonly<{
  initialTarget: SermonPublicationReviewTarget
}>

class PublicationReviewApiError extends Error {
  status: number
  code: string | null

  constructor(status: number, code: string | null, message: string) {
    super(message)
    this.name = 'PublicationReviewApiError'
    this.status = status
    this.code = code
  }
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof PublicationReviewApiError) {
    if (error.status === 401) {
      return 'Your Community sign-in expired. Sign in again, then return to sermon review.'
    }
    if (error.status === 403) {
      return 'Your current Community role cannot review sermon publication. Ask an owner, admin, or leader.'
    }
    return error.message
  }
  if (error instanceof SermonPublicationReviewDataError) {
    return 'The Community server returned sermon review data this page cannot safely use. Refresh after the server is updated.'
  }
  return 'The Community server could not complete this request. Try again.'
}

function invalidTargetMessage(
  target: Extract<SermonPublicationReviewTarget, { kind: 'invalid' }>,
): string {
  if (target.reason === 'missing') {
    return 'SyncShow opened sermon review without a sermon ID. Nothing was opened automatically; choose a sermon from the list.'
  }
  if (target.reason === 'ambiguous') {
    return 'SyncShow opened sermon review with more than one sermon ID. Nothing was opened automatically; choose a sermon from the list.'
  }
  return 'SyncShow opened sermon review with an invalid sermon ID. Nothing was opened automatically; choose a sermon from the list.'
}

function unavailableTargetMessage(syncId: string): string {
  return `The exact sermon requested by SyncShow (${syncId}) is not available for review in this Community. It may be stale, not Ready, no longer public, archived, or from another Community. Nothing else was opened automatically.`
}

async function requestJson(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<unknown> {
  const response = await fetch(path, {
    method: options.method || 'GET',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
  })
  let value: unknown = null
  try {
    value = await response.json()
  } catch {
    if (response.ok) {
      throw new SermonPublicationReviewDataError(
        'Sermon publication response is not JSON.',
      )
    }
  }
  if (!response.ok) {
    const body = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
    const code = typeof body.code === 'string' ? body.code : null
    const message = typeof body.error === 'string'
      ? body.error
      : `Sermon publication request failed (${response.status}).`
    throw new PublicationReviewApiError(response.status, code, message)
  }
  return value
}

function detailPath(syncId: string): string {
  return `${LIST_PATH}/${encodeURIComponent(syncId)}`
}

function managedRecordingsPath(syncId: string): string {
  return `${detailPath(syncId)}/managed-recordings`
}

function managedRecordingBytePath(
  syncId: string,
  reviewId: string,
  action: 'content' | 'download',
): string {
  return `${managedRecordingsPath(syncId)}/${
    encodeURIComponent(reviewId)
  }/${action}`
}

function statusLabels(item: SermonPublicationListItem): string[] {
  const labels: string[] = []
  if (item.publication?.active) labels.push('Public now')
  if (item.publicationStatus === 'ready') {
    labels.push(item.publication?.active ? 'Update ready' : 'Ready for review')
  }
  return labels
}

function formatBytes(size: number | null): string | null {
  if (size === null) return null
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function mediaAvailability(media: SermonMediaReviewEntry): string {
  if (isPublicMediaSelectable(media)) return 'Ready at a public HTTPS link'
  if (media.status !== 'ready') return `Not selectable — ${media.status}`
  return 'Not selectable — no public HTTPS link'
}

function toggleId(
  values: readonly string[],
  id: string,
  checked: boolean,
): string[] {
  if (checked) return values.includes(id) ? [...values] : [...values, id]
  return values.filter(value => value !== id)
}

export default function SermonPublicationReviewClient({
  initialTarget,
}: SermonPublicationReviewClientProps) {
  const [items, setItems] = useState<readonly SermonPublicationListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [targetError, setTargetError] = useState<string | null>(() => (
    initialTarget.kind === 'invalid'
      ? invalidTargetMessage(initialTarget)
      : null
  ))
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SermonPublicationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [managedRecordingState, setManagedRecordingState] =
    useState<ManagedRecordingState>({ kind: 'idle' })
  const [managedPlaybackErrors, setManagedPlaybackErrors] =
    useState<readonly string[]>([])
  const [draft, setDraft] = useState<PublicationReviewDraft>(
    createEmptyPublicationReviewDraft,
  )
  const [withdrawalConfirmed, setWithdrawalConfirmed] = useState(false)
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const listRequest = useRef(0)
  const detailRequest = useRef(0)
  const selectedSyncIdRef = useRef<string | null>(null)
  const mutationRequest = useRef(0)
  const activeMutation = useRef<MutationClaim | null>(null)

  const loadList = useCallback(async (): Promise<
    readonly SermonPublicationListItem[] | null
  > => {
    const request = ++listRequest.current
    setListLoading(true)
    setListError(null)
    try {
      const parsed = parseSermonPublicationList(await requestJson(LIST_PATH))
      const reviewable = reviewableSermonPublications(parsed)
      if (request !== listRequest.current) return null
      setItems(reviewable)
      return reviewable
    } catch (error) {
      if (request !== listRequest.current) return null
      setListError(apiErrorMessage(error))
      return null
    } finally {
      if (request === listRequest.current) setListLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (syncId: string): Promise<boolean> => {
    const request = ++detailRequest.current
    selectedSyncIdRef.current = syncId
    setSelectedSyncId(syncId)
    setDetail(null)
    setDetailLoading(true)
    setDetailError(null)
    setMutationError(null)
    setStale(false)
    setManagedRecordingState({ kind: 'loading' })
    setManagedPlaybackErrors([])
    setDraft(createEmptyPublicationReviewDraft())
    setWithdrawalConfirmed(false)
    try {
      const parsed = parseSermonPublicationDetail(
        await requestJson(detailPath(syncId)),
      )
      if (request !== detailRequest.current || parsed.sermon.syncId !== syncId) {
        return false
      }
      setDetail(parsed)
      setDraft(createEmptyPublicationReviewDraft(
        parsed.sermon.document.defaultLanguage,
      ))
      void (async () => {
        try {
          const inventory = parseManagedRecordingInventory(
            await requestJson(managedRecordingsPath(syncId)),
          )
          if (request !== detailRequest.current) return
          if (!managedRecordingInventoryMatchesDetail(inventory, parsed)) {
            setManagedRecordingState({
              kind: 'error',
              message: 'The preserved-recording inventory changed with the sermon revision. Refresh before reviewing either one.',
            })
            setStale(true)
            setDraft(createEmptyPublicationReviewDraft())
            return
          }
          setManagedRecordingState({ kind: 'ready', inventory })
        } catch (error) {
          if (request !== detailRequest.current) return
          setManagedRecordingState({
            kind: 'error',
            message: apiErrorMessage(error),
          })
        }
      })()
      return true
    } catch (error) {
      if (request !== detailRequest.current) return false
      setDetailError(apiErrorMessage(error))
      setManagedRecordingState({ kind: 'idle' })
      return false
    } finally {
      if (request === detailRequest.current) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    async function loadInitialReview() {
      const reviewable = await loadList()
      if (!reviewable) return
      const resolution = resolveSermonPublicationReviewTarget(
        initialTarget,
        reviewable,
      )
      if (resolution.kind === 'select') {
        setTargetError(null)
        await loadDetail(resolution.syncId)
      } else if (resolution.kind === 'unavailable') {
        detailRequest.current += 1
        selectedSyncIdRef.current = null
        setSelectedSyncId(null)
        setDetail(null)
        setDetailError(null)
        setManagedRecordingState({ kind: 'idle' })
        setTargetError(unavailableTargetMessage(resolution.syncId))
      }
    }
    void loadInitialReview()
    return () => {
      listRequest.current += 1
      detailRequest.current += 1
      selectedSyncIdRef.current = null
    }
  }, [initialTarget, loadDetail, loadList])

  const readyToPublish = Boolean(
    detail
    && !detail.sermon.archived
    && detail.sermon.document.publication.status === 'ready',
  )
  const selectedExistingAudio = Boolean(detail?.sermon.document.media.some(media => (
    media.kind === 'audio' && draft.selectedMediaIds.includes(media.id)
  )))
  const publishableManagedRecordings = managedRecordingState.kind === 'ready'
    ? managedRecordingState.inventory.recordings.filter(recording => (
        recording.eligibility === 'publishable'
      ))
    : []
  const selectedManagedRecording = publishableManagedRecordings.find(recording => (
    recording.reviewId === draft.managedRecordingReviewId
  )) || null
  const hasProposedRecording = (
    hasDirectAudioDraft(draft) || draft.managedRecordingReviewId !== null
  )
  const audioNeedsWrittenAlternative = (
    hasProposedRecording || selectedExistingAudio
  )
  const confirmationsComplete = (
    draft.bodySelectionConfirmed
    && draft.mediaSelectionConfirmed
    && draft.publicAudienceConfirmed
    && draft.canonicalLinkConfirmed
    && (!audioNeedsWrittenAlternative || draft.selectedBodyEntryIds.length > 0)
    && (!hasProposedRecording || draft.recordingRightsAndPrivacyConfirmed)
  )
  const mutationDisabled = busyAction !== null || stale
  const recordingPreviewUrl = directAudioPreviewUrl(draft.directAudio.url)

  function claimMutation(
    action: Exclude<BusyAction, null>,
    syncId: string,
  ): MutationClaim | null {
    if (activeMutation.current) return null
    const claim = Object.freeze({
      id: ++mutationRequest.current,
      syncId,
      detailRequest: detailRequest.current,
    })
    activeMutation.current = claim
    setBusyAction(action)
    return claim
  }

  function mutationClaimIsCurrent(claim: MutationClaim): boolean {
    return activeMutation.current?.id === claim.id
      && selectedSyncIdRef.current === claim.syncId
      && detailRequest.current === claim.detailRequest
  }

  function releaseMutation(claim: MutationClaim) {
    if (activeMutation.current?.id !== claim.id) return
    activeMutation.current = null
    setBusyAction(null)
  }

  function updateBodySelection(id: string, checked: boolean) {
    setDraft(current => ({
      ...current,
      selectedBodyEntryIds: toggleId(
        current.selectedBodyEntryIds,
        id,
        checked,
      ),
      bodySelectionConfirmed: false,
    }))
  }

  function updateMediaSelection(id: string, checked: boolean) {
    setDraft(current => ({
      ...current,
      selectedMediaIds: toggleId(
        current.selectedMediaIds,
        id,
        checked,
      ),
      mediaSelectionConfirmed: false,
    }))
  }

  function updateDirectAudio(
    changes: Partial<PublicationReviewDraft['directAudio']>,
  ) {
    setDraft(current => {
      const directAudio = {
        ...current.directAudio,
        ...changes,
      }
      return {
        ...current,
        managedRecordingReviewId: directAudio.url.trim() ? null : (
          current.managedRecordingReviewId
        ),
        directAudio,
        mediaSelectionConfirmed: false,
        recordingRightsAndPrivacyConfirmed: false,
      }
    })
  }

  function updateManagedRecordingSelection(reviewId: string | null) {
    if (
      reviewId !== null
      && !publishableManagedRecordings.some(recording => (
        recording.reviewId === reviewId
      ))
    ) {
      return
    }
    setDraft(current => ({
      ...current,
      managedRecordingReviewId: reviewId,
      directAudio: reviewId === null
        ? current.directAudio
        : { ...current.directAudio, url: '' },
      mediaSelectionConfirmed: false,
      recordingRightsAndPrivacyConfirmed: false,
    }))
  }

  function handleMutationFailure(error: unknown, claim: MutationClaim) {
    if (!mutationClaimIsCurrent(claim)) return
    if (
      error instanceof PublicationReviewApiError
      && isSermonPublicationConflict(error.status, error.code)
    ) {
      setStale(true)
      setDraft(createEmptyPublicationReviewDraft())
      setWithdrawalConfirmed(false)
      setManagedRecordingState({ kind: 'idle' })
      setMutationError(
        'This sermon or its public pointer changed after you opened it. Your choices were cleared. Refresh the current revision before deciding again.',
      )
      return
    }
    setMutationError(apiErrorMessage(error))
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!detail || mutationDisabled) return
    setMutationError(null)
    let intent
    try {
      intent = buildSermonPublishIntent(
        detail,
        draft,
        managedRecordingState.kind === 'ready'
          ? managedRecordingState.inventory
          : null,
      )
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : apiErrorMessage(error),
      )
      return
    }
    const claim = claimMutation('publish', detail.sermon.syncId)
    if (!claim) return
    try {
      parseSermonPublicationMutationResponse(await requestJson(
        `${detailPath(detail.sermon.syncId)}/publish`,
        { method: 'POST', body: intent },
      ))
      if (!mutationClaimIsCurrent(claim)) return
      const syncId = detail.sermon.syncId
      setDetail(null)
      setDraft(createEmptyPublicationReviewDraft())
      setWithdrawalConfirmed(false)
      setNotice({
        kind: 'success',
        text: 'The exact choices were published. This review has been reset so nothing is carried into a later approval.',
      })
      await loadList()
      if (!mutationClaimIsCurrent(claim)) return
      await loadDetail(syncId)
    } catch (error) {
      handleMutationFailure(error, claim)
    } finally {
      releaseMutation(claim)
    }
  }

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!detail || mutationDisabled || !withdrawalConfirmed) return
    setMutationError(null)
    let intent
    try {
      intent = buildSermonWithdrawIntent(detail)
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : apiErrorMessage(error),
      )
      return
    }
    const claim = claimMutation('withdraw', detail.sermon.syncId)
    if (!claim) return
    try {
      const response = parseSermonPublicationMutationResponse(await requestJson(
        `${detailPath(detail.sermon.syncId)}/withdraw`,
        { method: 'POST', body: intent },
      ))
      if (!mutationClaimIsCurrent(claim)) return
      const syncId = detail.sermon.syncId
      setDetail(current => current && current.sermon.syncId === syncId
        ? {
            ...current,
            sermon: {
              ...current.sermon,
              syncVersion: response.sermon.syncVersion,
              currentRevision: response.sermon.currentRevision,
              updatedAt: response.sermon.updatedAt,
              archived: response.sermon.archived,
            },
            publication: response.publication,
          }
        : current)
      setDraft(createEmptyPublicationReviewDraft())
      setWithdrawalConfirmed(false)
      setNotice({
        kind: 'success',
        text: 'Public access was withdrawn. The approved audit record remains available to the server.',
      })
      const refreshed = await loadList()
      if (!mutationClaimIsCurrent(claim)) return
      if (refreshed?.some(item => item.syncId === syncId)) {
        await loadDetail(syncId)
      } else if (refreshed) {
        detailRequest.current += 1
        selectedSyncIdRef.current = null
        setSelectedSyncId(null)
        setDetail(null)
        setDetailError(null)
        setManagedRecordingState({ kind: 'idle' })
      }
    } catch (error) {
      handleMutationFailure(error, claim)
    } finally {
      releaseMutation(claim)
    }
  }

  async function refreshStaleDetail() {
    if (!selectedSyncId) return
    setNotice({
      kind: 'info',
      text: 'Loading the current sermon revision. Review every choice again before publishing.',
    })
    await Promise.all([loadList(), loadDetail(selectedSyncId)])
  }

  return (
    <main className="heritage-sermon-review">
      <header className="heritage-sermon-review__header">
        <div>
          <p className="heritage-admin-eyebrow">SyncShow publication</p>
          <h1>Review sermons for public access</h1>
          <p>
            Choose the exact written sections and media links that may leave the
            private Community workspace. Nothing is selected automatically.
          </p>
        </div>
        <a href="/admin">Back to admin home</a>
      </header>

      {notice && (
        <p
          className={`heritage-review-notice heritage-review-notice--${notice.kind}`}
          role="status"
          aria-live="polite"
        >
          {notice.text}
        </p>
      )}

      {targetError && (
        <p className="heritage-review-error" role="alert">
          {targetError}
        </p>
      )}

      <div className="heritage-sermon-review__layout">
        <aside className="heritage-sermon-review__list" aria-label="Sermons awaiting review">
          <div className="heritage-review-panel-heading">
            <div>
              <h2>Sermons</h2>
              <p>Ready in SyncShow or public now</p>
            </div>
            <button
              type="button"
              className="heritage-review-button heritage-review-button--quiet"
              onClick={() => void loadList()}
              disabled={listLoading || busyAction !== null}
            >
              {listLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {listError && <p className="heritage-review-error" role="alert">{listError}</p>}
          {!listLoading && !listError && items.length === 0 && (
            <p className="heritage-review-empty">
              No SyncShow sermon is Ready or currently public.
            </p>
          )}
          <div className="heritage-review-items">
            {items.map(item => (
              <button
                type="button"
                className={`heritage-review-item${
                  selectedSyncId === item.syncId ? ' heritage-review-item--selected' : ''
                }`}
                key={item.syncId}
                aria-current={selectedSyncId === item.syncId ? 'true' : undefined}
                disabled={busyAction !== null}
                onClick={() => {
                  setTargetError(null)
                  setNotice(null)
                  void loadDetail(item.syncId)
                }}
              >
                <strong>{item.title}</strong>
                <span>{item.speaker} · {item.serviceDate}</span>
                <span className="heritage-review-item__statuses">
                  {statusLabels(item).map(label => (
                    <span key={label}>{label}</span>
                  ))}
                  {item.archived && <span>Archived</span>}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="heritage-sermon-review__detail" aria-live="polite">
          {!selectedSyncId && !detailLoading && (
            <div className="heritage-review-placeholder">
              <h2>Choose a sermon</h2>
              <p>
                Open one sermon to inspect the current canonical body and media
                inventory. The page will still begin with no proposed choices.
              </p>
            </div>
          )}
          {detailLoading && (
            <div className="heritage-review-placeholder" role="status">
              <h2>Loading the exact current revision…</h2>
            </div>
          )}
          {detailError && !detailLoading && (
            <div className="heritage-review-placeholder">
              <p className="heritage-review-error" role="alert">{detailError}</p>
              {selectedSyncId && (
                <button
                  type="button"
                  className="heritage-review-button"
                  onClick={() => void loadDetail(selectedSyncId)}
                  disabled={busyAction !== null}
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {detail && !detailLoading && (
            <>
              <header className="heritage-review-detail-heading">
                <div>
                  <p className="heritage-admin-eyebrow">Current SyncShow revision</p>
                  <h2>{detail.sermon.document.title}</h2>
                  <p>
                    {detail.sermon.document.speaker} · {detail.sermon.document.serviceDate}
                    {detail.sermon.document.seriesTitle
                      ? ` · ${detail.sermon.document.seriesTitle}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="heritage-review-button heritage-review-button--quiet"
                  onClick={() => void loadDetail(detail.sermon.syncId)}
                  disabled={busyAction !== null}
                >
                  Refresh revision
                </button>
              </header>

              <dl className="heritage-review-summary">
                <div>
                  <dt>SyncShow state</dt>
                  <dd>{detail.sermon.document.publication.status}</dd>
                </div>
                <div>
                  <dt>Current visibility</dt>
                  <dd>{detail.sermon.document.publication.visibility}</dd>
                </div>
                <div className="heritage-review-summary__wide">
                  <dt>Canonical sermon link</dt>
                  <dd>
                    {detail.sermon.document.publication.canonicalUrl ? (
                      <a
                        href={detail.sermon.document.publication.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {detail.sermon.document.publication.canonicalUrl}
                      </a>
                    ) : (
                      'No canonical website link is set. This may be intentional.'
                    )}
                  </dd>
                </div>
              </dl>

              <section
                className="heritage-review-references"
                aria-labelledby="heritage-review-references-heading"
              >
                <div>
                  <h3 id="heritage-review-references-heading">Passage discovery</h3>
                  <p>
                    Confirmed primary passages appear prominently in the Study Bible.
                    Confirmed mentioned passages power its small “Appears in sermons”
                    link. Suggested references stay private.
                  </p>
                </div>
                {detail.sermon.document.references.length === 0 ? (
                  <p className="heritage-review-references__empty" role="alert">
                    This exact revision has no Scripture references to publish.
                  </p>
                ) : (
                  <ul>
                    {detail.sermon.document.references.map(reference => (
                      <li key={reference.id}>
                        <strong>
                          {reference.enteredText || formatBibleRange(reference.range)}
                        </strong>
                        <span>
                          {reference.role === 'primary'
                            ? 'Primary passage'
                            : 'Mentioned passage'}
                          {' · '}
                          {reference.reviewStatus}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {detail.publication?.active && (
                <section className="heritage-current-publication">
                  <div>
                    <strong>Public now</strong>
                    <span>
                      Approved {detail.publication.publishedAt} with{' '}
                      {detail.publication.selectedBodyEntryIds.length} written{' '}
                      {detail.publication.selectedBodyEntryIds.length === 1 ? 'section' : 'sections'} and{' '}
                      {detail.publication.selectedMediaIds.length} media{' '}
                      {detail.publication.selectedMediaIds.length === 1 ? 'item' : 'items'}.
                    </span>
                  </div>
                  <details>
                    <summary>Current public selection IDs</summary>
                    <p>
                      These IDs belong to the approved public revision, which may
                      differ from the current SyncShow inventory below.
                    </p>
                    <p>
                      Written: {detail.publication.selectedBodyEntryIds.join(', ') || 'none'}
                    </p>
                    <p>
                      Media: {detail.publication.selectedMediaIds.join(', ') || 'none'}
                    </p>
                  </details>
                </section>
              )}

              {detail.publication && !detail.publication.active && (
                <p className="heritage-review-notice heritage-review-notice--info">
                  A previous public publication was withdrawn on{' '}
                  {detail.publication.withdrawnAt || 'an unavailable date'}.
                </p>
              )}

              {stale && (
                <div className="heritage-review-conflict" role="alert">
                  <strong>Refresh required</strong>
                  <p>
                    The sermon or publication changed while this page was open.
                    All proposed choices were cleared to prevent stale approval.
                  </p>
                  <button
                    type="button"
                    className="heritage-review-button"
                    onClick={() => void refreshStaleDetail()}
                    disabled={busyAction !== null}
                  >
                    Load current revision
                  </button>
                </div>
              )}

              {mutationError && <p className="heritage-review-error" role="alert">{mutationError}</p>}

              {!readyToPublish && (
                <p className="heritage-review-notice heritage-review-notice--info">
                  {detail.sermon.archived
                    ? 'This sermon is archived and cannot be published or withdrawn.'
                    : 'The current revision is not Ready. Make changes in SyncShow and mark the revision Ready before approving a new publication.'}
                </p>
              )}

              <section
                className="heritage-review-recording heritage-review-recording--private"
                aria-labelledby="private-community-recordings-heading"
                aria-busy={managedRecordingState.kind === 'loading'}
              >
                <div>
                  <h3 id="private-community-recordings-heading">
                    Private Community recordings
                  </h3>
                  <p>
                    Listen to or download the exact bytes preserved after SyncShow
                    upload. These manager-only controls select and publish nothing;
                    the public-recording choice remains below.
                  </p>
                </div>
                {managedRecordingState.kind === 'loading' && (
                  <p role="status" aria-live="polite">
                    Loading preserved recordings…
                  </p>
                )}
                {managedRecordingState.kind === 'error' && (
                  <div className="heritage-review-error" role="alert">
                    <p>{managedRecordingState.message}</p>
                    <button
                      type="button"
                      className="heritage-review-button heritage-review-button--quiet"
                      onClick={() => void loadDetail(detail.sermon.syncId)}
                      disabled={busyAction !== null}
                    >
                      Retry private recording review
                    </button>
                  </div>
                )}
                {managedRecordingState.kind === 'ready'
                  && managedRecordingState.inventory.recordings.length === 0 && (
                  <p className="heritage-review-empty">
                    No completed recording has been preserved for this sermon yet.
                  </p>
                )}
                {managedRecordingState.kind === 'ready'
                  && managedRecordingState.inventory.recordings.length > 0 && (
                  <div className="heritage-review-inventory">
                    {managedRecordingState.inventory.recordings.map(recording => {
                      const contentPath = managedRecordingBytePath(
                        detail.sermon.syncId,
                        recording.reviewId,
                        'content',
                      )
                      const downloadPath = managedRecordingBytePath(
                        detail.sermon.syncId,
                        recording.reviewId,
                        'download',
                      )
                      const playbackFailed = managedPlaybackErrors.includes(
                        recording.reviewId,
                      )
                      return (
                        <article className="heritage-review-choice" key={recording.reviewId}>
                          <div className="heritage-review-choice__heading">
                            <div>
                              <strong>{recording.title}</strong>
                              <span>
                                {recording.fileName} · {recording.mediaType} ·{' '}
                                {formatBytes(recording.sizeBytes)}
                              </span>
                            </div>
                          </div>
                          <p className="heritage-review-choice__availability">
                            {recording.eligibility === 'publishable'
                              ? 'Matches the current canonical sermon slot'
                              : 'Review only — preserved from an earlier sermon revision'}
                            {' · completed '}
                            {new Date(recording.completedAt).toLocaleString()}
                          </p>
                          <div className="heritage-review-recording__preview">
                            <audio
                              controls
                              preload="none"
                              src={contentPath}
                              aria-label={`Private playback of ${recording.title}`}
                              onCanPlay={() => setManagedPlaybackErrors(current =>
                                current.filter(id => id !== recording.reviewId)
                              )}
                              onError={() => setManagedPlaybackErrors(current =>
                                current.includes(recording.reviewId)
                                  ? current
                                  : [...current, recording.reviewId]
                              )}
                            />
                            {playbackFailed && (
                              <p className="heritage-review-error" role="alert">
                                Private playback could not start. Refresh your sign-in
                                or retry this sermon; the public proposal is unchanged.
                              </p>
                            )}
                            <a
                              href={downloadPath}
                              download
                              aria-label={`Download original ${recording.title}`}
                            >
                              Download original
                            </a>
                          </div>
                          <details>
                            <summary>Recording integrity details</summary>
                            <p>
                              Slot <code>{recording.slotId}</code><br />
                              SHA-256 <code>{recording.sha256}</code>
                            </p>
                          </details>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>

              <form onSubmit={publish}>
                <fieldset
                  className="heritage-review-fieldset"
                  disabled={mutationDisabled || !readyToPublish}
                >
                  <legend>1. Choose written content</legend>
                  <p>
                    Select only the exact sections that may be public. Existing
                    public choices are never copied into this proposal.
                  </p>
                  {detail.sermon.document.body.length === 0 ? (
                    <p className="heritage-review-empty">This revision has no written body entries.</p>
                  ) : (
                    <div className="heritage-review-inventory">
                      {detail.sermon.document.body.map((entry, index) => {
                        const inputId = `sermon-body-${index}`
                        return (
                          <article className="heritage-review-choice" key={entry.id}>
                            <div className="heritage-review-choice__heading">
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={draft.selectedBodyEntryIds.includes(entry.id)}
                                onChange={event => updateBodySelection(
                                  entry.id,
                                  event.currentTarget.checked,
                                )}
                              />
                              <label htmlFor={inputId}>
                                <strong>{entry.kind}</strong>
                                <span>{entry.language} · entry {index + 1}</span>
                              </label>
                            </div>
                            <details>
                              <summary>Read exact text</summary>
                              <pre>{entry.text}</pre>
                            </details>
                          </article>
                        )
                      })}
                    </div>
                  )}
                  {draft.selectedBodyEntryIds.length === 0 && (
                    <p className="heritage-review-warning">
                      {audioNeedsWrittenAlternative
                        ? 'Select a written sermon section before publishing the selected audio.'
                        : 'No written content is selected. A metadata-only publication is allowed, but readers will receive no notes or transcript.'}
                    </p>
                  )}
                  <label className="heritage-review-confirmation">
                    <input
                      type="checkbox"
                      checked={draft.bodySelectionConfirmed}
                      onChange={event => setDraft(current => ({
                        ...current,
                        bodySelectionConfirmed: event.currentTarget.checked,
                      }))}
                    />
                    <span>
                      I reviewed the written-content choices, including the choice
                      to publish none.
                    </span>
                  </label>
                </fieldset>

                <fieldset
                  className="heritage-review-fieldset"
                  disabled={mutationDisabled || !readyToPublish}
                >
                  <legend>2. Choose media</legend>
                  <p>
                    Every selected media URL becomes public. Pending, failed, or
                    non-public media remains visible here but cannot be selected.
                  </p>
                  <section
                    className="heritage-review-recording"
                    aria-labelledby="managed-public-recording-heading"
                    aria-describedby="managed-public-recording-help"
                  >
                    <div>
                      <h4 id="managed-public-recording-heading">
                        Preserved Community recording
                      </h4>
                      <p id="managed-public-recording-help">
                        Optional. Choose one exact preserved recording that matches
                        this current sermon revision. Nothing is selected
                        automatically. Choosing one clears an external recording URL;
                        review-only recordings remain available only through the
                        private playback and download controls above.
                      </p>
                    </div>
                    {managedRecordingState.kind === 'loading' && (
                      <p role="status" aria-live="polite">
                        Checking publishable preserved recordings…
                      </p>
                    )}
                    {managedRecordingState.kind === 'error' && (
                      <p className="heritage-review-warning" role="status">
                        Preserved recordings cannot be selected until the exact
                        inventory is refreshed.
                      </p>
                    )}
                    {managedRecordingState.kind === 'ready'
                      && publishableManagedRecordings.length === 0 && (
                      <p className="heritage-review-empty">
                        No preserved recording matches this current sermon revision.
                      </p>
                    )}
                    {managedRecordingState.kind === 'ready'
                      && publishableManagedRecordings.length > 0 && (
                      <div
                        className="heritage-review-inventory"
                        role="radiogroup"
                        aria-labelledby="managed-public-recording-heading"
                        aria-describedby="managed-public-recording-help"
                      >
                        {publishableManagedRecordings.map((recording, index) => {
                          const inputId = `managed-public-recording-${index}`
                          return (
                            <article
                              className="heritage-review-choice"
                              key={recording.reviewId}
                            >
                              <div className="heritage-review-choice__heading">
                                <input
                                  id={inputId}
                                  type="radio"
                                  name="managed-public-recording"
                                  checked={draft.managedRecordingReviewId === (
                                    recording.reviewId
                                  )}
                                  onChange={event => {
                                    if (event.currentTarget.checked) {
                                      updateManagedRecordingSelection(
                                        recording.reviewId,
                                      )
                                    }
                                  }}
                                />
                                <label htmlFor={inputId}>
                                  <strong>{recording.title}</strong>
                                  <span>
                                    {recording.fileName} · {recording.mediaType} ·{' '}
                                    {formatBytes(recording.sizeBytes)}
                                  </span>
                                </label>
                              </div>
                              <p className="heritage-review-choice__availability">
                                Exact current-revision recording · completed{' '}
                                {new Date(recording.completedAt).toLocaleString()}
                              </p>
                            </article>
                          )
                        })}
                      </div>
                    )}
                    {selectedManagedRecording && (
                      <button
                        type="button"
                        className="heritage-review-button heritage-review-button--quiet"
                        onClick={() => updateManagedRecordingSelection(null)}
                      >
                        Clear preserved recording choice
                      </button>
                    )}
                  </section>
                  <section
                    className="heritage-review-recording"
                    aria-labelledby="direct-recording-heading"
                  >
                    <div>
                      <h4 id="direct-recording-heading">External public recording fallback</h4>
                      <p id="direct-recording-help">
                        Optional. Enter a stable anonymous HTTPS file URL with no
                        login, query string, expiring signature, or private host.
                        It will be added to this exact canonical revision and
                        used as the reviewed public recording. Entering a URL clears
                        any preserved-recording choice. The media host receives each
                        listener&apos;s IP address and browser details when playback
                        begins.
                      </p>
                    </div>
                    <div className="heritage-review-recording__grid">
                      <label className="heritage-review-control heritage-review-recording__url">
                        <span>Public recording URL</span>
                        <input
                          type="url"
                          value={draft.directAudio.url}
                          placeholder="https://media.church.example/sermons/service.mp3"
                          aria-describedby="direct-recording-help"
                          onChange={event => updateDirectAudio({
                            url: event.currentTarget.value,
                          })}
                        />
                      </label>
                      <label className="heritage-review-control">
                        <span>Public title</span>
                        <input
                          type="text"
                          maxLength={300}
                          value={draft.directAudio.title}
                          disabled={draft.managedRecordingReviewId !== null}
                          onChange={event => updateDirectAudio({
                            title: event.currentTarget.value,
                          })}
                        />
                      </label>
                      <label className="heritage-review-control">
                        <span>Language</span>
                        <input
                          type="text"
                          maxLength={35}
                          value={draft.directAudio.language}
                          placeholder="en"
                          disabled={draft.managedRecordingReviewId !== null}
                          onChange={event => updateDirectAudio({
                            language: event.currentTarget.value,
                          })}
                        />
                      </label>
                      <label className="heritage-review-control">
                        <span>Audio format</span>
                        <select
                          value={draft.directAudio.mediaType}
                          disabled={draft.managedRecordingReviewId !== null}
                          onChange={event => updateDirectAudio({
                            mediaType: (event.currentTarget.value as
                              PublicationReviewDraft['directAudio']['mediaType']),
                          })}
                        >
                          <option value="audio/mpeg">MP3 (audio/mpeg)</option>
                          <option value="audio/mp4">M4A / MP4 audio</option>
                          <option value="audio/ogg">Ogg audio</option>
                          <option value="audio/webm">WebM audio</option>
                          <option value="audio/wav">WAV audio</option>
                        </select>
                      </label>
                      <label className="heritage-review-control">
                        <span>Duration in seconds (optional)</span>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          inputMode="decimal"
                          value={draft.directAudio.durationSeconds}
                          disabled={draft.managedRecordingReviewId !== null}
                          onChange={event => updateDirectAudio({
                            durationSeconds: event.currentTarget.value,
                          })}
                        />
                      </label>
                    </div>
                    {hasDirectAudioDraft(draft) && (
                      <>
                        {draft.selectedBodyEntryIds.length === 0 && (
                          <p className="heritage-review-warning">
                            Select at least one public manuscript, sermon-notes, or
                            transcript section in step 1. Community blocks an
                            audio-only publication without a written alternative.
                          </p>
                        )}
                        <p className="heritage-review-warning">
                          This link will be anonymously public and copyable. Community
                          does not fetch or verify the remote file, codec, redirects,
                          byte-range support, or future contents of this URL.
                        </p>
                        {recordingPreviewUrl && (
                          <div className="heritage-review-recording__preview">
                            <audio
                              controls
                              preload="none"
                              src={recordingPreviewUrl}
                              aria-label={`Preview ${
                                draft.directAudio.title.trim() || 'sermon recording'
                              }`}
                            />
                            <a
                              href={recordingPreviewUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open this recording URL in a new tab
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                  {selectedManagedRecording && (
                    <>
                      {draft.selectedBodyEntryIds.length === 0 && (
                        <p className="heritage-review-warning">
                          Select at least one public manuscript, sermon-notes, or
                          transcript section in step 1. Community blocks an
                          audio-only publication without a written alternative.
                        </p>
                      )}
                      <p className="heritage-review-warning">
                        Publishing will make the exact preserved recording selected
                        above anonymously public. Its review ID is bound to this
                        current sermon revision; no review-only recording can enter
                        this proposal.
                      </p>
                    </>
                  )}
                  {hasProposedRecording && (
                    <label className="heritage-review-confirmation">
                      <input
                        type="checkbox"
                        checked={draft.recordingRightsAndPrivacyConfirmed}
                        onChange={event => setDraft(current => ({
                          ...current,
                          recordingRightsAndPrivacyConfirmed:
                            event.currentTarget.checked,
                        }))}
                      />
                      <span>
                        I confirm that this church may publish this recording;
                        speaker and participant consent has been handled; it
                        contains no private prayer, counseling, or minor-related
                        material; and
                        embedded music or other third-party material is cleared for
                        this public use.
                      </span>
                    </label>
                  )}
                  {detail.sermon.document.media.length === 0 ? (
                    <p className="heritage-review-empty">This revision has no media items.</p>
                  ) : (
                    <div className="heritage-review-inventory">
                      {detail.sermon.document.media.map((media, index) => {
                        const inputId = `sermon-media-${index}`
                        const selectable = isPublicMediaSelectable(media)
                        const size = formatBytes(media.sizeBytes)
                        return (
                          <article
                            className={`heritage-review-choice${
                              selectable ? '' : ' heritage-review-choice--unavailable'
                            }`}
                            key={media.id}
                          >
                            <div className="heritage-review-choice__heading">
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={draft.selectedMediaIds.includes(media.id)}
                                disabled={!selectable}
                                onChange={event => updateMediaSelection(
                                  media.id,
                                  event.currentTarget.checked,
                                )}
                              />
                              <label htmlFor={inputId}>
                                <strong>{media.title}</strong>
                                <span>
                                  {media.kind} · {media.language}
                                  {size ? ` · ${size}` : ''}
                                </span>
                              </label>
                            </div>
                            <p className="heritage-review-choice__availability">
                              {mediaAvailability(media)}
                            </p>
                            {media.url && (
                              <a href={media.url} target="_blank" rel="noreferrer">
                                {media.url}
                              </a>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  )}
                  {draft.selectedMediaIds.length === 0 && !hasProposedRecording && (
                    <p className="heritage-review-warning">
                      No media is selected. Publishing is allowed, but readers
                      will not receive a recording or download from this publication.
                    </p>
                  )}
                  <label className="heritage-review-confirmation">
                    <input
                      type="checkbox"
                      checked={draft.mediaSelectionConfirmed}
                      onChange={event => setDraft(current => ({
                        ...current,
                        mediaSelectionConfirmed: event.currentTarget.checked,
                      }))}
                    />
                    <span>
                      I reviewed the existing media choices and the optional service
                      recording, including the choice to publish none.
                    </span>
                  </label>
                </fieldset>

                <fieldset
                  className="heritage-review-fieldset"
                  disabled={mutationDisabled || !readyToPublish}
                >
                  <legend>3. Confirm public publication</legend>
                  <label className="heritage-review-confirmation">
                    <input
                      type="checkbox"
                      checked={draft.publicAudienceConfirmed}
                      onChange={event => setDraft(current => ({
                        ...current,
                        publicAudienceConfirmed: event.currentTarget.checked,
                      }))}
                    />
                    <span>
                      I understand that the selected text and media links will be
                      available to anyone with access to the public sermon, not
                      only signed-in Community members.
                    </span>
                  </label>
                  <label className="heritage-review-confirmation">
                    <input
                      type="checkbox"
                      checked={draft.canonicalLinkConfirmed}
                      onChange={event => setDraft(current => ({
                        ...current,
                        canonicalLinkConfirmed: event.currentTarget.checked,
                      }))}
                    />
                    <span>
                      {detail.sermon.document.publication.canonicalUrl
                        ? `I checked this exact canonical sermon link: ${detail.sermon.document.publication.canonicalUrl}`
                        : 'I confirm that this sermon intentionally has no canonical website link.'}
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="heritage-review-button heritage-review-button--publish"
                    disabled={
                      mutationDisabled
                      || !readyToPublish
                      || !confirmationsComplete
                    }
                  >
                    {busyAction === 'publish'
                      ? 'Publishing exact choices…'
                      : detail.publication?.active
                        ? 'Publish this new revision'
                        : detail.publication
                          ? 'Republish sermon'
                          : 'Publish sermon'}
                  </button>
                </fieldset>
              </form>

              {detail.publication?.active && (
                <form className="heritage-review-withdraw" onSubmit={withdraw}>
                  <h3>Withdraw public access</h3>
                  <p>
                    Withdrawal removes this sermon from the public catalog and
                    public detail route. It does not erase the approval record.
                  </p>
                  <label className="heritage-review-confirmation">
                    <input
                      type="checkbox"
                      checked={withdrawalConfirmed}
                      disabled={mutationDisabled || detail.sermon.archived}
                      onChange={event => setWithdrawalConfirmed(
                        event.currentTarget.checked,
                      )}
                    />
                    <span>
                      I intend to withdraw this exact active publication.
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="heritage-review-button heritage-review-button--danger"
                    disabled={
                      mutationDisabled
                      || detail.sermon.archived
                      || !withdrawalConfirmed
                    }
                  >
                    {busyAction === 'withdraw'
                      ? 'Withdrawing public access…'
                      : 'Withdraw public access'}
                  </button>
                </form>
              )}

              <details className="heritage-review-technical">
                <summary>Technical details and hashes</summary>
                <dl>
                  <div>
                    <dt>Sync ID</dt>
                    <dd><code>{detail.sermon.syncId}</code></dd>
                  </div>
                  <div>
                    <dt>Sync version</dt>
                    <dd><code>{detail.sermon.syncVersion}</code></dd>
                  </div>
                  <div>
                    <dt>Current revision</dt>
                    <dd><code>{detail.sermon.currentRevision}</code></dd>
                  </div>
                  {detail.publication && (
                    <>
                      <div>
                        <dt>Publication version</dt>
                        <dd><code>{detail.publication.publicationVersion}</code></dd>
                      </div>
                      <div>
                        <dt>Public revision</dt>
                        <dd><code>{detail.publication.publicRevision}</code></dd>
                      </div>
                      <div>
                        <dt>Detail checksum</dt>
                        <dd><code>{detail.publication.detailChecksum}</code></dd>
                      </div>
                    </>
                  )}
                </dl>
                {detail.sermon.document.sources.length > 0 && (
                  <>
                    <h3>Private source inventory</h3>
                    <ul>
                      {detail.sermon.document.sources.map(source => (
                        <li key={source.id}>
                          <code>{source.id}</code> · {source.fileName} ·{' '}
                          <code>{source.sha256}</code>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {detail.sermon.document.media.some(media => media.sha256) && (
                  <>
                    <h3>Media hashes</h3>
                    <ul>
                      {detail.sermon.document.media
                        .filter(media => media.sha256)
                        .map(media => (
                          <li key={media.id}>
                            <code>{media.id}</code> · <code>{media.sha256}</code>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </details>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

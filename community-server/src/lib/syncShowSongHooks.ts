import type { CollectionBeforeValidateHook } from 'payload'
import { randomUUID } from 'node:crypto'
import {
  mergeLegacyEditsIntoSyncDocuments,
  normalizeSyncDocuments,
} from '@/lib/syncShowProtocol'

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const LEGACY_DOCUMENT_FIELDS = new Set([
  'title',
  'russianTitle',
  'lyrics',
  'russianLyrics',
  'authors',
  'license',
  'copyright',
  'rightsNotes',
  'sourceUrl',
])

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

const MEMBER_SHARE_FIELDS = [
  'memberShareReceiptId',
  'memberShareReceiptVersion',
  'memberSharePreviousSongSyncVersion',
  'memberShareSongSyncVersion',
  'memberShareFamilyRevision',
  'memberShareReviewRevision',
  'memberShareVisibility',
  'memberSharePublishAt',
  'memberShareTimeZone',
  'memberShareValidThrough',
  'memberShareReviewedAt',
  'memberShareConfirmedAt',
  'memberShareRequestRevision',
  'memberShareReceiptRevision',
] as const

export function clearSongMemberSharingReceipt(
  data: Record<string, unknown>,
) {
  const next = { ...data }
  for (const field of MEMBER_SHARE_FIELDS) next[field] = null
  return next
}

/**
 * Member visibility is a separate exact-family review transaction. Payload
 * admin writes and the legacy song create/PUT lane can save only private
 * content; an ordinary edit that does not explicitly choose visibility safely
 * demotes a previously shared song and clears its active receipt pointer.
 */
export const enforceSongMemberSharingMutation:
CollectionBeforeValidateHook = ({
  context,
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data
  if (
    (context as Record<string, unknown> | undefined)
      ?.songMemberSharingInternalMutation === true
  ) {
    return data
  }
  const incoming = data as Record<string, unknown>
  const existing = (originalDoc || {}) as Record<string, unknown>
  const explicitVisibility = hasOwn(incoming, 'visibility')
  const requestedVisibility = explicitVisibility
    ? String(incoming.visibility || '')
    : operation === 'update'
      ? String(existing.visibility || 'private')
      : 'private'
  if (explicitVisibility && requestedVisibility !== 'private'
    && (context as Record<string, unknown> | undefined)?.songbookPublicationRequested !== true) {
    throw new Error(
      'Signed-in member visibility requires an exact song-family rights review. Save this song as Private, then use SyncShow’s “Share with Community members” action.',
    )
  }
  return clearSongMemberSharingReceipt({
    ...incoming,
    visibility: 'private',
    publishAt: null,
    status: incoming.status === 'archived'
      || (!hasOwn(incoming, 'status') && existing.status === 'archived')
      ? 'archived'
      : 'draft',
  })
}

export const prepareSongSyncFields: CollectionBeforeValidateHook = ({
  context,
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data
  const next = { ...data } as Record<string, unknown>
  const existing = (originalDoc || {}) as Record<string, unknown>
  if (operation === 'update' && existing.syncId) {
    next.syncId = existing.syncId
  } else {
    const candidate = String(next.syncId || next.slug || existing.slug || '')
    next.syncId = ID_PATTERN.test(candidate) ? candidate : randomUUID()
  }

  const remainsArchived = next.status === 'archived'
    || (!hasOwn(next, 'status') && existing.status === 'archived' && !hasOwn(next, 'visibility'))
  if (remainsArchived) {
    next.status = 'archived'
    next.visibility = 'private'
    next.publishAt = null
  } else {
    if (!hasOwn(next, 'visibility')) {
      if (hasOwn(next, 'status')) {
        next.visibility = next.status === 'published' ? 'public' : 'private'
      } else {
        next.visibility = existing.visibility || (existing.status === 'published' ? 'public' : 'private')
      }
    }
    next.status = next.visibility === 'private' ? 'draft' : 'published'
    if (next.visibility !== 'scheduled-public') next.publishAt = null
  }

  const hasIncomingDocuments = hasOwn(next, 'syncDocuments')
  const incomingDocuments = hasIncomingDocuments ? normalizeSyncDocuments(next.syncDocuments) || [] : undefined
  const existingDocuments = normalizeSyncDocuments(existing.syncDocuments) || []
  const changedLegacyFields = Object.fromEntries(Object.entries(next).filter(([key, value]) => (
    LEGACY_DOCUMENT_FIELDS.has(key) && JSON.stringify(value) !== JSON.stringify(existing[key])
  )))
  // Payload includes hidden JSON in a full admin form. An unchanged hidden copy
  // must not defeat visible lyric edits. A changed canonical document remains
  // authoritative for SyncShow clients; metadata-only admin edits retain bytes.
  const unchangedHiddenCopy = hasIncomingDocuments
    && JSON.stringify(incomingDocuments) === JSON.stringify(existingDocuments)
  if (hasIncomingDocuments && !unchangedHiddenCopy) {
    next.syncDocuments = incomingDocuments
  } else if (operation === 'create' || Object.keys(changedLegacyFields).length) {
    next.syncDocuments = mergeLegacyEditsIntoSyncDocuments(existing, operation === 'create' ? next : changedLegacyFields)
  } else if (hasIncomingDocuments) {
    next.syncDocuments = incomingDocuments
  }

  const currentVersion = Number(existing.syncVersion || 0)
  if (operation === 'create') {
    next.syncVersion = Math.max(1, Number(next.syncVersion || 1))
  } else if (Number.isInteger(Number(context.syncShowReservedVersion))) {
    next.syncVersion = Number(context.syncShowReservedVersion)
  } else {
    // Payload's generated admin form can submit the read-only current value.
    // Never trust it to decide whether a Community-side edit advances CAS.
    next.syncVersion = currentVersion + 1
  }

  return next
}

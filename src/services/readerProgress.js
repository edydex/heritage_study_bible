import { getStoredJson, setStoredJson } from './persistentStorage'

export const READER_PROGRESS_KEY = 'heritage-reader-progress'
export const RESOURCE_BOOKMARKS_KEY = 'heritage-resource-bookmarks'
let resourceBookmarkMutation = Promise.resolve()

export async function getReaderProgress() {
  return getStoredJson(READER_PROGRESS_KEY, { bible: null, resources: {} })
}

export async function saveBibleProgress(book, chapter) {
  const progress = await getReaderProgress()
  await setStoredJson(READER_PROGRESS_KEY, {
    ...progress,
    bible: { book, chapter, updatedAt: new Date().toISOString() },
  })
}

export async function saveResourceProgress(resourceId, chapterIndex, chapterLabel = '') {
  const progress = await getReaderProgress()
  await setStoredJson(READER_PROGRESS_KEY, {
    ...progress,
    resources: {
      ...(progress.resources || {}),
      [resourceId]: { chapterIndex, chapterLabel, updatedAt: new Date().toISOString() },
    },
  })
}

export async function getResourceBookmarks() {
  return getStoredJson(RESOURCE_BOOKMARKS_KEY, [])
}

export function toggleResourceBookmark(bookmark) {
  const operation = resourceBookmarkMutation.then(() => mutateResourceBookmark(bookmark))
  resourceBookmarkMutation = operation.catch(() => {})
  return operation
}

async function mutateResourceBookmark(bookmark) {
  const bookmarks = await getResourceBookmarks()
  const existing = bookmarks.find(item => item.resourceId === bookmark.resourceId
    && item.chapterIndex === bookmark.chapterIndex
    && (item.paragraphIndex ?? null) === (bookmark.paragraphIndex ?? null)
    && (item.startOffset ?? null) === (bookmark.startOffset ?? null))
  if (existing) {
    const next = bookmarks.filter(item => item.id !== existing.id)
    await setStoredJson(RESOURCE_BOOKMARKS_KEY, next)
    return { bookmarked: false, bookmarks: next }
  }

  const nextBookmark = {
    ...bookmark,
    id: globalThis.crypto?.randomUUID?.() || `${bookmark.resourceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  }
  const next = [...bookmarks, nextBookmark]
  await setStoredJson(RESOURCE_BOOKMARKS_KEY, next)
  return { bookmarked: true, bookmarks: next }
}

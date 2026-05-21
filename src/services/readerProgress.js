import { getStoredJson, setStoredJson } from './persistentStorage'

export const READER_PROGRESS_KEY = 'heritage-reader-progress'
export const RESOURCE_BOOKMARKS_KEY = 'heritage-resource-bookmarks'

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

export async function toggleResourceBookmark(bookmark) {
  const bookmarks = await getResourceBookmarks()
  const existing = bookmarks.find(item => item.resourceId === bookmark.resourceId && item.chapterIndex === bookmark.chapterIndex)
  if (existing) {
    const next = bookmarks.filter(item => item.id !== existing.id)
    await setStoredJson(RESOURCE_BOOKMARKS_KEY, next)
    return { bookmarked: false, bookmarks: next }
  }

  const nextBookmark = {
    id: `${bookmark.resourceId}-${bookmark.chapterIndex}-${Date.now()}`,
    ...bookmark,
    createdAt: new Date().toISOString(),
  }
  const next = [...bookmarks, nextBookmark]
  await setStoredJson(RESOURCE_BOOKMARKS_KEY, next)
  return { bookmarked: true, bookmarks: next }
}

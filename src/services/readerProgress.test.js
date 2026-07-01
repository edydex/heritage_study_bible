import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

import {
  getReaderProgress,
  saveBibleProgress,
  saveResourceProgress,
  toggleResourceBookmark,
} from './readerProgress'

describe('readerProgress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with empty progress', async () => {
    await expect(getReaderProgress()).resolves.toEqual({
      bible: null,
      resources: {},
    })
  })

  it('saves and reloads bible reading progress', async () => {
    await saveBibleProgress('John', 3)
    const progress = await getReaderProgress()
    expect(progress.bible).toMatchObject({ book: 'John', chapter: 3 })
    expect(progress.bible.updatedAt).toBeTruthy()
  })

  it('saves resource chapter progress by resource id', async () => {
    await saveResourceProgress('institutes', 4, 'Book 1 - Chapter 4')
    const progress = await getReaderProgress()
    expect(progress.resources.institutes).toMatchObject({
      chapterIndex: 4,
      chapterLabel: 'Book 1 - Chapter 4',
    })
  })

  it('toggles resource bookmarks on and off', async () => {
    const bookmark = {
      resourceId: 'institutes',
      chapterIndex: 2,
      chapterLabel: 'Chapter 2',
    }

    const added = await toggleResourceBookmark(bookmark)
    expect(added.bookmarked).toBe(true)
    expect(added.bookmarks).toHaveLength(1)

    const removed = await toggleResourceBookmark(bookmark)
    expect(removed.bookmarked).toBe(false)
    expect(removed.bookmarks).toEqual([])
  })
})

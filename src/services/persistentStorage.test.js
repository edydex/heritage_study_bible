import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

import {
  EXPORTABLE_EXACT_KEYS,
  importHeritageData,
  exportHeritageData,
  exportNotesMarkdown,
  getStoredJson,
  getStoredValue,
  setStoredJson,
  STORAGE_KEYS,
} from './persistentStorage'

describe('persistentStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores and reads JSON values from localStorage', async () => {
    await setStoredJson(STORAGE_KEYS.translation, 'WEB')
    await expect(getStoredJson(STORAGE_KEYS.translation, 'KJV')).resolves.toBe('WEB')
  })

  it('exports only allowed keys plus reading-plan progress keys', async () => {
    localStorage.setItem(STORAGE_KEYS.translation, 'WEB')
    localStorage.setItem(`${STORAGE_KEYS.readingPlanPrefix}demo:progress`, '{"completedDays":[]}')
    localStorage.setItem('unrelated-key', 'ignore-me')

    const payload = await exportHeritageData()
    expect(payload.app).toBe('Heritage Study Bible')
    expect(payload.data[STORAGE_KEYS.translation]).toBe('WEB')
    expect(payload.data[`${STORAGE_KEYS.readingPlanPrefix}demo:progress`]).toBe('{"completedDays":[]}')
    expect(payload.data['unrelated-key']).toBeUndefined()
  })

  it('imports valid Heritage backup payloads', async () => {
    const imported = await importHeritageData({
      app: 'Heritage Study Bible',
      data: {
        [STORAGE_KEYS.translation]: 'KJV',
        'not-allowed': 'skip',
      },
    })

    expect(imported).toBe(2)
    await expect(getStoredValue(STORAGE_KEYS.translation)).resolves.toBe('KJV')
    expect(localStorage.getItem('not-allowed')).toBeNull()
  })

  it('rejects invalid backup payloads', async () => {
    await expect(importHeritageData({ app: 'Other App', data: {} })).rejects.toThrow(
      'This does not look like a Heritage backup file.'
    )
  })

  it('documents exportable keys for backup tooling', () => {
    expect(EXPORTABLE_EXACT_KEYS).toContain(STORAGE_KEYS.bookmarks)
    expect(EXPORTABLE_EXACT_KEYS).toContain(STORAGE_KEYS.highlights)
    expect(EXPORTABLE_EXACT_KEYS).toContain(STORAGE_KEYS.activeReadingPlan)
  })

  it('exports notes and bookmarks as markdown', async () => {
    await setStoredJson(STORAGE_KEYS.notes, [
      {
        book: 'John',
        chapter: 3,
        verse: 16,
        reference: 'John 3:16-17',
        verseText: 'For God so loved the world.',
        text: 'A personal note',
      },
    ])
    await setStoredJson(STORAGE_KEYS.highlights, [
      { book: 'Psalms', chapter: 23, verse: 1, reference: 'Psalms 23:1-3' },
    ])
    await setStoredJson(STORAGE_KEYS.bookmarks, [
      { book: 'Psalms', chapter: 23, verse: 1, verseText: 'The LORD is my shepherd.' },
    ])
    await setStoredJson(STORAGE_KEYS.commentaryBookmarks, [
      { reference: 'John 3:16', authorName: 'Calvin', workTitle: 'John' },
    ])

    const markdown = await exportNotesMarkdown()
    expect(markdown).toContain('## Verse Notes')
    expect(markdown).toContain('John 3:16-17')
    expect(markdown).toContain('A personal note')
    expect(markdown).toContain('## Verse Bookmarks')
    expect(markdown).toContain('## Highlights')
    expect(markdown).toContain('Psalms 23:1-3')
    expect(markdown).toContain('Psalms 23:1')
    expect(markdown).toContain('## Commentary Bookmarks')
    expect(markdown).toContain('Calvin')
  })
})

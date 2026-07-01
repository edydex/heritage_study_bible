import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

import { useBookmarks } from './useBookmarks'
import { STORAGE_KEYS } from '../services/persistentStorage'

describe('useBookmarks', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hydrates bookmarks, commentary bookmarks, and notes from storage', async () => {
    localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify([
      { id: 'b1', book: 'John', chapter: 3, verse: 16 },
    ]))
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify([
      { id: 'n1', book: 'Psalms', chapter: 23, verse: 1, text: 'Saved note' },
    ]))

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.bookmarks).toHaveLength(1)
      expect(result.current.notes).toHaveLength(1)
    })
  })

  it('adds and removes verse bookmarks', async () => {
    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.bookmarks).toEqual([])
    })

    act(() => {
      result.current.addBookmark({ book: 'John', chapter: 3, verse: 16, verseText: 'Verse text' })
    })

    expect(result.current.isBookmarked('John', 3, 16)).toBe(true)

    act(() => {
      result.current.removeBookmark('John', 3, 16)
    })

    expect(result.current.isBookmarked('John', 3, 16)).toBe(false)
  })

  it('saves, updates, and deletes notes', async () => {
    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.notes).toEqual([])
    })

    act(() => {
      result.current.saveNote('John', 3, 16, 'First note', 'Verse text')
    })

    expect(result.current.hasNote('John', 3, 16)).toBe(true)

    act(() => {
      result.current.saveNote('John', 3, 16, 'Updated note')
    })

    expect(result.current.getNote('John', 3, 16)?.text).toBe('Updated note')

    act(() => {
      result.current.deleteNote('John', 3, 16)
    })

    expect(result.current.hasNote('John', 3, 16)).toBe(false)
  })

  it('toggles commentary bookmarks without duplicates', async () => {
    const { result } = renderHook(() => useBookmarks())
    const commentary = { id: 'c1', reference: 'John 3:16', chapter: 3, text: 'Commentary text' }

    await waitFor(() => {
      expect(result.current.commentaryBookmarks).toEqual([])
    })

    act(() => {
      result.current.toggleCommentaryBookmark(commentary, 'Calvin', 'John')
    })

    expect(result.current.isCommentaryBookmarked('c1')).toBe(true)
    expect(result.current.commentaryBookmarks).toHaveLength(1)

    act(() => {
      result.current.toggleCommentaryBookmark(commentary, 'Calvin', 'John')
    })

    expect(result.current.isCommentaryBookmarked('c1')).toBe(false)
  })
})

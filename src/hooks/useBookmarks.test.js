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

  it('stores a multi-verse note once and keeps the grouped reference when edited', async () => {
    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => expect(result.current.notes).toEqual([]))

    act(() => {
      result.current.saveNotes([
        { book: 'Jeremiah', chapter: 20, verse: 13, text: 'Verse thirteen.' },
        { book: 'Jeremiah', chapter: 20, verse: 14, text: 'Verse fourteen.' },
        { book: 'Jeremiah', chapter: 20, verse: 15, text: 'Verse fifteen.' },
      ], 'One note for the passage')
    })

    expect(result.current.notes).toHaveLength(1)
    expect(result.current.notes[0].reference).toBe('Jeremiah 20:13-15')
    expect(result.current.getNote('Jeremiah', 20, 14)?.text).toBe('One note for the passage')

    act(() => {
      result.current.saveNote('Jeremiah', 20, 14, 'Edited from the middle verse')
    })

    expect(result.current.notes).toHaveLength(1)
    expect(result.current.notes[0].verses).toHaveLength(3)
    expect(result.current.notes[0].text).toBe('Edited from the middle verse')
  })

  it('adds and removes persistent verse highlights', async () => {
    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => expect(result.current.highlights).toEqual([]))

    act(() => {
      result.current.addHighlight([
        { book: 'John', chapter: 3, verse: 16 },
        { book: 'John', chapter: 3, verse: 17 },
      ])
    })
    expect(result.current.isHighlighted('John', 3, 16)).toBe(true)
    expect(result.current.highlights[0].reference).toBe('John 3:16-17')

    act(() => {
      result.current.removeHighlights([{ book: 'John', chapter: 3, verse: 16 }])
    })
    expect(result.current.isHighlighted('John', 3, 16)).toBe(false)
    expect(result.current.isHighlighted('John', 3, 17)).toBe(true)
  })

  it('stores translation-specific text highlights and inline excerpt notes', async () => {
    const { result } = renderHook(() => useBookmarks())
    await waitFor(() => expect(result.current.highlights).toEqual([]))
    const selection = {
      kind: 'text',
      book: 'John',
      chapter: 3,
      verse: 16,
      reference: 'John 3:16',
      translationId: 'BSB',
      selectedText: 'God so loved',
      verses: [{ book: 'John', chapter: 3, verse: 16, text: 'For God so loved the world.' }],
      segments: [{
        book: 'John', chapter: 3, verse: 16, translationId: 'BSB',
        startOffset: 4, endOffset: 16, selectedText: 'God so loved',
      }],
    }

    act(() => result.current.addTextHighlight(selection))
    expect(result.current.isTextSelectionHighlighted(selection)).toBe(true)
    expect(result.current.getTextHighlights('John', 3, 16, 'BSB', 'For God so loved the world.')).toHaveLength(1)
    expect(result.current.getTextHighlights('John', 3, 16, 'WEB', 'For God so loved the world.')).toHaveLength(0)

    act(() => result.current.saveTextNote(selection, 'Love begins with God.', { inline: true }))
    expect(result.current.notes).toHaveLength(1)
    expect(result.current.notes[0]).toMatchObject({
      kind: 'text',
      translationId: 'BSB',
      inline: true,
      text: 'Love begins with God.',
    })

    act(() => result.current.saveNote('John', 3, 16, 'A separate whole-verse note.'))
    expect(result.current.notes).toHaveLength(2)
    expect(result.current.notes.filter(note => note.kind === 'text')).toHaveLength(1)

    act(() => result.current.deleteNote('John', 3, 16))
    expect(result.current.notes).toHaveLength(1)
    expect(result.current.notes[0].kind).toBe('text')

    act(() => result.current.deleteNoteById(result.current.notes[0].id))
    expect(result.current.notes).toEqual([])

    act(() => result.current.removeTextHighlight(selection))
    expect(result.current.isTextSelectionHighlighted(selection)).toBe(false)
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

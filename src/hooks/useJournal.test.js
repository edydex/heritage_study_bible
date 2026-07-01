import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

import {
  useJournal,
  JOURNAL_PANES,
  DEFAULT_BIBLE_EXTRA_SPACE,
  BIBLE_SPACE_INCREMENT,
} from './useJournal'
import { STORAGE_KEYS } from '../services/persistentStorage'

describe('useJournal', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('hydrates legacy entries (no pane) as notes pane', async () => {
    localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify([
      { book: 'John', chapter: 3, text: 'Existing entry' },
    ]))
    const { result } = renderHook(() => useJournal())
    await waitFor(() => {
      expect(result.current.getEntry('John', 3, JOURNAL_PANES.notes)?.text).toBe('Existing entry')
    })
  })

  it('saves and updates a notes-pane entry', async () => {
    const { result } = renderHook(() => useJournal())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.saveEntry('John', 3, 'First', JOURNAL_PANES.notes))
    expect(result.current.getEntry('John', 3, JOURNAL_PANES.notes)?.text).toBe('First')

    act(() => result.current.saveEntry('John', 3, 'Second', JOURNAL_PANES.notes))
    expect(result.current.getEntry('John', 3, JOURNAL_PANES.notes)?.text).toBe('Second')
    expect(result.current.entries).toHaveLength(1)
  })

  it('keeps bible and notes entries separate for the same chapter', async () => {
    const { result } = renderHook(() => useJournal())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.saveEntry('John', 3, 'Side note', JOURNAL_PANES.notes))
    act(() => result.current.saveEntry('John', 3, 'Margin note', JOURNAL_PANES.bible))

    expect(result.current.getEntry('John', 3, JOURNAL_PANES.notes)?.text).toBe('Side note')
    expect(result.current.getEntry('John', 3, JOURNAL_PANES.bible)?.text).toBe('Margin note')
    expect(result.current.entries).toHaveLength(2)
  })

  it('deletes a notes entry when saved empty', async () => {
    const { result } = renderHook(() => useJournal())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.saveEntry('John', 3, 'Something', JOURNAL_PANES.notes))
    expect(result.current.getEntry('John', 3, JOURNAL_PANES.notes)).not.toBeNull()

    act(() => result.current.saveEntry('John', 3, '   ', JOURNAL_PANES.notes))
    expect(result.current.getEntry('John', 3, JOURNAL_PANES.notes)).toBeNull()
  })

  it('adds bible margin space and keeps entry when text is empty', async () => {
    const { result } = renderHook(() => useJournal())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.addBibleSpace('John', 3))
    const entry = result.current.getEntry('John', 3, JOURNAL_PANES.bible)
    expect(entry?.extraSpace).toBe(DEFAULT_BIBLE_EXTRA_SPACE + BIBLE_SPACE_INCREMENT)
    expect(entry?.text).toBe('')

    act(() => result.current.saveEntry('John', 3, '   ', JOURNAL_PANES.bible))
    expect(result.current.getEntry('John', 3, JOURNAL_PANES.bible)).not.toBeNull()
  })
})

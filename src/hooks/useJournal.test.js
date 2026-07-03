import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

import {
  useJournal,
  JOURNAL_PANES,
  AFTER_ALL_VERSES,
  DEFAULT_GAP_HEIGHT,
  DEFAULT_PAGE_HEIGHT,
  PAGE_HEIGHT_INCREMENT,
} from './useJournal'
import { STORAGE_KEYS } from '../services/persistentStorage'

describe('useJournal', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('migrates legacy notes text into a block', async () => {
    localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify([
      { book: 'John', chapter: 3, pane: 'notes', text: 'Existing entry' },
    ]))
    const { result } = renderHook(() => useJournal())
    await waitFor(() => {
      const blocks = result.current.getNotesBlocks('John', 3)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].text).toBe('Existing entry')
    })
  })

  it('migrates legacy bible margin into an end-of-chapter gap', async () => {
    localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify([
      { book: 'John', chapter: 3, pane: 'bible', text: 'Margin note', extraSpace: 360 },
    ]))
    const { result } = renderHook(() => useJournal())
    await waitFor(() => {
      const gaps = result.current.getBibleGaps('John', 3)
      expect(gaps).toHaveLength(1)
      expect(gaps[0].afterVerse).toBe(AFTER_ALL_VERSES)
      expect(gaps[0].text).toBe('Margin note')
      expect(gaps[0].height).toBe(360)
    })
  })

  it('adds and updates inline gaps', async () => {
    const { result } = renderHook(() => useJournal())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    let gapId
    act(() => { gapId = result.current.addGap('John', 3, 5) })
    expect(result.current.getBibleGaps('John', 3)).toHaveLength(1)

    act(() => result.current.updateGap('John', 3, gapId, { text: 'Between verses' }))
    expect(result.current.getBibleGaps('John', 3)[0].text).toBe('Between verses')
    expect(result.current.getBibleGaps('John', 3)[0].height).toBe(DEFAULT_GAP_HEIGHT)
  })

  it('removes gaps and drops empty bible entries', async () => {
    const { result } = renderHook(() => useJournal())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    let gapId
    act(() => { gapId = result.current.addGap('John', 3, 2) })
    act(() => result.current.removeGap('John', 3, gapId))
    expect(result.current.getEntry('John', 3, JOURNAL_PANES.bible)).toBeNull()
  })

  it('manages notes blocks and page height', async () => {
    const { result } = renderHook(() => useJournal())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    let blockId
    act(() => { blockId = result.current.addNotesBlock('John', 3, 40, 'Reflection') })
    expect(result.current.getNotesBlocks('John', 3)).toHaveLength(1)

    act(() => result.current.updateNotesBlock('John', 3, blockId, { text: 'Updated' }))
    expect(result.current.getNotesBlocks('John', 3)[0].text).toBe('Updated')

    act(() => result.current.addNotesPageHeight('John', 3))
    expect(result.current.getNotesPageHeight('John', 3)).toBe(DEFAULT_PAGE_HEIGHT + PAGE_HEIGHT_INCREMENT)

    act(() => result.current.removeNotesBlock('John', 3, blockId))
    expect(result.current.getNotesBlocks('John', 3)).toHaveLength(0)
  })
})

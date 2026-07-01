import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: vi.fn(() => `test-uuid-${++uuidCounter}`),
}))

import { useHighlights, HIGHLIGHT_COLORS, getHighlightColor } from './useHighlights'
import { STORAGE_KEYS } from '../services/persistentStorage'

describe('useHighlights', () => {
  beforeEach(() => {
    localStorage.clear()
    uuidCounter = 0
    vi.clearAllMocks()
  })

  it('exposes inline mark classes for the palette', () => {
    expect(HIGHLIGHT_COLORS).toHaveLength(4)
    expect(getHighlightColor('yellow')?.markClass).toContain('bg-yellow')
    expect(getHighlightColor('nope')).toBeNull()
  })

  it('migrates legacy whole-verse highlights on load', async () => {
    localStorage.setItem(STORAGE_KEYS.highlights, JSON.stringify([
      { id: 'h1', book: 'John', chapter: 3, verse: 16, color: 'yellow' },
    ]))
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => {
      expect(result.current.getVerseHighlights('John', 3, 16)).toHaveLength(1)
    })
    const h = result.current.getVerseHighlights('John', 3, 16)[0]
    expect(h.start).toBe(0)
    expect(h.end).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('adds multiple text ranges per verse', async () => {
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => expect(result.current.highlights).toEqual([]))

    act(() => {
      result.current.addHighlightRanges('John', 3, [
        { verse: 16, start: 0, end: 4, color: 'yellow' },
        { verse: 16, start: 10, end: 20, color: 'green' },
      ])
    })

    expect(result.current.getVerseHighlights('John', 3, 16)).toHaveLength(2)
  })

  it('finds and removes a highlight at an offset', async () => {
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => expect(result.current.highlights).toEqual([]))

    act(() => {
      result.current.addHighlightRanges('John', 3, [
        { verse: 16, start: 5, end: 12, color: 'blue' },
      ])
    })

    const hit = result.current.findHighlightAt('John', 3, 16, 8)
    expect(hit?.color).toBe('blue')

    act(() => result.current.removeHighlight(hit.id))
    expect(result.current.getVerseHighlights('John', 3, 16)).toHaveLength(0)
  })
})

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

  it('exposes a 4-color palette with Tailwind classes', () => {
    expect(HIGHLIGHT_COLORS).toHaveLength(4)
    expect(getHighlightColor('yellow')?.verseClass).toContain('bg-yellow')
    expect(getHighlightColor('nope')).toBeNull()
  })

  it('sets, replaces, and toggles a highlight', async () => {
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => expect(result.current.highlights).toEqual([]))

    act(() => result.current.setHighlight('John', 3, 16, 'yellow'))
    expect(result.current.getHighlight('John', 3, 16)?.color).toBe('yellow')

    // Different color replaces in place.
    act(() => result.current.setHighlight('John', 3, 16, 'green'))
    expect(result.current.getHighlight('John', 3, 16)?.color).toBe('green')
    expect(result.current.highlights).toHaveLength(1)

    // Same color toggles off.
    act(() => result.current.setHighlight('John', 3, 16, 'green'))
    expect(result.current.getHighlight('John', 3, 16)).toBeNull()
  })

  it('clears a highlight and persists to storage', async () => {
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => expect(result.current.highlights).toEqual([]))

    act(() => result.current.setHighlight('Psalms', 23, 1, 'blue'))
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.highlights))).toHaveLength(1)
    })

    act(() => result.current.clearHighlight('Psalms', 23, 1))
    expect(result.current.getHighlight('Psalms', 23, 1)).toBeNull()
  })
})

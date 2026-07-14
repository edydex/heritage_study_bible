import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: vi.fn(() => `test-uuid-${++uuidCounter}`),
}))

import {
  useHighlights,
  HIGHLIGHT_COLORS,
  getHighlightColor,
  mergeNewHighlightRanges,
} from './useHighlights'
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

  it('adds multiple text ranges per verse and returns their ids', async () => {
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => expect(result.current.highlights).toEqual([]))

    let out
    act(() => {
      out = result.current.addHighlightRanges('John', 3, [
        { verse: 16, start: 0, end: 4, color: 'yellow' },
        { verse: 16, start: 10, end: 20, color: 'green' },
      ])
    })

    expect(out.ids).toEqual(['test-uuid-1', 'test-uuid-2'])
    expect(out.replaced).toEqual([])
    expect(result.current.getVerseHighlights('John', 3, 16)).toHaveLength(2)
  })

  it('coalesces overlapping same-color highlights and keeps different colors', async () => {
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => expect(result.current.highlights).toEqual([]))

    act(() => {
      result.current.addHighlightRanges('John', 3, [
        { verse: 16, start: 0, end: 4, color: 'yellow' },
      ])
    })

    let out
    act(() => {
      out = result.current.addHighlightRanges('John', 3, [
        { verse: 16, start: 3, end: 8, color: 'yellow' },
        { verse: 16, start: 10, end: 12, color: 'green' },
      ])
    })

    const verse = result.current.getVerseHighlights('John', 3, 16)
    expect(verse).toHaveLength(2)
    const yellow = verse.find(h => h.color === 'yellow')
    expect(yellow).toMatchObject({ start: 0, end: 8 })
    expect(out.replaced).toHaveLength(1)
    expect(out.replaced[0].id).toBe('test-uuid-1')
  })

  it('mergeNewHighlightRanges restores cleanly for undo', () => {
    const prev = [{
      id: 'old',
      book: 'John',
      chapter: 3,
      verse: 16,
      start: 0,
      end: 4,
      color: 'yellow',
      dateCreated: 't0',
    }]
    let n = 0
    const { next, ids, replaced } = mergeNewHighlightRanges(
      prev,
      'John',
      3,
      [{ verse: 16, start: 2, end: 6, color: 'yellow' }],
      't1',
      () => `new-${++n}`
    )
    expect(replaced).toEqual([prev[0]])
    expect(ids).toEqual(['new-1'])
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ start: 0, end: 6, color: 'yellow' })
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

  it('removes a batch of highlights by id', async () => {
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => expect(result.current.highlights).toEqual([]))

    let out
    act(() => {
      out = result.current.addHighlightRanges('John', 3, [
        { verse: 16, start: 0, end: 4, color: 'yellow' },
        { verse: 16, start: 10, end: 20, color: 'green' },
      ])
    })

    act(() => result.current.removeHighlights(out.ids))
    expect(result.current.getVerseHighlights('John', 3, 16)).toHaveLength(0)
  })

  it('restores replaced highlights for undo', async () => {
    const { result } = renderHook(() => useHighlights())
    await waitFor(() => expect(result.current.highlights).toEqual([]))

    let first
    act(() => {
      first = result.current.addHighlightRanges('John', 3, [
        { verse: 16, start: 0, end: 4, color: 'yellow' },
      ])
    })

    let second
    act(() => {
      second = result.current.addHighlightRanges('John', 3, [
        { verse: 16, start: 2, end: 8, color: 'yellow' },
      ])
    })

    act(() => {
      result.current.removeHighlights(second.ids)
      result.current.restoreHighlights(second.replaced)
    })

    const verse = result.current.getVerseHighlights('John', 3, 16)
    expect(verse).toHaveLength(1)
    expect(verse[0].id).toBe(first.ids[0])
    expect(verse[0]).toMatchObject({ start: 0, end: 4 })
  })
})

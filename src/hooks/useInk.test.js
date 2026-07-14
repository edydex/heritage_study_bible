import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

import { useInk, migrateInkEntries, INK_PANES } from './useInk'
import { STORAGE_KEYS } from '../services/persistentStorage'

const stroke = (id, anchorId = null) => ({
  id,
  color: '#000',
  size: 4,
  anchorId,
  points: [[10, 20, 0.5], [30, 40, 0.5]],
})

describe('migrateInkEntries', () => {
  it('merges bible and notes panes into a page pane', () => {
    const migrated = migrateInkEntries([
      { book: 'John', chapter: 3, pane: 'bible', strokes: [stroke('s1')] },
      { book: 'John', chapter: 3, pane: 'notes', strokes: [stroke('s2')] },
    ])
    expect(migrated).toHaveLength(1)
    expect(migrated[0].pane).toBe(INK_PANES.page)
    expect(migrated[0].strokes.map(s => s.id).sort()).toEqual(['s1', 's2'])
  })

  it('keeps existing page entries and merges legacy panes into them', () => {
    const migrated = migrateInkEntries([
      { book: 'John', chapter: 3, pane: 'page', strokes: [stroke('s0')] },
      { book: 'John', chapter: 3, pane: 'bible', strokes: [stroke('s1')] },
    ])
    expect(migrated).toHaveLength(1)
    expect(migrated[0].strokes.map(s => s.id).sort()).toEqual(['s0', 's1'])
  })
})

describe('useInk', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('adds strokes on the page pane', async () => {
    const { result } = renderHook(() => useInk())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.addStroke('John', 3, INK_PANES.page, stroke('s1')))
    expect(result.current.getStrokes('John', 3, INK_PANES.page)).toHaveLength(1)
    expect(result.current.getStrokes('John', 4, INK_PANES.page)).toEqual([])
  })

  it('migrates legacy panes on hydrate', async () => {
    localStorage.setItem(STORAGE_KEYS.ink, JSON.stringify([
      { book: 'John', chapter: 3, pane: 'bible', strokes: [stroke('s1', 'gap-abc')] },
      { book: 'John', chapter: 3, pane: 'notes', strokes: [stroke('s2', 'notes-page')] },
    ]))

    const { result } = renderHook(() => useInk())
    await waitFor(() => {
      expect(result.current.getStrokes('John', 3, INK_PANES.page)).toHaveLength(2)
    })
    expect(result.current.hasStrokesOnAnchor('John', 3, INK_PANES.page, 'gap-abc')).toBe(true)
    expect(result.current.hasStrokesOnAnchor('John', 3, INK_PANES.page, 'notes-page')).toBe(true)
  })

  it('erases a single stroke and drops empty entries', async () => {
    const { result } = renderHook(() => useInk())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.addStroke('John', 3, INK_PANES.page, stroke('s1')))
    act(() => result.current.addStroke('John', 3, INK_PANES.page, stroke('s2')))
    expect(result.current.getStrokes('John', 3, INK_PANES.page)).toHaveLength(2)

    act(() => result.current.eraseStroke('John', 3, INK_PANES.page, 's1'))
    expect(result.current.getStrokes('John', 3, INK_PANES.page).map(s => s.id)).toEqual(['s2'])

    act(() => result.current.eraseStroke('John', 3, INK_PANES.page, 's2'))
    expect(result.current.entries).toEqual([])
  })

  it('clears a pane and persists to storage', async () => {
    const { result } = renderHook(() => useInk())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.addStroke('John', 3, INK_PANES.page, stroke('s1')))
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.ink))).toHaveLength(1)
    })

    act(() => result.current.clearPane('John', 3, INK_PANES.page))
    expect(result.current.getStrokes('John', 3, INK_PANES.page)).toEqual([])
  })
})

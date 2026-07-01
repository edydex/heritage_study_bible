import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

import { useInk } from './useInk'
import { STORAGE_KEYS } from '../services/persistentStorage'

const stroke = (id) => ({ id, color: '#000', size: 4, points: [[0, 0, 0.5], [1, 1, 0.5]] })

describe('useInk', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('adds strokes per book/chapter/pane', async () => {
    const { result } = renderHook(() => useInk())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.addStroke('John', 3, 'bible', stroke('s1')))
    act(() => result.current.addStroke('John', 3, 'notes', stroke('s2')))

    expect(result.current.getStrokes('John', 3, 'bible')).toHaveLength(1)
    expect(result.current.getStrokes('John', 3, 'notes')).toHaveLength(1)
    expect(result.current.getStrokes('John', 4, 'bible')).toEqual([])
  })

  it('erases a single stroke and drops empty entries', async () => {
    const { result } = renderHook(() => useInk())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.addStroke('John', 3, 'bible', stroke('s1')))
    act(() => result.current.addStroke('John', 3, 'bible', stroke('s2')))
    expect(result.current.getStrokes('John', 3, 'bible')).toHaveLength(2)

    act(() => result.current.eraseStroke('John', 3, 'bible', 's1'))
    expect(result.current.getStrokes('John', 3, 'bible').map(s => s.id)).toEqual(['s2'])

    act(() => result.current.eraseStroke('John', 3, 'bible', 's2'))
    expect(result.current.entries).toEqual([])
  })

  it('clears a pane and persists to storage', async () => {
    const { result } = renderHook(() => useInk())
    await waitFor(() => expect(result.current.entries).toEqual([]))

    act(() => result.current.addStroke('John', 3, 'bible', stroke('s1')))
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.ink))).toHaveLength(1)
    })

    act(() => result.current.clearPane('John', 3, 'bible'))
    expect(result.current.getStrokes('John', 3, 'bible')).toEqual([])
  })
})

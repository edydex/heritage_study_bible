import { describe, expect, it } from 'vitest'
import { isDoubleTap } from './doubleTap'

describe('doubleTap', () => {
  it('detects two taps within time and distance', () => {
    const ref = { current: null }
    const first = { clientX: 100, clientY: 200 }
    expect(isDoubleTap(first, ref)).toBe(false)
    const second = { clientX: 105, clientY: 202 }
    expect(isDoubleTap(second, ref)).toBe(true)
    expect(ref.current).toBeNull()
  })

  it('rejects taps that are too far apart', () => {
    const ref = { current: null }
    isDoubleTap({ clientX: 0, clientY: 0 }, ref)
    expect(isDoubleTap({ clientX: 100, clientY: 0 }, ref)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  toAnchorRelativePoints,
  toAbsolutePoints,
} from './inkAnchors'

describe('inkAnchors', () => {
  it('converts between absolute and anchor-relative points', () => {
    const anchor = { left: 100, top: 200 }
    const absolute = [[150, 250, 0.5], [180, 300, 0.6]]
    const relative = toAnchorRelativePoints(absolute, anchor)
    expect(relative).toEqual([[50, 50, 0.5], [80, 100, 0.6]])
    expect(toAbsolutePoints(relative, anchor)).toEqual(absolute)
  })

  it('passes through points when no anchor is provided', () => {
    const points = [[1, 2, 0.5]]
    expect(toAnchorRelativePoints(points, null)).toEqual(points)
    expect(toAbsolutePoints(points, null)).toEqual(points)
  })
})

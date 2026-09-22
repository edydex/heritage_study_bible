import { expect, it } from 'vitest'
import { readingScrollDelta } from './readingScroll'
it('does not move visible sentences or recenter when a sentence crosses the bottom', () => {
  expect(readingScrollDelta({ top: 500, bottom: 580, height: 80 }, 800)).toBe(0)
  expect(readingScrollDelta({ top: 680, bottom: 725, height: 45 }, 800)).toBe(15)
  expect(readingScrollDelta({ top: 120, bottom: 160, height: 40 }, 800)).toBe(-10)
})
it('does not chase the bottom of a sentence taller than the viewport', () => {
  expect(readingScrollDelta({ top: 200, bottom: 1500, height: 1300 }, 800)).toBe(0)
})

import { expect, it } from 'vitest'
import { readingScrollDelta } from './readingScroll'
it('waits until the sentence enters the bottom quarter, then moves its start to 15 percent', () => {
  expect(readingScrollDelta({ top: 500, bottom: 580, height: 80 }, 800)).toBe(0)
  expect(readingScrollDelta({ top: 520, bottom: 600, height: 80 }, 800)).toBe(0)
  expect(readingScrollDelta({ top: 521, bottom: 601, height: 80 }, 800)).toBe(401)
  expect(readingScrollDelta({ top: 680, bottom: 725, height: 45 }, 800)).toBe(560)
})
it('does not chase the bottom of a sentence taller than the viewport', () => {
  expect(readingScrollDelta({ top: 200, bottom: 1500, height: 1300 }, 800)).toBe(80)
  expect(readingScrollDelta({ top: 120, bottom: 1420, height: 1300 }, 800)).toBe(0)
  expect(readingScrollDelta({ top: 100, bottom: 1400, height: 1300 }, 800)).toBe(0)
})
it('scales with the screen and keeps the sentence below the actual header', () => {
  expect(readingScrollDelta({ top: 850, bottom: 950, height: 100 }, 1200)).toBe(670)
  expect(readingScrollDelta({ top: 250, bottom: 310, height: 60 }, 400, 80, 70)).toBe(158)
  expect(readingScrollDelta({ top: 70, bottom: 150, height: 80 }, 800, 80, 70)).toBe(-50)
  expect(readingScrollDelta({ top: 130, bottom: 210, height: 80 }, 800, 80, 70)).toBe(0)
})

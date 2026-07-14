import { describe, expect, it, vi } from 'vitest'
import {
  toCanonicalVerseText,
  clampHighlightRange,
  applyHighlightRanges,
  getCanonicalOffset,
  selectionToHighlightRanges,
  rangeToHighlightRanges,
  rangeFromCarets,
  caretFromPoint,
  pointsToHighlightRanges,
} from './verseHighlightText'

describe('verseHighlightText', () => {
  it('canonicalizes verse markup consistently', () => {
    expect(toCanonicalVerseText('Hello <b>world</b>')).toBe('Hello world')
    expect(toCanonicalVerseText('Line one || line two')).toBe('Line one\nline two')
  })

  it('clamps highlight ranges to canonical length', () => {
    expect(clampHighlightRange({ start: 2, end: 50, color: 'yellow' }, 10)).toEqual({
      start: 2,
      end: 10,
      color: 'yellow',
    })
    expect(clampHighlightRange({ start: 5, end: 5, color: 'yellow' }, 10)).toBeNull()
  })

  it('renders inline mark elements for highlighted segments', () => {
    const rendered = applyHighlightRanges('In the beginning', [
      { start: 3, end: 6, color: 'yellow' },
    ])
    expect(rendered).not.toBeNull()
    const json = JSON.stringify(rendered)
    expect(json).toContain('verse-highlight')
    expect(json).toContain('the')
  })

  it('maps DOM positions to canonical offsets', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p class="verse-text"><span>Hello</span><br><span class="inline-block w-4"></span><span>world</span></p>'
    document.body.appendChild(root)
    const verseText = root.querySelector('.verse-text')
    const worldText = [...verseText.querySelectorAll('span')].find(s => s.textContent === 'world')
    const offset = getCanonicalOffset(verseText, worldText.firstChild, 2)
    document.body.removeChild(root)
    expect(offset).toBe(8)
  })

  it('maps a within-verse selection to a highlight range', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p class="verse-text" data-verse-text data-verse="1" data-chapter="1">First verse</p>'
    document.body.appendChild(root)
    const v1 = root.querySelector('[data-verse="1"]')
    const range = document.createRange()
    range.setStart(v1.firstChild, 0)
    range.setEnd(v1.firstChild, 5)

    const selection = {
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => range,
    }

    const ranges = selectionToHighlightRanges(selection, root, 1)
    document.body.removeChild(root)
    expect(ranges).toEqual([{ verse: 1, start: 0, end: 5 }])
  })

  it('rangeToHighlightRanges maps a DOM Range to per-verse offsets', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p class="verse-text" data-verse-text data-verse="1" data-chapter="1">First verse</p>'
    document.body.appendChild(root)
    const v1 = root.querySelector('[data-verse="1"]')
    const range = document.createRange()
    range.setStart(v1.firstChild, 0)
    range.setEnd(v1.firstChild, 5)

    expect(rangeToHighlightRanges(range, root, 1)).toEqual([{ verse: 1, start: 0, end: 5 }])
    document.body.removeChild(root)
  })

  it('rangeFromCarets builds a non-collapsed range in either direction', () => {
    const root = document.createElement('div')
    root.textContent = 'abcdef'
    document.body.appendChild(root)
    const text = root.firstChild

    const forward = rangeFromCarets(document, { node: text, offset: 1 }, { node: text, offset: 4 })
    expect(forward?.toString()).toBe('bcd')

    const reverse = rangeFromCarets(document, { node: text, offset: 4 }, { node: text, offset: 1 })
    expect(reverse?.toString()).toBe('bcd')

    document.body.removeChild(root)
  })

  it('caretFromPoint uses caretRangeFromPoint when available', () => {
    const root = document.createElement('div')
    root.textContent = 'hello'
    document.body.appendChild(root)
    const text = root.firstChild
    const fakeRange = document.createRange()
    fakeRange.setStart(text, 2)
    fakeRange.collapse(true)

    const original = document.caretRangeFromPoint
    document.caretRangeFromPoint = vi.fn(() => fakeRange)

    expect(caretFromPoint(document, 10, 10)).toEqual({ node: text, offset: 2 })

    document.caretRangeFromPoint = original
    document.body.removeChild(root)
  })

  it('pointsToHighlightRanges builds ranges from two screen points', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p class="verse-text" data-verse-text data-verse="1" data-chapter="1">First verse</p>'
    document.body.appendChild(root)
    const v1 = root.querySelector('[data-verse="1"]')
    const text = v1.firstChild

    const startRange = document.createRange()
    startRange.setStart(text, 0)
    startRange.collapse(true)
    const endRange = document.createRange()
    endRange.setStart(text, 5)
    endRange.collapse(true)

    const original = document.caretRangeFromPoint
    document.caretRangeFromPoint = vi.fn((x) => (x < 50 ? startRange : endRange))

    const ranges = pointsToHighlightRanges(root, 1, { x: 10, y: 10 }, { x: 80, y: 10 })
    expect(ranges).toEqual([{ verse: 1, start: 0, end: 5 }])

    document.caretRangeFromPoint = original
    document.body.removeChild(root)
  })
})

import { describe, expect, it } from 'vitest'
import {
  toCanonicalVerseText,
  clampHighlightRange,
  applyHighlightRanges,
  getCanonicalOffset,
  selectionToHighlightRanges,
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
})

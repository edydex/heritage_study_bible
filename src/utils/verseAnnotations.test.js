import { describe, expect, it } from 'vitest'
import {
  annotationIncludesVerse,
  buildGroupedAnnotation,
  formatVerseReference,
} from './verseAnnotations'

describe('verse annotations', () => {
  it('formats contiguous and separate selected ranges', () => {
    const annotation = buildGroupedAnnotation([
      { book: 'Jeremiah', chapter: 20, verse: 15 },
      { book: 'Jeremiah', chapter: 20, verse: 13 },
      { book: 'Jeremiah', chapter: 20, verse: 14 },
      { book: 'Jeremiah', chapter: 20, verse: 18 },
    ])

    expect(formatVerseReference(annotation)).toBe('Jeremiah 20:13-15, 18')
    expect(annotationIncludesVerse(annotation, 'Jeremiah', 20, 14)).toBe(true)
    expect(annotationIncludesVerse(annotation, 'Jeremiah', 20, 17)).toBe(false)
  })
})

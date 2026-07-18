function normalizeVerse(value, fallbackBook = '') {
  if (!value) return null
  const book = String(value.book || fallbackBook || '')
  const chapter = Number(value.chapter)
  const verse = Number(value.verse)
  if (!book || !Number.isFinite(chapter) || !Number.isFinite(verse)) return null
  return {
    book,
    chapter,
    verse,
    ...(value.text ? { text: String(value.text) } : {}),
    ...(value.verseText ? { verseText: String(value.verseText) } : {}),
  }
}

export function getAnnotationVerses(annotation) {
  const fallbackBook = annotation?.book || ''
  const source = Array.isArray(annotation?.verses) && annotation.verses.length > 0
    ? annotation.verses
    : [annotation]

  const seen = new Set()
  return source.reduce((result, item) => {
    const normalized = normalizeVerse(item, fallbackBook)
    if (!normalized) return result
    const key = `${normalized.book}\u0000${normalized.chapter}\u0000${normalized.verse}`
    if (seen.has(key)) return result
    seen.add(key)
    result.push(normalized)
    return result
  }, [])
}

export function annotationIncludesVerse(annotation, book, chapter, verse) {
  return getAnnotationVerses(annotation).some(item =>
    item.book === book
    && item.chapter === Number(chapter)
    && item.verse === Number(verse)
  )
}

export function annotationsOverlap(left, right) {
  const rightKeys = new Set(getAnnotationVerses(right).map(item =>
    `${item.book}\u0000${item.chapter}\u0000${item.verse}`
  ))
  return getAnnotationVerses(left).some(item =>
    rightKeys.has(`${item.book}\u0000${item.chapter}\u0000${item.verse}`)
  )
}

function compactVerseNumbers(verses) {
  const numbers = [...new Set(verses.map(item => item.verse))].sort((a, b) => a - b)
  const ranges = []
  let start = numbers[0]
  let previous = numbers[0]

  for (let index = 1; index < numbers.length; index += 1) {
    const current = numbers[index]
    if (current === previous + 1) {
      previous = current
      continue
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
    start = current
    previous = current
  }
  if (numbers.length > 0) ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
  return ranges.join(', ')
}

export function formatVerseReference(annotation) {
  const verses = getAnnotationVerses(annotation)
  if (verses.length === 0) return ''

  const groups = new Map()
  verses.forEach(item => {
    const key = `${item.book}\u0000${item.chapter}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })

  return [...groups.entries()].map(([key, group]) => {
    const [book, chapter] = key.split('\u0000')
    return `${book} ${chapter}:${compactVerseNumbers(group)}`
  }).join('; ')
}

export function buildGroupedAnnotation(verses, extras = {}) {
  const normalized = getAnnotationVerses({ verses })
  const first = normalized[0]
  if (!first) return null
  return {
    ...extras,
    book: first.book,
    chapter: first.chapter,
    verse: first.verse,
    verses: normalized,
    reference: formatVerseReference({ verses: normalized }),
  }
}

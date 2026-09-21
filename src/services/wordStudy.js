import { loadTranslation } from '../data/translations'
import { hebrewOriginalBooks, visibleVerseText, verseWordLinks, loadGreekWordLinks } from '../data/originalLanguages'

export const wordTokens = text => [...visibleVerseText(text).matchAll(/[\p{L}\p{M}]+(?:[’'][\p{L}\p{M}]+)*/gu)]
export const normalizeWord = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/ς/g, 'σ')
export function interactiveWordRanges(text, pairs = [], context = {}) {
  return wordTokens(text).map(match => {
    const startOffset = match.index, endOffset = startOffset + match[0].length
    const pair = pairs.find(item => item.startOffset < endOffset && item.endOffset > startOffset)
    return { ...pair, ...context, id: pair?.id || `${context.translationId}:${context.book}:${context.chapter}:${context.verse}:${startOffset}`,
      startOffset, endOffset, word: match[0], paired: Boolean(pair), label: pair?.label || match[0] }
  })
}
let concordancePromise
export async function loadGreekConcordance() {
  if (!concordancePromise) concordancePromise = fetch(`${import.meta.env.BASE_URL}data/original-languages/greek-concordance.json`)
    .then(response => { if (!response.ok) throw new Error('Word occurrences could not load.'); return response.json() })
    .then(data => {
      if (data.schemaVersion !== 1 || data.sourceId !== 'N1904' || data.sourceSha256 !== '3beee6abb6302f691110fe0fc949fc195593b999cf2d0e463c9b573c1bb67150') throw new Error('Concordance source does not match.')
      return data
    }).catch(error => { concordancePromise = null; throw error })
  return concordancePromise
}
export function greekLemmaIds(data, word) {
  const range = word.translationId === 'ORIGINAL' ? [word.startOffset, word.endOffset] : word.sourceRange
  if (!range) return []
  const words = data.books.find(book => book.name === word.book)?.verses[`${word.chapter}:${word.verse}`] || []
  return [...new Set(words.filter(([start, end]) => start < range[1] && end > range[0]).map(row => row[2]))]
}
export function greekOccurrences(data, corpus, lemmaId) {
  const result = []
  for (const book of data.books) {
    const textBook = corpus.books.find(item => item.name === book.name)
    for (const [key, words] of Object.entries(book.verses)) {
      if (!words.some(word => word[2] === lemmaId)) continue
      const [chapter, verse] = key.split(':').map(Number)
      const text = textBook?.chapters.find(item => item.number === chapter)?.verses.find(item => item.number === verse)?.text
      const ranges = words.filter(word => word[2] === lemmaId).map(word => word.slice(0, 2))
      if (text) result.push({ book: book.name, chapter, verse, text, count: ranges.length, ranges })
    }
  }
  return result
}
export async function studyWord(word) {
  if ((word.translationId === 'ORIGINAL' && !hebrewOriginalBooks[word.book]) || word.sourceRange) {
    const [data, corpus] = await Promise.all([loadGreekConcordance(), loadTranslation('ORIGINAL')])
    const ids = greekLemmaIds(data, word)
    if (ids.length) return { kind: 'lemma', sourceId: 'N1904', scope: 'Greek New Testament · Nestle 1904',
      groups: ids.map(id => ({ ...data.lemmas[id], results: greekOccurrences(data, corpus, id) })) }
  }
  // Other translations expose exact normalized word forms, never guessed roots.
  const corpus = await loadTranslation(word.translationId, word.book)
  const results = []
  for (const book of corpus.books) for (const chapter of book.chapters) for (const verse of chapter.verses) {
    const ranges = wordTokens(verse.text).filter(match => normalizeWord(match[0]) === normalizeWord(word.word)).map(match => [match.index, match.index + match[0].length])
    if (ranges.length) results.push({ book: book.name, chapter: chapter.number, verse: verse.number, text: visibleVerseText(verse.text), count: ranges.length, ranges })
  }
  return { kind: 'form', sourceId: word.translationId === 'ORIGINAL' ? 'WLC-OSHB' : word.translationId, scope: word.translationId === 'ORIGINAL' ? `${word.book} · WLC / OSHB` : word.translationId,
    groups: [{ lemma: word.word, strongs: [], results }] }
}

export const occurrenceKey = row => `${row.book}:${row.chapter}:${row.verse}`

export function occurrenceTranslation(row, alignment, targetText) {
  if (!targetText) return { text: '', ranges: [], phrases: [], missingCount: row.count, status: 'missing-verse' }
  const text = visibleVerseText(targetText)
  // Require the exact displayed source and translation before using publisher links.
  const links = alignment?.book === row.book ? verseWordLinks(alignment, row.chapter, row.verse, row.text, text) : null
  const matched = links?.target.filter(link => row.ranges.some(([start, end]) => start < link.sourceRange[1] && end > link.sourceRange[0])) || []
  const ranges = [...new Map(matched.map(link => [String([link.startOffset, link.endOffset]), [link.startOffset, link.endOffset]])).values()].sort((a, b) => a[0] - b[0])
  const missingCount = row.ranges.filter(([start, end]) => !matched.some(link => start < link.sourceRange[1] && end > link.sourceRange[0])).length
  return { text, ranges, phrases: [...new Set(ranges.map(range => text.slice(...range)))], missingCount, status: ranges.length ? 'matched' : 'unmapped' }
}

// Enrich only the currently displayed page. Successful book mappings are cached;
// a failed request is retryable and never removes the original occurrence list.
export async function loadOccurrenceTranslations(rows, sourceId) {
  const corpus = await loadTranslation('BSB')
  const books = [...new Set(rows.map(row => row.book))]
  const mappings = sourceId === 'N1904' ? await Promise.allSettled(books.map(loadGreekWordLinks)) : []
  const results = {}
  let failed = false
  for (const row of rows) {
    const mapping = mappings[books.indexOf(row.book)]
    const book = corpus.books.find(book => book.name === row.book)
    const verse = book?.chapters.find(chapter => chapter.number === row.chapter)?.verses.find(verse => verse.number === row.verse)
    const value = occurrenceTranslation(row, mapping?.status === 'fulfilled' ? mapping.value : null, verse?.text)
    if (mapping?.status === 'rejected') { value.status = 'load-error'; failed = true }
    results[occurrenceKey(row)] = value
  }
  return { results, failed }
}

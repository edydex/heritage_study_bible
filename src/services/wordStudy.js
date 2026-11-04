import { loadTranslation } from '../data/translations'
import { hebrewOriginalBooks, visibleVerseText, verseWordLinks, loadGreekWordLinks, greekWordLinkTranslations } from '../data/originalLanguages'
import { occurrenceWordAnchors } from './parallelWordAnchors'

export const wordTokens = text => [...visibleVerseText(text).matchAll(/[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu)]
export const normalizeWord = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/ς/g, 'σ')
export function interactiveWordRanges(text, pairs = [], context = {}) {
  const { unpairedNotes = [], lookupLinks = [], ...wordContext } = context
  return wordTokens(text).map(match => {
    const startOffset = match.index, endOffset = startOffset + match[0].length
    const pair = pairs.find(item => item.startOffset < endOffset && item.endOffset > startOffset)
    const lookup = pair || lookupLinks.find(item => item.startOffset < endOffset && item.endOffset > startOffset)
    const note = !pair && unpairedNotes.find(item => item.startOffset < endOffset && item.endOffset > startOffset)
    const studyHeadAnchors = (Array.isArray(lookup?.studyHeads) ? lookup.studyHeads : [])
      .filter(head => Array.isArray(head?.targetRanges) && Array.isArray(head.sourceAnchors)
        && head.targetRanges.some(range => Array.isArray(range) && range[0] < endOffset && range[1] > startOffset))
      .flatMap(head => head.sourceAnchors)
    return { ...lookup, ...wordContext, ...(studyHeadAnchors.length ? { studyHeadAnchors } : {}), id: pair?.id || `${context.translationId}:${context.book}:${context.chapter}:${context.verse}:${startOffset}`,
      pattern: pair?.pattern, startOffset, endOffset, word: match[0], paired: Boolean(pair), label: pair?.label || match[0],
      unpairedReason: note?.reason || (!pair && lookup && context.translationId !== 'ORIGINAL' ? `${lookup.label}. No checked counterpart is available in the other column.` : undefined) }
  })
}
let concordancePromise
let hebrewConcordancePromise
export async function loadHebrewConcordance() {
  if (!hebrewConcordancePromise) hebrewConcordancePromise = fetch(`${import.meta.env.BASE_URL}data/original-languages/hebrew-concordance.json`)
    .then(response => { if (!response.ok) throw new Error('Word occurrences could not load.'); return response.json() })
    .then(data => {
      if (data.schemaVersion !== 1 || data.sourceId !== 'WLC-OSHB' || data.revision !== '3d15126fb1ef74867fc1434be1942e837932691f'
        || data.counts?.words !== 305507 || data.books?.length !== 39) throw new Error('Concordance source does not match.')
      return data
    }).catch(error => { hebrewConcordancePromise = null; throw error })
  return hebrewConcordancePromise
}
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
  const studyAnchors = word.studySourceAnchors?.length ? word.studySourceAnchors : word.sourceAnchors
  if (word.translationId !== 'ORIGINAL' && studyAnchors?.length) {
    const verses = data.books.find(book => book.name === word.book)?.verses || {}
    const ids = prioritizeGreekLemmas([...new Set(studyAnchors.flatMap(anchor => (verses[`${anchor.chapter}:${anchor.verse}`] || [])
      .filter(([start, end]) => start < anchor.endOffset && end > anchor.startOffset).map(row => row[2])))], data, word)
    // A reviewed head chooses the first tab within this word's own phrase;
    // every other linked lemma remains available in its existing order.
    const heads = new Set((Array.isArray(word.studyHeadAnchors) ? word.studyHeadAnchors : [])
      .filter(head => head && Number.isInteger(head.startOffset) && Number.isInteger(head.endOffset) && head.endOffset > head.startOffset
        && studyAnchors.some(owner => head.chapter === owner.chapter && head.verse === owner.verse
        && head.startOffset >= owner.startOffset && head.endOffset <= owner.endOffset))
      .flatMap(anchor => (verses[`${anchor.chapter}:${anchor.verse}`] || [])
        .filter(([start, end]) => start < anchor.endOffset && end > anchor.startOffset).map(row => row[2])))
    return heads.size ? [...ids.filter(id => heads.has(id)), ...ids.filter(id => !heads.has(id))] : ids
  }
  const ranges = word.translationId === 'ORIGINAL' ? [[word.startOffset, word.endOffset]] : word.sourceRanges || (word.sourceRange ? [word.sourceRange] : [])
  if (!ranges.length) return []
  const words = data.books.find(book => book.name === word.book)?.verses[`${word.chapter}:${word.verse}`] || []
  return prioritizeGreekLemmas([...new Set(words.filter(([start, end]) => ranges.some(range => start < range[1] && end > range[0])).map(row => row[2]))], data, word)
}

// Every lemma remains available in a many-to-many phrase. Choose a useful
// initial tab for an English word before another head in its shared phrase.
function prioritizeGreekLemmas(ids, data, word) {
  if (word.translationId === 'ORIGINAL' || ids.length < 2 || !data.lemmas) return ids
  const preferred = {
    the: ['3588'], and: ['2532','1161','5037'], but: ['235','1161'], or: ['2228'],
    no: ['3756','3361'], not: ['3756','3361'],
    am: ['1510'], are: ['1510'], be: ['1510'], been: ['1510'], being: ['1510'], is: ['1510'], was: ['1510'], were: ['1510'],
    i: ['1473'], me: ['1473'], my: ['1473'], mine: ['1473'], our: ['1473'], ours: ['1473'], we: ['1473'], us: ['1473'],
    you: ['4771'], your: ['4771'], yours: ['4771'], he: ['846'], him: ['846'], his: ['846'], she: ['846'], her: ['846'], hers: ['846'], it: ['846'], its: ['846'], they: ['846'], them: ['846'], their: ['846'], theirs: ['846'],
  }[normalizeWord(word.word || '')] || []
  const preserveNegativeFallback = ["no","not","never","neither","nor","none","nobody","without"].includes(normalizeWord(word.word || ''))
  const grammatical = new Set(['3588','1510','2532','1161','5037','235','2228','1473','4771','846','1519','1722','1537','1223','2596','5228','4012','1909','4314','3326','4862','575', ...(!preserveNegativeFallback ? ['3756','3361'] : [])])
  const rank = id => {
    const strongs = data.lemmas[id]?.strongs || []
    if (strongs.some(strong => preferred.includes(String(Number(strong))))) return -1
    return strongs.some(strong => grammatical.has(String(Number(strong)))) ? 1 : 0
  }
  return [...ids].sort((a, b) => rank(a) - rank(b))
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
export function hebrewLemmaIds(data, word) {
  if (word.translationId !== 'ORIGINAL') return []
  const entry = data.books.find(book => book.name === word.book)?.verses[`${word.chapter}:${word.verse}`]
  if (word.word && entry?.text.slice(word.startOffset, word.endOffset) !== word.word) return []
  return [...new Set((entry?.words || []).filter(([start, end]) => start < word.endOffset && end > word.startOffset).flatMap(row => row[2]))]
}
export function hebrewOccurrences(data, lemmaId) {
  const result = []
  for (const book of data.books) for (const [key, entry] of Object.entries(book.verses)) {
    const ranges = entry.words.filter(row => row[2].includes(lemmaId)).map(row => row.slice(0, 2))
    if (!ranges.length) continue
    const [chapter, verse] = key.split(':').map(Number)
    result.push({ book: book.name, chapter, verse, heading: verse === 0, text: entry.text, count: ranges.length, ranges })
  }
  return result
}

// A verse-level source view is available even when no checked English phrase
// link exists. Choosing a source word is explicit; never infer a translation.
export async function sourceVerseWords(word) {
  const corpus = await loadTranslation('ORIGINAL', word.book)
  const book = corpus.books.find(book => book.name === word.book)
  const references = word.sourceReferences || [{ chapter: word.chapter, verse: word.verse }]
  return references.flatMap(reference => {
    const verse = book?.chapters.find(chapter => chapter.number === reference.chapter)?.verses.find(verse => verse.number === reference.verse)
    return interactiveWordRanges(verse?.text || '', [], { book: word.book, ...reference, translationId: 'ORIGINAL', comparisonTranslationId: word.comparisonTranslationId || word.translationId })
  })
}
export async function studyWord(word) {
  if (word.translationId === 'ORIGINAL' && hebrewOriginalBooks[word.book]) {
    const data = await loadHebrewConcordance()
    const ids = hebrewLemmaIds(data, word)
    if (ids.length) return { kind: 'lemma', sourceId: 'WLC-OSHB', scope: 'Hebrew / Aramaic Old Testament · WLC / OSHB',
      groups: ids.map(id => ({ ...data.lemmas[id], results: hebrewOccurrences(data, id) })) }
  }
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
  const overlapsSource = (link, start, end) => (link.sourceRanges || [link.sourceRange]).some(range => start < range[1] && end > range[0])
  const matched = links?.target.filter(link => row.ranges.some(([start, end]) => overlapsSource(link, start, end))) || []
  const ranges = [...new Map(matched.map(link => [String([link.startOffset, link.endOffset]), [link.startOffset, link.endOffset]])).values()].sort((a, b) => a[0] - b[0])
  const missingCount = row.ranges.filter(([start, end]) => !matched.some(link => overlapsSource(link, start, end))).length
  return { text, ranges, phrases: [...new Set(ranges.map(range => text.slice(...range)))], missingCount, status: ranges.length ? 'matched' : 'unmapped' }
}

// Enrich only the currently displayed page. Successful book mappings are cached;
// a failed request is retryable and never removes the original occurrence list.
export async function loadOccurrenceTranslations(rows, sourceId, translationId = 'BSB') {
  const targetId = greekWordLinkTranslations.includes(translationId) ? translationId : 'BSB'
  const hasMappings = sourceId === 'N1904' && greekWordLinkTranslations.includes(targetId)
  const [corpus, original] = await Promise.all([loadTranslation(targetId), hasMappings ? loadTranslation('ORIGINAL') : null])
  const books = [...new Set(rows.map(row => row.book))]
  const mappings = hasMappings ? await Promise.allSettled(books.map(book => loadGreekWordLinks(book, targetId))) : []
  const results = {}
  let failed = false
  for (const row of rows) {
    const mapping = mappings[books.indexOf(row.book)]
    const book = corpus.books.find(book => book.name === row.book)
    const verse = book?.chapters.find(chapter => chapter.number === row.chapter)?.verses.find(verse => verse.number === row.verse)
    const sourceBook = original?.books.find(book => book.name === row.book)
    const value = mapping?.status === 'fulfilled' && sourceBook
      ? occurrenceWordAnchors(row, mapping.value, book, sourceBook)
      : occurrenceTranslation(row, null, verse?.text)
    if (mapping?.status === 'rejected') { value.status = 'load-error'; failed = true }
    results[occurrenceKey(row)] = value
  }
  return { results, failed }
}

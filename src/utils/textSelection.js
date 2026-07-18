import { buildGroupedAnnotation } from './verseAnnotations'
import { splitParagraphText } from './verseLayout'

export function getSelectableVerseText(text) {
  const { segments } = splitParagraphText(text)
  return segments
    .map(segment => segment.replace(/\s*\|\|\s*/g, '\n').replace(/<\/?b>/g, ''))
    .join('\n')
}

export function resolveTextAnchor(segment, currentVerseText) {
  const text = getSelectableVerseText(currentVerseText)
  const selected = String(segment?.selectedText || '')
  if (!selected) return null
  if (text.slice(segment.startOffset, segment.endOffset) === selected) return segment

  const matches = []
  let cursor = 0
  while (cursor <= text.length - selected.length) {
    const index = text.indexOf(selected, cursor)
    if (index < 0) break
    matches.push(index)
    cursor = index + 1
  }
  if (matches.length === 0) return null

  const prefix = String(segment.prefix || '')
  const suffix = String(segment.suffix || '')
  const scored = matches.map(index => {
    let score = 0
    if (prefix && text.slice(Math.max(0, index - prefix.length), index) === prefix) score += 2
    if (suffix && text.slice(index + selected.length, index + selected.length + suffix.length) === suffix) score += 2
    score -= Math.abs(index - Number(segment.startOffset || 0)) / Math.max(1, text.length)
    return { index, score }
  }).sort((left, right) => right.score - left.score)
  const startOffset = scored[0].index
  return {
    ...segment,
    startOffset,
    endOffset: startOffset + selected.length,
    reanchored: startOffset !== segment.startOffset,
  }
}

function fragmentText(fragment) {
  const clone = fragment.cloneNode(true)
  clone.querySelectorAll?.('[data-selection-ignore]').forEach(element => element.remove())
  clone.querySelectorAll?.('br').forEach(element => element.replaceWith('\n'))
  return clone.textContent || ''
}

function elementText(element) {
  const range = element.ownerDocument.createRange()
  range.selectNodeContents(element)
  return fragmentText(range.cloneContents())
}

function offsetWithin(element, container, offset) {
  const range = element.ownerDocument.createRange()
  range.setStart(element, 0)
  range.setEnd(container, offset)
  return fragmentText(range.cloneContents()).length
}

function selectionIntersects(range, element) {
  try {
    return range.intersectsNode(element)
  } catch {
    return false
  }
}

export function captureBibleTextSelection(selection, root) {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !root) return null
  const range = selection.getRangeAt(0)
  const candidates = [...root.querySelectorAll('[data-verse-content]')]
  const segments = []

  candidates.forEach(element => {
    if (!selectionIntersects(range, element)) return
    const text = elementText(element)
    const startOffset = element.contains(range.startContainer)
      ? offsetWithin(element, range.startContainer, range.startOffset)
      : 0
    const endOffset = element.contains(range.endContainer)
      ? offsetWithin(element, range.endContainer, range.endOffset)
      : text.length
    const start = Math.max(0, Math.min(startOffset, text.length))
    const end = Math.max(start, Math.min(endOffset, text.length))
    const selectedText = text.slice(start, end)
    if (!selectedText.trim()) return

    segments.push({
      book: element.dataset.book,
      chapter: Number(element.dataset.chapter),
      verse: Number(element.dataset.verse),
      translationId: element.dataset.translation,
      startOffset: start,
      endOffset: end,
      selectedText,
      prefix: text.slice(Math.max(0, start - 24), start),
      suffix: text.slice(end, end + 24),
      verseText: text,
    })
  })

  if (segments.length === 0) return null
  const translations = [...new Set(segments.map(segment => segment.translationId).filter(Boolean))]
  const grouped = buildGroupedAnnotation(segments.map(segment => ({
    book: segment.book,
    chapter: segment.chapter,
    verse: segment.verse,
    text: segment.verseText,
  })))

  const captured = {
    ...grouped,
    kind: 'text',
    segments,
    translationId: translations.length === 1 ? translations[0] : null,
    mixedTranslations: translations.length > 1,
    selectedText: segments.map(segment => segment.selectedText).join('\n'),
  }
  return {
    ...captured,
    snippets: [{
      segments,
      selectedText: captured.selectedText,
      reference: captured.reference,
    }],
    snippetCount: 1,
  }
}

function segmentKey(segment) {
  return [
    segment.translationId,
    segment.book,
    segment.chapter,
    segment.verse,
    segment.startOffset,
    segment.endOffset,
  ].join('\u0000')
}

function normalizeSnippets(selection) {
  if (Array.isArray(selection?.snippets) && selection.snippets.length > 0) {
    return selection.snippets.filter(snippet => Array.isArray(snippet?.segments) && snippet.segments.length > 0)
  }
  if (!Array.isArray(selection?.segments) || selection.segments.length === 0) return []
  return [{
    segments: selection.segments,
    selectedText: selection.selectedText || selection.segments.map(segment => segment.selectedText).join('\n'),
    reference: selection.reference || '',
  }]
}

export function combineBibleTextSelections(selections) {
  const snippets = []
  const seenSnippets = new Set()

  for (const selection of selections || []) {
    for (const snippet of normalizeSnippets(selection)) {
      const key = snippet.segments.map(segmentKey).join('\u0001')
      if (!key || seenSnippets.has(key)) continue
      seenSnippets.add(key)
      snippets.push(snippet)
    }
  }

  if (snippets.length === 0) return null

  const seenSegments = new Set()
  const segments = snippets.flatMap(snippet => snippet.segments).filter(segment => {
    const key = segmentKey(segment)
    if (seenSegments.has(key)) return false
    seenSegments.add(key)
    return true
  })
  const translations = [...new Set(segments.map(segment => segment.translationId).filter(Boolean))]
  const grouped = buildGroupedAnnotation(segments.map(segment => ({
    book: segment.book,
    chapter: segment.chapter,
    verse: segment.verse,
    text: segment.verseText,
  })))
  if (!grouped) return null

  return {
    ...grouped,
    kind: 'text',
    snippets,
    snippetCount: snippets.length,
    segments,
    translationId: translations.length === 1 ? translations[0] : null,
    mixedTranslations: translations.length > 1,
    selectedText: snippets.map(snippet => snippet.selectedText).filter(Boolean).join('\n…\n'),
  }
}

export function clearBrowserTextSelection() {
  globalThis.window?.getSelection?.()?.removeAllRanges?.()
}

export function textSelectionMatchesAnnotation(selection, annotation) {
  if (!selection?.segments?.length || !annotation?.segments?.length) return false
  if (selection.translationId !== annotation.translationId) return false
  return selection.segments.length === annotation.segments.length
    && selection.segments.every((segment, index) => {
      const saved = annotation.segments[index]
      return segment.book === saved.book
        && segment.chapter === saved.chapter
        && segment.verse === saved.verse
        && segment.startOffset === saved.startOffset
        && segment.endOffset === saved.endOffset
    })
}

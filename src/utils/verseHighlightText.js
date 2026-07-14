import { createElement } from 'react'
import { getHighlightColor } from '../hooks/useHighlights'

/** Strip <b> tags and convert || poetry markers to newlines (display/storage offsets). */
export function toCanonicalVerseText(raw) {
  return String(raw)
    .replace(/<\/?b>/gi, '')
    .replace(/\s*\|\|\s*/g, '\n')
}

export function clampHighlightRange(range, length) {
  const start = Math.max(0, Math.min(range.start, length))
  const end = Math.max(start, Math.min(range.end, length))
  if (end <= start) return null
  return { ...range, start, end }
}

function segmentKey(meta) {
  if (!meta?.color) return ''
  return `${meta.color}:${meta.preview ? 'p' : 'c'}`
}

function renderLineSegments(lineText, lineCanonicalStart, metaAtOffset) {
  if (!lineText) return null
  const segments = []
  let i = 0
  while (i < lineText.length) {
    const meta = metaAtOffset(lineCanonicalStart + i)
    const key = segmentKey(meta)
    let j = i + 1
    while (j < lineText.length && segmentKey(metaAtOffset(lineCanonicalStart + j)) === key) j++
    const text = lineText.slice(i, j)
    const markClass = meta?.color ? getHighlightColor(meta.color)?.markClass : null
    if (markClass) {
      const className = meta.preview
        ? `verse-highlight verse-highlight-preview ${markClass}`
        : `verse-highlight ${markClass}`
      segments.push(
        createElement('mark', { key: `${lineCanonicalStart}-${i}`, className }, text)
      )
    } else {
      segments.push(text)
    }
    i = j
  }
  return segments
}

/**
 * Render verse body with inline highlight marks aligned to canonical offsets.
 * previewRanges paint over committed colors and use verse-highlight-preview.
 */
export function applyHighlightRanges(raw, ranges, previewRanges = []) {
  const canonical = toCanonicalVerseText(raw)
  const len = canonical.length
  const metaAt = new Array(len).fill(null)

  for (const range of ranges) {
    const clamped = clampHighlightRange(range, len)
    if (!clamped) continue
    for (let i = clamped.start; i < clamped.end; i++) {
      metaAt[i] = { color: clamped.color, preview: false }
    }
  }

  for (const range of previewRanges) {
    const clamped = clampHighlightRange(range, len)
    if (!clamped) continue
    for (let i = clamped.start; i < clamped.end; i++) {
      metaAt[i] = { color: clamped.color, preview: true }
    }
  }

  const hasHighlight = metaAt.some(Boolean)
  if (!hasHighlight) return null

  const lines = canonical.split('\n')
  let offset = 0
  return lines.map((line, li) => {
    const lineStart = offset
    offset += line.length + 1
    const lineContent = renderLineSegments(line, lineStart, (idx) => metaAt[idx] ?? null)
    if (li === 0) {
      return createElement('span', { key: `l${li}` }, lineContent)
    }
    return createElement(
      'span',
      { key: `l${li}` },
      createElement('br'),
      createElement('span', { className: 'inline-block w-4' }),
      lineContent
    )
  })
}

/** Letters, numbers, and apostrophes count as word characters for snap. */
export function isWordChar(ch) {
  if (!ch) return false
  return /[\p{L}\p{N}']/u.test(ch)
}

/** Expand [start, end) to whole-word boundaries in canonical verse text. */
export function snapRangeToWords(text, start, end) {
  const value = String(text ?? '')
  const len = value.length
  let s = Math.max(0, Math.min(start, len))
  let e = Math.max(0, Math.min(end, len))
  if (e < s) [s, e] = [e, s]

  if (e === s) {
    if (s < len && isWordChar(value[s])) {
      while (s > 0 && isWordChar(value[s - 1])) s--
      e = s
      while (e < len && isWordChar(value[e])) e++
      return e > s ? { start: s, end: e } : null
    }
    if (s > 0 && isWordChar(value[s - 1])) {
      e = s
      while (s > 0 && isWordChar(value[s - 1])) s--
      return e > s ? { start: s, end: e } : null
    }
    return null
  }

  while (s < e && /\s/.test(value[s])) s++
  while (e > s && /\s/.test(value[e - 1])) e--
  if (e <= s) return null

  if (isWordChar(value[s])) {
    while (s > 0 && isWordChar(value[s - 1])) s--
  }
  if (e > 0 && isWordChar(value[e - 1])) {
    while (e < len && isWordChar(value[e])) e++
  }
  return e > s ? { start: s, end: e } : null
}

/** Reconstruct canonical verse text from rendered verse DOM. */
export function canonicalTextFromVerseEl(verseTextEl) {
  if (!verseTextEl) return ''
  let out = ''
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (node.nodeName === 'BR') {
      out += '\n'
      return
    }
    if (node.classList?.contains('inline-block')) return
    for (const child of node.childNodes) walk(child)
  }
  walk(verseTextEl)
  return out
}

/** Snap per-verse highlight ranges to word boundaries using verse DOM text. */
export function snapHighlightRanges(ranges, rootEl, chapterNumber) {
  if (!ranges?.length || !rootEl) return []
  const out = []
  for (const range of ranges) {
    const verseEl = rootEl.querySelector(
      `[data-verse-text][data-chapter="${chapterNumber}"][data-verse="${range.verse}"]`
    )
    if (!verseEl) {
      out.push(range)
      continue
    }
    const snapped = snapRangeToWords(canonicalTextFromVerseEl(verseEl), range.start, range.end)
    if (!snapped) continue
    out.push({ ...range, start: snapped.start, end: snapped.end })
  }
  return out
}

/** Canonical length of a DOM subtree (text + BR newlines; skip indent spacers). */
export function canonicalLengthOfNode(node) {
  if (!node) return 0
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.length
  if (node.nodeType !== Node.ELEMENT_NODE) return 0
  if (node.nodeName === 'BR') return 1
  if (node.classList?.contains('inline-block')) return 0
  let total = 0
  for (const child of node.childNodes) total += canonicalLengthOfNode(child)
  return total
}

/** Walk verse DOM and map a boundary point to a canonical text offset. */
export function getCanonicalOffset(verseTextEl, container, offset) {
  let canonicalOffset = 0
  let found = null

  const walk = (node) => {
    if (found != null) return

    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length
      if (node === container) {
        found = canonicalOffset + Math.min(Math.max(0, offset), len)
        return
      }
      canonicalOffset += len
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return

    if (node.nodeName === 'BR') {
      if (node === container) {
        found = canonicalOffset + Math.min(Math.max(0, offset), 1)
        return
      }
      canonicalOffset += 1
      return
    }

    if (node.classList?.contains('inline-block')) {
      return
    }

    // Element boundary: offset is a child index (Range selectNodeContents style).
    if (node === container) {
      const childCount = node.childNodes.length
      const clamped = Math.min(Math.max(0, offset), childCount)
      let extra = 0
      for (let i = 0; i < clamped; i++) {
        extra += canonicalLengthOfNode(node.childNodes[i])
      }
      found = canonicalOffset + extra
      return
    }

    for (const child of node.childNodes) {
      walk(child)
      if (found != null) return
    }
  }

  walk(verseTextEl)
  return found
}

function nodeTouchesRange(range, node) {
  if (!range || !node) return false
  if (typeof range.intersectsNode === 'function') {
    try {
      return range.intersectsNode(node)
    } catch {
      // Fall through to containment checks.
    }
  }
  return node === range.startContainer
    || node === range.endContainer
    || node.contains?.(range.startContainer)
    || node.contains?.(range.endContainer)
}

function boundaryInsideNode(node, container) {
  return node === container || node.contains?.(container)
}

function rangeEnclosesNodeContents(range, node) {
  try {
    const probe = node.ownerDocument.createRange()
    probe.selectNodeContents(node)
    if (typeof range.isPointInRange === 'function') {
      return range.isPointInRange(probe.startContainer, probe.startOffset)
        && range.isPointInRange(probe.endContainer, probe.endOffset)
    }
  } catch {
    // Fall through.
  }
  return nodeTouchesRange(range, node)
}

/** Convert a DOM Range into per-verse canonical highlight ranges (cross-verse). */
export function rangeToHighlightRanges(range, rootEl, chapterNumber) {
  if (!range || range.collapsed || !rootEl) return []

  const verseEls = rootEl.querySelectorAll(`[data-verse-text][data-chapter="${chapterNumber}"]`)
  const results = []

  verseEls.forEach((verseTextEl) => {
    const startsInside = boundaryInsideNode(verseTextEl, range.startContainer)
    const endsInside = boundaryInsideNode(verseTextEl, range.endContainer)

    if (!startsInside && !endsInside) {
      if (!rangeEnclosesNodeContents(range, verseTextEl)) return
      const length = canonicalLengthOfNode(verseTextEl)
      if (length <= 0) return
      results.push({
        verse: Number(verseTextEl.dataset.verse),
        start: 0,
        end: length,
      })
      return
    }

    const start = startsInside
      ? getCanonicalOffset(verseTextEl, range.startContainer, range.startOffset)
      : 0
    const end = endsInside
      ? getCanonicalOffset(verseTextEl, range.endContainer, range.endOffset)
      : canonicalLengthOfNode(verseTextEl)

    if (start == null || end == null || end <= start) return
    results.push({
      verse: Number(verseTextEl.dataset.verse),
      start,
      end,
    })
  })

  return results
}

/** Convert a browser Selection into per-verse canonical highlight ranges (cross-verse). */
export function selectionToHighlightRanges(selection, rootEl, chapterNumber) {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return []
  return rangeToHighlightRanges(selection.getRangeAt(0), rootEl, chapterNumber)
}

/** Resolve a caret position from screen coordinates. */
export function caretFromPoint(doc, clientX, clientY) {
  if (!doc) return null
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(clientX, clientY)
    if (!range) return null
    return { node: range.startContainer, offset: range.startOffset }
  }
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(clientX, clientY)
    if (!pos) return null
    return { node: pos.offsetNode, offset: pos.offset }
  }
  return null
}

/** Build a DOM Range between two caret positions (order-agnostic). */
export function rangeFromCarets(doc, startCaret, endCaret) {
  if (!doc || !startCaret?.node || !endCaret?.node) return null
  const forward = doc.createRange()
  const reverse = doc.createRange()
  try {
    forward.setStart(startCaret.node, startCaret.offset)
    forward.setEnd(endCaret.node, endCaret.offset)
    if (!forward.collapsed) return forward
  } catch {
    // Boundaries may be reversed; try the opposite order below.
  }
  try {
    reverse.setStart(endCaret.node, endCaret.offset)
    reverse.setEnd(startCaret.node, startCaret.offset)
    if (!reverse.collapsed) return reverse
  } catch {
    return null
  }
  return null
}

/**
 * Convert two screen points into per-verse highlight ranges.
 * startXY / endXY: { x, y } in client coordinates.
 */
export function pointsToHighlightRanges(rootEl, chapterNumber, startXY, endXY) {
  if (!rootEl || !startXY || !endXY) return []
  const doc = rootEl.ownerDocument
  const startCaret = caretFromPoint(doc, startXY.x, startXY.y)
  const endCaret = caretFromPoint(doc, endXY.x, endXY.y)
  const range = rangeFromCarets(doc, startCaret, endCaret)
  if (!range) return []
  return rangeToHighlightRanges(range, rootEl, chapterNumber)
}

/** Map a screen point to a canonical offset inside a verse text element. */
export function getCanonicalOffsetFromPoint(verseTextEl, clientX, clientY) {
  const caret = caretFromPoint(verseTextEl.ownerDocument, clientX, clientY)
  if (!caret || !verseTextEl.contains(caret.node)) return null
  return getCanonicalOffset(verseTextEl, caret.node, caret.offset)
}

/** Apply a live selection Range for visual feedback during highlight drag. */
export function setLiveSelectionRange(range) {
  const selection = typeof window !== 'undefined' ? window.getSelection() : null
  if (!selection || !range) return
  selection.removeAllRanges()
  selection.addRange(range)
}

export function clearLiveSelection() {
  const selection = typeof window !== 'undefined' ? window.getSelection() : null
  selection?.removeAllRanges()
}

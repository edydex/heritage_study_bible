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

function renderLineSegments(lineText, lineCanonicalStart, colorAtOffset) {
  if (!lineText) return null
  const segments = []
  let i = 0
  while (i < lineText.length) {
    const color = colorAtOffset(lineCanonicalStart + i)
    let j = i + 1
    while (j < lineText.length && colorAtOffset(lineCanonicalStart + j) === color) j++
    const text = lineText.slice(i, j)
    const markClass = color ? getHighlightColor(color)?.markClass : null
    if (markClass) {
      segments.push(
        createElement('mark', { key: `${lineCanonicalStart}-${i}`, className: `verse-highlight ${markClass}` }, text)
      )
    } else {
      segments.push(text)
    }
    i = j
  }
  return segments
}

/** Render verse body with inline highlight marks aligned to canonical offsets. */
export function applyHighlightRanges(raw, ranges) {
  const canonical = toCanonicalVerseText(raw)
  const len = canonical.length
  const colorAt = new Array(len).fill(null)

  for (const range of ranges) {
    const clamped = clampHighlightRange(range, len)
    if (!clamped) continue
    for (let i = clamped.start; i < clamped.end; i++) {
      colorAt[i] = clamped.color
    }
  }

  const hasHighlight = colorAt.some(Boolean)
  if (!hasHighlight) return null

  const lines = canonical.split('\n')
  let offset = 0
  return lines.map((line, li) => {
    const lineStart = offset
    offset += line.length + 1
    const lineContent = renderLineSegments(line, lineStart, (idx) => colorAt[idx] ?? null)
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

/** Walk verse DOM and map a boundary point to a canonical text offset. */
export function getCanonicalOffset(verseTextEl, container, offset) {
  let canonicalOffset = 0
  let found = null

  const walk = (node) => {
    if (found != null) return

    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length
      if (node === container) {
        found = canonicalOffset + Math.min(offset, len)
        return
      }
      canonicalOffset += len
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return

    if (node.nodeName === 'BR') {
      if (node === container) {
        found = canonicalOffset + Math.min(offset, 1)
        return
      }
      canonicalOffset += 1
      return
    }

    if (node.classList?.contains('inline-block')) {
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

function rangeIntersectsNode(range, node) {
  try {
    const intersection = intersectRangeWithNode(range, node)
    return !intersection.collapsed
  } catch {
    return false
  }
}

function intersectRangeWithNode(range, node) {
  const doc = node.ownerDocument
  const result = range.cloneRange()
  const nodeRange = doc.createRange()
  nodeRange.selectNodeContents(node)

  if (result.compareBoundaryPoints(Range.START_TO_START, nodeRange) < 0) {
    result.setStart(nodeRange.startContainer, nodeRange.startOffset)
  }
  if (result.compareBoundaryPoints(Range.END_TO_END, nodeRange) > 0) {
    result.setEnd(nodeRange.endContainer, nodeRange.endOffset)
  }
  return result
}

/** Convert a DOM Range into per-verse canonical highlight ranges (cross-verse). */
export function rangeToHighlightRanges(range, rootEl, chapterNumber) {
  if (!range || range.collapsed || !rootEl) return []

  const verseEls = rootEl.querySelectorAll(`[data-verse-text][data-chapter="${chapterNumber}"]`)
  const results = []

  verseEls.forEach((verseTextEl) => {
    if (!rangeIntersectsNode(range, verseTextEl)) return
    const intersection = intersectRangeWithNode(range, verseTextEl)
    const start = getCanonicalOffset(verseTextEl, intersection.startContainer, intersection.startOffset)
    const end = getCanonicalOffset(verseTextEl, intersection.endContainer, intersection.endOffset)
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

// Keep the sentence inside the readable viewport. Do not recenter every time
// narration advances; long sentences stay anchored at their first line.
export function readingScrollDelta(rect, height, top = 130, bottomInset = 90) {
  const bottom = height - bottomInset
  if (rect.height > bottom - top) return rect.top < top || rect.top > bottom ? rect.top - top : 0
  if (rect.top < top) return rect.top - top
  if (rect.bottom > bottom) return rect.bottom - bottom
  return 0
}
export function keepReadingSentenceVisible(rect) {
  const delta = readingScrollDelta(rect, window.innerHeight)
  if (delta) window.scrollBy({ top: delta, behavior: 'instant' })
}

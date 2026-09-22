// Advance before the sentence reaches the bottom quarter of the screen, then
// leave its beginning at 15%. Keep clear of reader bars on short screens.
export function readingScrollDelta(rect, height, topInset = 0, bottomInset = 0) {
  if (!rect || height <= 0) return 0
  const safeTop = topInset + 12
  const top = Math.max(height * 0.15, safeTop)
  const bottom = Math.min(height * 0.75, height - bottomInset - 12)
  if (rect.top < safeTop) return rect.top - top
  // A long sentence may still extend below the trigger after this move.
  // Never chase its bottom or scroll its beginning out of view.
  if (rect.bottom > bottom && rect.top > top + 1) return rect.top - top
  return 0
}
export function keepReadingSentenceVisible(rect) {
  const header = document.querySelector('[data-book-reader-header]')?.getBoundingClientRect()
  const footer = document.querySelector('[data-book-reader-footer]')?.getBoundingClientRect()
  const delta = readingScrollDelta(rect, window.innerHeight, Math.max(0, header?.bottom || 0),
    footer ? Math.max(0, window.innerHeight - footer.top) : 0)
  if (delta) window.scrollBy({ top: delta, behavior: 'instant' })
}

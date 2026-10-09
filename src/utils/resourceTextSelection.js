export function captureResourceTextSelection(selection, root) {
  if (!selection?.rangeCount || selection.isCollapsed || !root) return null
  const range = selection.getRangeAt(0)
  const element = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement
  const paragraph = element?.closest('[data-book-paragraph]')
  if (!paragraph || !root.contains(paragraph) || !paragraph.contains(range.endContainer)) return null
  const before = range.cloneRange()
  before.selectNodeContents(paragraph)
  before.setEnd(range.startContainer, range.startOffset)
  const selectedText = range.toString()
  if (!selectedText.trim()) return null
  return {
    paragraphIndex: Number(paragraph.dataset.bookParagraph),
    startOffset: before.toString().length,
    selectedText,
    prefix: before.toString().slice(-24),
  }
}

export function findResourceBookmarkOffset(bookmark, text) {
  const selectedText = bookmark.selectedText || ''
  if (!selectedText) return null
  if (text.slice(bookmark.startOffset, bookmark.startOffset + selectedText.length) === selectedText) return bookmark.startOffset
  const candidates = []
  let offset = text.indexOf(selectedText)
  while (offset >= 0) {
    candidates.push(offset)
    offset = text.indexOf(selectedText, offset + 1)
  }
  const matching = candidates.filter(start => text.slice(Math.max(0, start - (bookmark.prefix || '').length), start) === bookmark.prefix)
  return matching.length === 1 ? matching[0] : candidates.length === 1 ? candidates[0] : null
}

import { useCallback, useRef } from 'react'
import JournalTextBlock from './JournalTextBlock'
import { DEFAULT_PAGE_HEIGHT } from '../hooks/useJournal'
import { isDoubleTap } from '../utils/doubleTap'

function JournalNotesPane({
  blocks = [],
  pageHeight = DEFAULT_PAGE_HEIGHT,
  onBlockTextChange,
  onBlockRemove,
  onAddBlock,
  inkBlockingText = false,
}) {
  const lastTap = useRef(null)
  const pageRef = useRef(null)
  const insertGuard = useRef(false)

  const addBlockAtEvent = useCallback((e) => {
    if (insertGuard.current) return
    if (inkBlockingText) return
    if (e.pointerType === 'pen') return
    if (e.target.closest('textarea') || e.target.closest('button')) return

    const page = pageRef.current
    if (!page) return

    insertGuard.current = true
    window.setTimeout(() => { insertGuard.current = false }, 400)

    e.preventDefault()
    e.stopPropagation()
    const pageRect = page.getBoundingClientRect()
    const y = e.clientY - pageRect.top
    onAddBlock(Math.max(8, y))
  }, [inkBlockingText, onAddBlock])

  const handlePaperPointerUp = useCallback((e) => {
    if (!isDoubleTap(e, lastTap)) return
    addBlockAtEvent(e)
  }, [addBlockAtEvent])

  return (
    <div
      ref={pageRef}
      data-ink-anchor="notes-page"
      data-testid="notes-paper-page"
      onDoubleClick={addBlockAtEvent}
      onPointerUp={handlePaperPointerUp}
      className="journal-notes-page relative px-2"
      style={{ minHeight: `${pageHeight}px` }}
    >
      {blocks.map(block => (
        <JournalTextBlock
          key={block.id}
          block={block}
          onTextChange={onBlockTextChange}
          onRemove={onBlockRemove}
          inkBlockingText={inkBlockingText}
        />
      ))}
    </div>
  )
}

export default JournalNotesPane

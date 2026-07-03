import { useEffect, useRef } from 'react'

function JournalGapBlock({
  gap,
  onTextChange,
  onRemove,
  inkBlockingText = false,
}) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.max(gap.height, el.scrollHeight)
    el.style.height = `${next}px`
  }, [gap.text, gap.height])

  return (
    <div
      data-ink-anchor={`gap-${gap.id}`}
      data-testid={`journal-gap-${gap.id}`}
      className="journal-gap group relative ml-3 sm:ml-6 mr-1 my-1 pl-3"
    >
      <button
        type="button"
        onClick={() => onRemove(gap.id)}
        data-testid="journal-gap-delete"
        className="journal-block-delete absolute top-1 right-1"
        title="Remove"
        aria-label="Remove writing space"
      >
        ×
      </button>
      <textarea
        ref={textareaRef}
        value={gap.text}
        onChange={(e) => onTextChange(gap.id, e.target.value)}
        readOnly={inkBlockingText}
        data-testid="journal-gap-text"
        className={`journal-note-text journal-gap-text w-full resize-none bg-transparent py-1.5 pr-6 focus:outline-none ${
          inkBlockingText ? 'pointer-events-none' : ''
        }`}
        style={{ minHeight: `${gap.height}px` }}
        spellCheck
      />
    </div>
  )
}

export default JournalGapBlock

import { useEffect, useRef } from 'react'

function JournalTextBlock({
  block,
  onTextChange,
  onRemove,
  inkBlockingText = false,
}) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [block.text])

  return (
    <div
      className="group/block absolute left-4 right-4 z-10"
      style={{ top: block.y }}
      data-testid={`notes-block-${block.id}`}
    >
      <button
        type="button"
        onClick={() => onRemove(block.id)}
        data-testid="notes-block-delete"
        className="journal-block-delete absolute top-0.5 right-0"
        title="Remove"
        aria-label="Remove text box"
      >
        ×
      </button>
      <textarea
        ref={textareaRef}
        value={block.text}
        onChange={(e) => onTextChange(block.id, e.target.value)}
        autoFocus={!block.text}
        readOnly={inkBlockingText}
        data-testid="notes-block-text"
        className={`journal-note-text journal-block-text w-full resize-none bg-transparent py-1.5 pr-5 focus:outline-none ${
          inkBlockingText ? 'pointer-events-none' : ''
        }`}
        spellCheck
      />
    </div>
  )
}

export default JournalTextBlock

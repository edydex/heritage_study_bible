import { useEffect, useId, useRef, useState } from 'react'
import ReaderTextSize from './ReaderTextSize'

export default function ReaderSettings({ textSize, onTextSizeChange, children, lightHeader = false, open, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false)
  const expanded = open ?? localOpen
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const panelId = useId()
  const changeOpen = value => {
    setLocalOpen(value)
    onOpenChange?.(value)
  }

  useEffect(() => {
    if (!expanded) return
    const outside = event => {
      if (!rootRef.current?.contains(event.target)) changeOpen(false)
    }
    const dismiss = event => {
      event.preventDefault()
      event.stopImmediatePropagation()
      changeOpen(false)
      buttonRef.current?.focus()
    }
    const escape = event => { if (event.key === 'Escape') dismiss(event) }
    document.addEventListener('click', outside)
    window.addEventListener('keydown', escape, true)
    window.addEventListener('heritage:native-back', dismiss, true)
    return () => {
      document.removeEventListener('click', outside)
      window.removeEventListener('keydown', escape, true)
      window.removeEventListener('heritage:native-back', dismiss, true)
    }
  }, [expanded, onOpenChange])

  return (
    <div ref={rootRef} data-reader-settings className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        title="Text size settings"
        aria-label="Settings"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => changeOpen(!expanded)}
        className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors ${lightHeader ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700' : 'bg-white/10 hover:bg-white/20'}`}
      >
        <span className="text-sm sm:text-base" aria-hidden="true">⚙️</span>
      </button>
      {expanded && (
        <div id={panelId} role="region" aria-label="Reader settings" className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-3 px-4 w-64 max-w-[calc(100vw-2rem)] z-50">
          {onTextSizeChange && <ReaderTextSize size={textSize} onChange={onTextSizeChange} />}
          {children}
        </div>
      )}
    </div>
  )
}

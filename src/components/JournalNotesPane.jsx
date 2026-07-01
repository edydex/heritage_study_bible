import { useEffect, useRef, useState } from 'react'
import { JOURNAL_PANES } from '../hooks/useJournal'

const AUTOSAVE_DELAY_MS = 500

// Typed, autosaving journal entry for the current book/chapter. When ink tools
// are active the textarea is made non-interactive so pen strokes land on the
// InkLayer overlay above it instead of the caret.
function JournalNotesPane({ book, chapter, getEntry, saveEntry, drawingActive = false }) {
  const [text, setText] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const saveTimer = useRef(null)
  // True once the user edits the current chapter; blocks storage re-sync from
  // clobbering in-progress typing.
  const dirtyRef = useRef(false)

  // Reset the dirty flag whenever the chapter changes so the entry re-loads.
  useEffect(() => {
    dirtyRef.current = false
  }, [book, chapter])

  // Sync from stored entry while the field is untouched. This also handles the
  // async hydration of useJournal: getEntry's identity changes once storage
  // loads, re-running this effect and populating the text.
  useEffect(() => {
    if (dirtyRef.current) return
    const entry = getEntry(book, chapter, JOURNAL_PANES.notes)
    setText(entry?.text || '')
    setSavedAt(entry?.dateModified || null)
  }, [book, chapter, getEntry])

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const handleChange = (e) => {
    const value = e.target.value
    dirtyRef.current = true
    setText(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveEntry(book, chapter, value, JOURNAL_PANES.notes)
      setSavedAt(new Date().toISOString())
    }, AUTOSAVE_DELAY_MS)
  }

  const savedLabel = savedAt
    ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Not saved yet'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-primary dark:text-blue-400 heading-text">
          {book} {chapter} — Notes
        </h3>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{savedLabel}</span>
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Write your reflections, prayers, and notes here..."
        readOnly={drawingActive}
        className={`flex-1 w-full resize-none bg-transparent px-4 py-3 text-gray-800 dark:text-gray-200 leading-relaxed focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 ${
          drawingActive ? 'pointer-events-none select-none' : ''
        }`}
        style={{ fontSize: '17px' }}
        spellCheck={true}
      />
    </div>
  )
}

export default JournalNotesPane

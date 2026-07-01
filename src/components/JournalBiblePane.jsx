import { useEffect, useRef, useState } from 'react'
import BibleChapter from './BibleChapter'
import { BIBLE_SPACE_INCREMENT, DEFAULT_BIBLE_EXTRA_SPACE, JOURNAL_PANES } from '../hooks/useJournal'

const AUTOSAVE_DELAY_MS = 500

// Bible text plus an expandable margin below for typed notes. Pen ink is handled
// by the parent InkLayer over the whole scroll container.
function JournalBiblePane({
  book,
  chapter,
  chapterData,
  loading,
  loadError,
  translationId,
  onVerseClick,
  getVerseHighlights,
  highlightMode = false,
  getEntry,
  saveEntry,
  addBibleSpace,
  drawingActive = false,
}) {
  const [text, setText] = useState('')
  const [extraSpace, setExtraSpace] = useState(DEFAULT_BIBLE_EXTRA_SPACE)
  const saveTimer = useRef(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = false
  }, [book, chapter])

  useEffect(() => {
    if (dirtyRef.current) return
    const entry = getEntry(book, chapter, JOURNAL_PANES.bible)
    setText(entry?.text || '')
    setExtraSpace(entry?.extraSpace ?? DEFAULT_BIBLE_EXTRA_SPACE)
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
      saveEntry(book, chapter, value, JOURNAL_PANES.bible)
    }, AUTOSAVE_DELAY_MS)
  }

  const handleAddSpace = () => {
    addBibleSpace(book, chapter)
    setExtraSpace(prev => prev + BIBLE_SPACE_INCREMENT)
  }

  return (
    <div className="px-2 sm:px-4 py-3">
      <h2 className="text-center text-lg font-bold text-primary dark:text-blue-400 mb-3 heading-text">
        {book} {chapter}
      </h2>

      {loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 animate-pulse">Loading…</div>
      )}
      {loadError && (
        <div className="text-center py-8 text-sm text-red-600 dark:text-red-400">{loadError}</div>
      )}
      {!loading && chapterData && (
        <BibleChapter
          chapter={chapterData}
          bookName={book}
          hasCommentary={() => false}
          onVerseClick={onVerseClick}
          isBookmarked={() => false}
          onBookmarkToggle={() => {}}
          getVerseHighlights={getVerseHighlights}
          highlightMode={highlightMode}
          textSize={18}
        />
      )}
      {!loading && !chapterData && !loadError && (
        <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
          No text for {book} {chapter} in {translationId}.
        </div>
      )}

      {/* Expandable margin for bible-side notes (keyboard + pen via InkLayer) */}
      <div className="mt-6 border-t border-dashed border-gray-300 dark:border-gray-600 pt-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Margin notes
          </span>
          <button
            type="button"
            onClick={handleAddSpace}
            data-testid="add-bible-space"
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Add more writing space below the chapter"
          >
            + Add space
          </button>
        </div>
        <textarea
          value={text}
          onChange={handleChange}
          placeholder="Write in the margin — type here or draw with Apple Pencil…"
          readOnly={drawingActive}
          data-testid="bible-margin-notes"
          className={`w-full resize-none bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-3 text-gray-800 dark:text-gray-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-400 dark:placeholder:text-gray-600 ${
            drawingActive ? 'pointer-events-none select-none' : ''
          }`}
          style={{ minHeight: `${extraSpace}px`, fontSize: '17px' }}
          spellCheck={true}
        />
      </div>
    </div>
  )
}

export default JournalBiblePane

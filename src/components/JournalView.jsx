import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import JournalBiblePane from './JournalBiblePane'
import InkLayer, { INK_TOOLS } from './InkLayer'
import JournalNotesPane from './JournalNotesPane'
import { bibleBooks } from '../data/bible-books.js'
import { bookToSlug, slugToBook } from '../utils/bookSlug'
import { translations, DEFAULT_TRANSLATION, loadTranslation } from '../data/translations'
import { withPsalmSuperscriptionVerse } from '../utils/psalmSuperscriptions'
import { setStoredValue, STORAGE_KEYS } from '../services/persistentStorage'
import { useHighlights, HIGHLIGHT_COLORS } from '../hooks/useHighlights'
import { useJournal } from '../hooks/useJournal'
import { useInk } from '../hooks/useInk'

const PEN_COLORS = [
  { id: 'black', value: '#111827' },
  { id: 'blue', value: '#1d4ed8' },
  { id: 'red', value: '#dc2626' },
  { id: 'green', value: '#15803d' },
]

const PEN_SIZES = [
  { id: 'S', value: 3 },
  { id: 'M', value: 5 },
  { id: 'L', value: 9 },
]

// Compute the previous/next chapter across book boundaries.
function stepChapter(bookName, chapter, dir) {
  const idx = bibleBooks.findIndex(b => b.name === bookName)
  if (idx === -1) return null
  const book = bibleBooks[idx]
  const target = chapter + dir
  if (target >= 1 && target <= book.chapters) {
    return { book: bookName, chapter: target }
  }
  if (dir > 0 && idx < bibleBooks.length - 1) {
    return { book: bibleBooks[idx + 1].name, chapter: 1 }
  }
  if (dir < 0 && idx > 0) {
    const prev = bibleBooks[idx - 1]
    return { book: prev.name, chapter: prev.chapters }
  }
  return null
}

function JournalView() {
  const { bookSlug, chapterNum } = useParams()
  const navigate = useNavigate()

  const book = slugToBook(bookSlug)
  const chapter = parseInt(chapterNum, 10) || 1

  const [translationId, setTranslationId] = useState(
    () => localStorage.getItem(STORAGE_KEYS.translation) || DEFAULT_TRANSLATION
  )
  const [bibleData, setBibleData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [tool, setTool] = useState(INK_TOOLS.select)
  const [penColor, setPenColor] = useState(PEN_COLORS[1].value)
  const [penSize, setPenSize] = useState(PEN_SIZES[1].value)
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].id)
  const [undoStack, setUndoStack] = useState([])

  const { getHighlight, setHighlight } = useHighlights()
  const { getEntry, saveEntry, addBibleSpace } = useJournal()
  const { getStrokes, addStroke, eraseStroke, clearPane } = useInk()

  const leftScrollRef = useRef(null)
  const rightScrollRef = useRef(null)

  // Redirect malformed URLs back to the reader.
  useEffect(() => {
    if (!book) navigate(`/genesis/1`, { replace: true })
  }, [book, navigate])

  // Sync translation to storage (shared with the reader).
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.translation, translationId).catch(() => {})
  }, [translationId])

  // Load the selected translation.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError('')
      setBibleData(null)
      try {
        const data = await loadTranslation(translationId)
        if (!cancelled) setBibleData(data)
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || 'Failed to load translation')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [translationId])

  const chapterData = useMemo(() => {
    const bookData = bibleData?.books?.find(b => b.name === book)
    const raw = bookData?.chapters?.find(c => c.number === chapter)
    return withPsalmSuperscriptionVerse(raw, book, translationId)
  }, [bibleData, book, chapter, translationId])

  const bookMeta = useMemo(() => bibleBooks.find(b => b.name === book), [book])

  const go = (target) => {
    if (target) navigate(`/journal/${bookToSlug(target.book)}/${target.chapter}`)
  }

  const handleVerseClick = (ch, verse) => {
    if (tool === INK_TOOLS.highlight) {
      setHighlight(book, ch, verse, highlightColor)
    }
  }

  const commitStroke = (pane) => (stroke) => {
    addStroke(book, chapter, pane, stroke)
    setUndoStack(prev => [...prev, { pane, strokeId: stroke.id }])
  }

  const handleErase = (pane) => (strokeId) => {
    eraseStroke(book, chapter, pane, strokeId)
    setUndoStack(prev => prev.filter(u => u.strokeId !== strokeId))
  }

  const undo = () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      eraseStroke(book, chapter, last.pane, last.strokeId)
      return prev.slice(0, -1)
    })
  }

  const clearInk = () => {
    clearPane(book, chapter, 'bible')
    clearPane(book, chapter, 'notes')
    setUndoStack([])
  }

  // Reset undo history when navigating to a different chapter.
  useEffect(() => { setUndoStack([]) }, [book, chapter])

  const drawingActive = tool === INK_TOOLS.draw || tool === INK_TOOLS.erase
  // touch-none while drawing so finger draws instead of scrolling the pane
  const paneScrollClass = `relative flex-1 overflow-y-auto select-none ${drawingActive ? 'touch-none' : ''}`

  const toolButton = (id, label, title) => (
    <button
      onClick={() => setTool(id)}
      title={title}
      className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        tool === id
          ? 'bg-primary text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-black text-gray-900 dark:text-gray-100">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-2 sm:px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button
          onClick={() => navigate(`/${bookToSlug(book || 'genesis')}/${chapter}`)}
          className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Back to reader"
        >
          ← Reader
        </button>

        {/* Chapter navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => go(stepChapter(book, chapter, -1))}
            className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Previous chapter"
          >‹</button>
          <select
            value={book || ''}
            onChange={(e) => navigate(`/journal/${bookToSlug(e.target.value)}/1`)}
            className="bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm max-w-[9rem]"
          >
            {bibleBooks.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
          <select
            value={chapter}
            onChange={(e) => navigate(`/journal/${bookToSlug(book)}/${e.target.value}`)}
            className="bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm no-spinners"
          >
            {Array.from({ length: bookMeta?.chapters || 1 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button
            onClick={() => go(stepChapter(book, chapter, 1))}
            className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Next chapter"
          >›</button>
        </div>

        {/* Translation */}
        <select
          value={translationId}
          onChange={(e) => setTranslationId(e.target.value)}
          className="bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm"
          title="Translation"
        >
          {translations.map(t => <option key={t.id} value={t.id}>{t.abbr}</option>)}
        </select>

        <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-700" />

        {/* Tools */}
        <div className="flex items-center gap-1.5">
          {toolButton(INK_TOOLS.select, '✋', 'Read / scroll (finger scrolls)')}
          {toolButton(INK_TOOLS.highlight, '🖍', 'Highlight verses')}
          {toolButton(INK_TOOLS.draw, '✒️', 'Draw (pen, mouse, or finger)')}
          {toolButton(INK_TOOLS.erase, '🧽', 'Erase ink')}
        </div>

        {/* Contextual controls */}
        {tool === INK_TOOLS.highlight && (
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setHighlightColor(c.id)}
                title={c.label}
                className={`w-6 h-6 rounded-full ${c.swatch} ${
                  highlightColor === c.id ? 'ring-2 ring-offset-1 ring-primary dark:ring-offset-gray-900' : ''
                }`}
              />
            ))}
          </div>
        )}
        {tool === INK_TOOLS.draw && (
          <div className="flex items-center gap-1.5">
            {PEN_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setPenColor(c.value)}
                title={c.id}
                style={{ backgroundColor: c.value }}
                className={`w-6 h-6 rounded-full ${
                  penColor === c.value ? 'ring-2 ring-offset-1 ring-primary dark:ring-offset-gray-900' : ''
                }`}
              />
            ))}
            <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-700" />
            {PEN_SIZES.map(s => (
              <button
                key={s.id}
                onClick={() => setPenSize(s.value)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                  penSize === s.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >{s.id}</button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
            title="Undo last stroke"
          >↶ Undo</button>
          <button
            onClick={clearInk}
            className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Clear all ink on this chapter"
          >Clear ink</button>
        </div>
      </div>

      {/* Split panes */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Bible pane (60%) */}
        <div
          ref={leftScrollRef}
          className={`${paneScrollClass} md:w-3/5 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-gray-300 dark:border-gray-700`}
        >
          <InkLayer
            scrollContainerRef={leftScrollRef}
            strokes={getStrokes(book, chapter, 'bible')}
            tool={tool}
            color={penColor}
            size={penSize}
            onCommitStroke={commitStroke('bible')}
            onEraseStroke={handleErase('bible')}
          />
          <JournalBiblePane
            book={book}
            chapter={chapter}
            chapterData={chapterData}
            loading={loading}
            loadError={loadError}
            translationId={translationId}
            onVerseClick={handleVerseClick}
            getHighlight={(ch, v) => getHighlight(book, ch, v)?.color}
            getEntry={getEntry}
            saveEntry={saveEntry}
            addBibleSpace={addBibleSpace}
            drawingActive={drawingActive}
          />
        </div>

        {/* Notes pane (40%) */}
        <div
          ref={rightScrollRef}
          className="relative md:w-2/5 h-1/2 md:h-full overflow-hidden select-none bg-white dark:bg-gray-900"
        >
          <InkLayer
            scrollContainerRef={rightScrollRef}
            strokes={getStrokes(book, chapter, 'notes')}
            tool={tool}
            color={penColor}
            size={penSize}
            onCommitStroke={commitStroke('notes')}
            onEraseStroke={handleErase('notes')}
          />
          <JournalNotesPane
            book={book}
            chapter={chapter}
            getEntry={getEntry}
            saveEntry={saveEntry}
            drawingActive={drawingActive}
          />
        </div>
      </div>
    </div>
  )
}

export default JournalView

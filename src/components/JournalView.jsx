import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import JournalBiblePane from './JournalBiblePane'
import InkLayer, { INK_TOOLS } from './InkLayer'
import JournalNotesPane from './JournalNotesPane'
import JournalTipsBanner from './JournalTipsBanner'
import ConfirmDialog from './ConfirmDialog'
import { bibleBooks } from '../data/bible-books.js'
import { bookToSlug, slugToBook } from '../utils/bookSlug'
import { translations, DEFAULT_TRANSLATION, loadTranslation } from '../data/translations'
import { withPsalmSuperscriptionVerse } from '../utils/psalmSuperscriptions'
import { setStoredValue, getStoredValue, STORAGE_KEYS } from '../services/persistentStorage'
import {
  pointsToHighlightRanges,
  caretFromPoint,
  rangeFromCarets,
  setLiveSelectionRange,
  clearLiveSelection,
  getCanonicalOffsetFromPoint,
} from '../utils/verseHighlightText'
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

const GAP_AUTOSAVE_MS = 500

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

  const [tool, setTool] = useState(INK_TOOLS.scroll)
  const [penColor, setPenColor] = useState(PEN_COLORS[1].value)
  const [penSize, setPenSize] = useState(PEN_SIZES[1].value)
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].id)
  const [undoStack, setUndoStack] = useState([])
  const [showJournalTips, setShowJournalTips] = useState(false)
  const [showClearInkConfirm, setShowClearInkConfirm] = useState(false)

  const { getVerseHighlights, addHighlightRanges, removeHighlight, findHighlightAt } = useHighlights()
  const {
    getBibleGaps,
    addGap,
    updateGap,
    removeGap,
    getNotesBlocks,
    getNotesPageHeight,
    addNotesBlock,
    updateNotesBlock,
    removeNotesBlock,
    addNotesPageHeight,
  } = useJournal()
  const { getStrokes, hasStrokesOnAnchor, addStroke, eraseStroke, clearPane } = useInk()

  const leftScrollRef = useRef(null)
  const rightScrollRef = useRef(null)
  const gapSaveTimers = useRef({})
  const scrollNotesToY = useRef(null)
  const syncingScroll = useRef(false)

  // Keep Bible and notes panes at the same relative scroll position.
  useEffect(() => {
    const left = leftScrollRef.current
    const right = rightScrollRef.current
    if (!left || !right) return

    const scrollRatio = (el) => {
      const max = el.scrollHeight - el.clientHeight
      return max > 0 ? el.scrollTop / max : 0
    }

    const applyRatio = (source, target) => {
      const max = target.scrollHeight - target.clientHeight
      if (max <= 0) return
      const next = scrollRatio(source) * max
      if (Math.abs(target.scrollTop - next) < 1) return
      syncingScroll.current = true
      target.scrollTop = next
      requestAnimationFrame(() => { syncingScroll.current = false })
    }

    const onLeftScroll = () => {
      if (syncingScroll.current) return
      applyRatio(left, right)
    }
    const onRightScroll = () => {
      if (syncingScroll.current) return
      applyRatio(right, left)
    }

    left.addEventListener('scroll', onLeftScroll, { passive: true })
    right.addEventListener('scroll', onRightScroll, { passive: true })
    return () => {
      left.removeEventListener('scroll', onLeftScroll)
      right.removeEventListener('scroll', onRightScroll)
    }
  }, [book, chapter, loading])

  useEffect(() => {
    if (!book) navigate(`/genesis/1`, { replace: true })
  }, [book, navigate])

  useEffect(() => {
    let cancelled = false
    getStoredValue(STORAGE_KEYS.journalTipsDismissed).then((value) => {
      if (!cancelled && value !== '1') setShowJournalTips(true)
    })
    return () => { cancelled = true }
  }, [])

  const dismissJournalTips = () => {
    setShowJournalTips(false)
    setStoredValue(STORAGE_KEYS.journalTipsDismissed, '1').catch(() => {})
  }

  useEffect(() => {
    setStoredValue(STORAGE_KEYS.translation, translationId).catch(() => {})
  }, [translationId])

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
  const gaps = useMemo(() => getBibleGaps(book, chapter), [getBibleGaps, book, chapter])
  const notesBlocks = useMemo(() => getNotesBlocks(book, chapter), [getNotesBlocks, book, chapter])
  const notesPageHeight = useMemo(() => getNotesPageHeight(book, chapter), [getNotesPageHeight, book, chapter])

  useEffect(() => {
    if (scrollNotesToY.current == null) return
    const target = scrollNotesToY.current
    scrollNotesToY.current = null
    const el = rightScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: Math.max(0, target - 16), behavior: 'smooth' })
    })
  }, [notesPageHeight])

  const handleMorePaper = useCallback(() => {
    scrollNotesToY.current = notesPageHeight
    addNotesPageHeight(book, chapter)
  }, [notesPageHeight, book, chapter, addNotesPageHeight])

  const go = (target) => {
    if (target) navigate(`/journal/${bookToSlug(target.book)}/${target.chapter}`)
  }

  const highlightActive = tool === INK_TOOLS.highlight
  const penToolActive = tool === INK_TOOLS.pen
  const inkBlockingText = penToolActive || tool === INK_TOOLS.erase
  // Highlight needs touch-none so finger/pen drag selects instead of scrolls.
  const bibleTouchLocked = penToolActive || tool === INK_TOOLS.erase || highlightActive
  const notesTouchLocked = penToolActive || tool === INK_TOOLS.erase

  const paneScrollClass = `relative flex-1 overflow-y-auto ${
    highlightActive ? 'select-text' : ''
  } ${bibleTouchLocked ? 'touch-none' : ''}`

  const hasInkOnGap = useCallback((gapId) => {
    return hasStrokesOnAnchor(book, chapter, 'bible', `gap-${gapId}`)
  }, [hasStrokesOnAnchor, book, chapter])

  const tryRemoveEmptyGap = useCallback((gapId, text) => {
    if ((text ?? '').trim()) return
    if (hasInkOnGap(gapId)) return
    removeGap(book, chapter, gapId)
  }, [book, chapter, hasInkOnGap, removeGap])

  const handleGapTextChange = useCallback((gapId, text) => {
    updateGap(book, chapter, gapId, { text })
    if (gapSaveTimers.current[gapId]) clearTimeout(gapSaveTimers.current[gapId])
    gapSaveTimers.current[gapId] = setTimeout(() => {
      tryRemoveEmptyGap(gapId, text)
    }, GAP_AUTOSAVE_MS)
  }, [book, chapter, updateGap, tryRemoveEmptyGap])

  const handleGapRemove = useCallback((gapId) => {
    removeGap(book, chapter, gapId)
  }, [book, chapter, removeGap])

  // Custom highlight drag for mouse, finger, and Apple Pencil.
  useEffect(() => {
    if (!highlightActive) return
    const el = leftScrollRef.current
    if (!el) return

    let dragging = false
    let startXY = null
    let endXY = null
    let pointerId = null

    const isIgnorableTarget = (target) =>
      target.closest?.('button, a, input, textarea, [data-testid^="gap-zone"], .journal-gap-zone')

    const updateLiveSelection = () => {
      if (!startXY || !endXY) return
      const startCaret = caretFromPoint(document, startXY.x, startXY.y)
      const endCaret = caretFromPoint(document, endXY.x, endXY.y)
      const range = rangeFromCarets(document, startCaret, endCaret)
      if (range) setLiveSelectionRange(range)
    }

    const finish = (e) => {
      if (!dragging) return
      if (pointerId != null && e.pointerId !== pointerId) return
      dragging = false
      try { el.releasePointerCapture?.(pointerId) } catch {}
      pointerId = null

      const ranges = pointsToHighlightRanges(el, chapter, startXY, endXY)
      startXY = null
      endXY = null
      clearLiveSelection()
      if (!ranges.length) return
      addHighlightRanges(
        book,
        chapter,
        ranges.map(r => ({ ...r, color: highlightColor }))
      )
    }

    const handleDown = (e) => {
      if (isIgnorableTarget(e.target)) return
      if (!e.target.closest?.('[data-verse-text]')) return
      e.preventDefault()
      dragging = true
      pointerId = e.pointerId
      startXY = { x: e.clientX, y: e.clientY }
      endXY = startXY
      try { el.setPointerCapture?.(e.pointerId) } catch {}
    }

    const handleMove = (e) => {
      if (!dragging) return
      if (pointerId != null && e.pointerId !== pointerId) return
      e.preventDefault()
      endXY = { x: e.clientX, y: e.clientY }
      updateLiveSelection()
    }

    el.addEventListener('pointerdown', handleDown, { passive: false })
    el.addEventListener('pointermove', handleMove, { passive: false })
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
    return () => {
      el.removeEventListener('pointerdown', handleDown)
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
      clearLiveSelection()
    }
  }, [highlightActive, book, chapter, highlightColor, addHighlightRanges])

  useEffect(() => {
    if (tool !== INK_TOOLS.erase) return
    const el = leftScrollRef.current
    if (!el) return

    const eraseHighlight = (e) => {
      const verseText = e.target.closest?.('[data-verse-text]')
      if (!verseText) return
      const offset = getCanonicalOffsetFromPoint(verseText, e.clientX, e.clientY)
      if (offset == null) return
      const verse = Number(verseText.dataset.verse)
      const hit = findHighlightAt(book, chapter, verse, offset)
      if (hit) {
        removeHighlight(hit.id)
        e.preventDefault()
      }
    }

    el.addEventListener('pointerdown', eraseHighlight)
    return () => el.removeEventListener('pointerdown', eraseHighlight)
  }, [tool, book, chapter, findHighlightAt, removeHighlight])

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
    setShowClearInkConfirm(false)
  }

  useEffect(() => { setUndoStack([]) }, [book, chapter])

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
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-2 sm:px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button
          onClick={() => navigate(`/${bookToSlug(book || 'genesis')}/${chapter}`)}
          className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Back to reader"
        >
          ← Reader
        </button>

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

        <select
          value={translationId}
          onChange={(e) => setTranslationId(e.target.value)}
          className="bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm"
          title="Translation"
        >
          {translations.map(t => <option key={t.id} value={t.id}>{t.abbr}</option>)}
        </select>

        <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-700" />

        <div className="flex items-center gap-1.5">
          {toolButton(INK_TOOLS.scroll, '✋', 'Scroll (finger scrolls; Apple Pencil always draws)')}
          {toolButton(INK_TOOLS.highlight, '🖍', 'Highlight text (drag with mouse, finger, or pencil)')}
          {toolButton(INK_TOOLS.pen, '✒️', 'Pen (finger/mouse draw)')}
          {toolButton(INK_TOOLS.erase, '🧽', 'Erase ink and highlights')}
        </div>

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
        {(tool === INK_TOOLS.pen || tool === INK_TOOLS.scroll) && (
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
          <span
            className="hidden md:inline text-[11px] text-gray-400 dark:text-gray-500 mr-1 select-none"
            title="Double-tap between verses or on the notes page to type. Hover a note and tap × to remove."
          >
            Double-tap to type
          </span>
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
            title="Undo last stroke"
          >↶ Undo</button>
          <button
            onClick={() => setShowClearInkConfirm(true)}
            className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Clear all ink on this chapter"
          >Clear ink</button>
        </div>
      </div>

      <ConfirmDialog
        open={showClearInkConfirm}
        title="Clear all ink?"
        message="This removes every pen stroke on this chapter from both panes. It cannot be undone."
        confirmLabel="Clear ink"
        cancelLabel="Cancel"
        destructive
        onConfirm={clearInk}
        onCancel={() => setShowClearInkConfirm(false)}
      />

      {showJournalTips && <JournalTipsBanner onDismiss={dismissJournalTips} />}

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
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
            getVerseHighlights={(ch, v) => getVerseHighlights(book, ch, v)}
            highlightMode={highlightActive}
            gaps={gaps}
            onGapTextChange={handleGapTextChange}
            onGapRemove={handleGapRemove}
            onInsertGap={(afterVerse) => addGap(book, chapter, afterVerse)}
            inkBlockingText={inkBlockingText}
          />
        </div>

        <div className="relative md:w-2/5 h-1/2 md:h-full flex flex-col min-h-0 bg-white dark:bg-gray-900">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 heading-text">
              Notes
            </h3>
            <button
              type="button"
              onClick={handleMorePaper}
              data-testid="add-notes-space"
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Extend the page"
            >
              More paper
            </button>
          </div>
          <div
            ref={rightScrollRef}
            className={`relative flex-1 min-h-0 overflow-y-auto ${
              notesTouchLocked ? 'touch-none' : ''
            }`}
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
              blocks={notesBlocks}
              pageHeight={notesPageHeight}
              onBlockTextChange={(id, text) => updateNotesBlock(book, chapter, id, { text })}
              onBlockRemove={(id) => removeNotesBlock(book, chapter, id)}
              onAddBlock={(y) => addNotesBlock(book, chapter, y, '')}
              inkBlockingText={inkBlockingText}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default JournalView

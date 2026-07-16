import { useEffect, useMemo, useState } from 'react'
import CompareModal from './CompareModal'
import { getVerseTextWithPsalmSuperscription } from '../utils/psalmSuperscriptions'
import { formatVersesForCopy, writeTextToClipboard } from '../utils/verseSelection'

function ActionButton({ icon, label, onClick, disabled = false, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-lg px-1 py-1.5 flex flex-col items-center justify-center text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
          : 'text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700'
      }`}
    >
      <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
      <span className="mt-1">{label}</span>
    </button>
  )
}

function VerseSelectionBar({
  bookName,
  selectedVerses,
  translationId,
  bibleData,
  parallelMode = false,
  parallelTranslationId = null,
  parallelBibleData = null,
  notes = [],
  allBookmarked = false,
  onBookmark,
  onSaveNotes,
  onShowToast,
  onCancel,
  onDone,
}) {
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const activeVerses = Array.isArray(selectedVerses) ? selectedVerses : []
  const primaryVerse = activeVerses[activeVerses.length - 1] || null
  const selectionCount = activeVerses.length

  const existingSingleNote = useMemo(() => {
    if (selectionCount !== 1 || !primaryVerse) return ''
    return notes.find(note =>
      (note.book || bookName) === (primaryVerse.book || bookName)
      && note.chapter === primaryVerse.chapter
      && note.verse === primaryVerse.verse
    )?.text || ''
  }, [bookName, notes, primaryVerse, selectionCount])

  useEffect(() => {
    setNoteText(existingSingleNote)
  }, [existingSingleNote])

  useEffect(() => {
    const handleEscape = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (showCompareModal) setShowCompareModal(false)
      else if (showNotesModal) setShowNotesModal(false)
      else onCancel?.()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel, showCompareModal, showNotesModal])

  useEffect(() => {
    if (!showCompareModal && !showNotesModal) return undefined
    const handleNativeBack = event => {
      event.preventDefault?.()
      event.stopImmediatePropagation?.()
      if (showCompareModal) setShowCompareModal(false)
      else setShowNotesModal(false)
    }
    window.addEventListener('heritage:native-back', handleNativeBack, true)
    return () => window.removeEventListener('heritage:native-back', handleNativeBack, true)
  }, [showCompareModal, showNotesModal])

  const handleCopy = async () => {
    if (selectionCount === 0) return
    try {
      const text = formatVersesForCopy({
        verses: activeVerses,
        fallbackBookName: bookName,
        primaryTranslationId: translationId,
        primaryBibleData: bibleData,
        secondaryTranslationId: parallelTranslationId,
        secondaryBibleData: parallelBibleData,
        includeParallel: Boolean(parallelMode && parallelTranslationId && parallelBibleData),
        verseTextResolver: getVerseTextWithPsalmSuperscription,
      })
      await writeTextToClipboard(text)
      onShowToast?.(`Copied ${selectionCount} verse${selectionCount === 1 ? '' : 's'}`)
    } catch {
      onShowToast?.('Failed to copy')
    }
  }

  const handleSaveNote = () => {
    if (selectionCount === 0) return
    onSaveNotes?.(activeVerses, noteText)
    setShowNotesModal(false)
  }

  const primaryVerseText = primaryVerse
    ? (
        primaryVerse.text
        || getVerseTextWithPsalmSuperscription(
          bibleData,
          primaryVerse.book || bookName,
          primaryVerse.chapter,
          primaryVerse.verse,
          translationId
        )
        || ''
      )
    : ''

  return (
    <>
      <section
        className="verse-selection-bar fixed inset-x-0 bottom-0 z-50 border-t border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 shadow-[0_-8px_24px_rgba(0,0,0,0.14)] safe-area-bottom"
        role="region"
        aria-label="Verse selection actions"
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-10 px-2 text-sm font-semibold text-gray-600 dark:text-gray-300 rounded-lg active:bg-gray-100 dark:active:bg-gray-800"
            >
              Cancel
            </button>
            <div className="min-w-0 flex-1 text-center" aria-live="polite" aria-atomic="true">
              <p className="text-sm font-bold text-primary dark:text-blue-300">
                {selectionCount} verse{selectionCount === 1 ? '' : 's'} selected
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Tap a verse to add or remove it</p>
            </div>
            <button
              type="button"
              onClick={onDone}
              disabled={selectionCount === 0}
              className="min-h-10 px-3 text-sm font-bold text-white bg-primary rounded-lg active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-4 px-2 py-1">
            <ActionButton icon="📋" label="Copy" onClick={handleCopy} disabled={selectionCount === 0} />
            <ActionButton icon="🔄" label="Compare" onClick={() => setShowCompareModal(true)} disabled={selectionCount === 0} />
            <ActionButton
              icon={allBookmarked ? '★' : '☆'}
              label={allBookmarked ? 'Unbookmark' : 'Bookmark'}
              onClick={onBookmark}
              disabled={selectionCount === 0}
              active={allBookmarked}
            />
            <ActionButton icon="📝" label="Notes" onClick={() => setShowNotesModal(true)} disabled={selectionCount === 0} />
          </div>
        </div>
      </section>

      {showCompareModal && primaryVerse && (
        <CompareModal
          bookName={primaryVerse.book || bookName}
          chapter={primaryVerse.chapter}
          verse={primaryVerse.verse}
          verseText={primaryVerseText}
          verses={activeVerses}
          translationId={translationId}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {showNotesModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNotesModal(false)} />
          <div
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="selection-note-title"
          >
            <button
              type="button"
              onClick={() => setShowNotesModal(false)}
              className="absolute top-3 right-3 min-h-10 min-w-10 text-gray-500 dark:text-gray-300 rounded-lg active:bg-gray-100 dark:active:bg-gray-700"
              aria-label="Close notes"
            >
              ✕
            </button>
            <h3 id="selection-note-title" className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 pr-10">
              {selectionCount === 1
                ? `Note for ${primaryVerse?.book || bookName} ${primaryVerse?.chapter}:${primaryVerse?.verse}`
                : `Note for ${selectionCount} selected verses`}
            </h3>
            <textarea
              value={noteText}
              onChange={event => setNoteText(event.target.value)}
              autoComplete="on"
              autoCorrect="on"
              spellCheck={true}
              autoFocus
              placeholder="Write your notes here..."
              className="w-full h-32 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
              {selectionCount === 1
                ? 'This note is saved with the selected verse.'
                : 'This note will be applied to every selected verse.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                className="flex-1 min-h-11 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="flex-1 min-h-11 px-4 py-2 bg-primary text-white rounded-lg"
              >
                {noteText.trim() ? 'Save Note' : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default VerseSelectionBar

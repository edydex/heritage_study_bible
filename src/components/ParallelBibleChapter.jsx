import { useEffect, useMemo, useRef, useCallback } from 'react'
import VerseText from './VerseText'
import { getVerseLayout } from '../utils/verseLayout'
import InlineVerseNotes, { getInlineNotesAfterVerse } from './InlineVerseNotes'

function MissingVerse({ translationId }) {
  return (
    <div className="text-sm text-gray-400 dark:text-gray-500 italic">
      Verse not present in {translationId}.
    </div>
  )
}

function ParallelBibleChapter({
  primaryChapter,
  secondaryChapter,
  primaryTranslationId,
  secondaryTranslationId,
  hasCommentary,
  onVerseClick,
  isBookmarked,
  isVerseHighlighted,
  getTextHighlights,
  notes = [],
  onBookmarkToggle,
  onVersePosition,
  isVerseSelected,
  textSize = 18,
  bookName,
  primaryVerseLayout = null,
  secondaryVerseLayout = null,
  selectionMode = false,
}) {
  const containerRef = useRef(null)
  const rowRefs = useRef({})

  const primaryVerseMap = useMemo(() => {
    return new Map((primaryChapter?.verses || []).map(verse => [verse.number, verse]))
  }, [primaryChapter])

  const secondaryVerseMap = useMemo(() => {
    return new Map((secondaryChapter?.verses || []).map(verse => [verse.number, verse]))
  }, [secondaryChapter])

  const verseNumbers = useMemo(() => {
    const keys = new Set([...primaryVerseMap.keys(), ...secondaryVerseMap.keys()])
    return [...keys].sort((a, b) => a - b)
  }, [primaryVerseMap, secondaryVerseMap])

  const verseStyle = { fontSize: `${textSize}px`, lineHeight: 1.6 }

  const setRowRef = useCallback((verseNumber, element) => {
    rowRefs.current[verseNumber] = element
  }, [])

  useEffect(() => {
    if (!onVersePosition || !containerRef.current) return

    const updatePositions = () => {
      const containerRect = containerRef.current.getBoundingClientRect()
      const scrollTop = window.scrollY || document.documentElement.scrollTop

      verseNumbers.forEach(verseNumber => {
        const rowEl = rowRefs.current[verseNumber]
        if (!rowEl) return

        const rect = rowEl.getBoundingClientRect()
        const verseKey = `${primaryChapter.number}-${verseNumber}`
        onVersePosition(verseKey, {
          top: rect.top + scrollTop - 80,
          height: rect.height,
          offsetFromContainer: rect.top - containerRect.top,
        })
      })
    }

    updatePositions()
    const handleScroll = () => requestAnimationFrame(updatePositions)
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', updatePositions, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updatePositions)
    }
  }, [onVersePosition, primaryChapter.number, verseNumbers])

  const handleVerseClick = (verseNumber) => {
    const primary = primaryVerseMap.get(verseNumber)
    const secondary = secondaryVerseMap.get(verseNumber)
    const verseText = primary?.text || secondary?.text || ''
    if (!globalThis.window?.getSelection?.()?.isCollapsed) return
    onVerseClick(primaryChapter.number, verseNumber, verseText)
  }

  const handleSelectionKeyDown = (event, verseNumber) => {
    if (!selectionMode || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    handleVerseClick(verseNumber)
  }

  return (
    <div
      className={`bg-white dark:bg-black rounded-none sm:rounded-xl shadow-none sm:shadow-md px-1 py-1 sm:p-6 md:p-8 ${selectionMode ? 'verse-selection-mode' : ''}`}
      ref={containerRef}
    >
      <div className="space-y-2">
        {verseNumbers.map((verseNumber) => {
          const primaryVerse = primaryVerseMap.get(verseNumber)
          const secondaryVerse = secondaryVerseMap.get(verseNumber)
          const isSuperscription = Boolean(primaryVerse?.isSuperscription || secondaryVerse?.isSuperscription)
          const hasComment = hasCommentary(primaryChapter.number, verseNumber)
          const bookmarked = isBookmarked(verseNumber)
          const selected = isVerseSelected?.(primaryChapter.number, verseNumber)
          const highlighted = isVerseHighlighted?.(primaryChapter.number, verseNumber)
          const primaryLayout = getVerseLayout(primaryVerseLayout, bookName, primaryChapter.number, verseNumber)
          const secondaryLayout = getVerseLayout(secondaryVerseLayout, bookName, primaryChapter.number, verseNumber)
          const startsParagraph = primaryLayout?.breakBefore || secondaryLayout?.breakBefore

          const primaryHighlights = getTextHighlights?.(primaryChapter.number, verseNumber, primaryTranslationId, primaryVerse?.text || '') || []
          const secondaryHighlights = getTextHighlights?.(primaryChapter.number, verseNumber, secondaryTranslationId, secondaryVerse?.text || '') || []
          const inlineNotes = selectionMode ? [] : [
            ...getInlineNotesAfterVerse(notes, bookName, primaryChapter.number, verseNumber, primaryTranslationId),
            ...getInlineNotesAfterVerse(notes, bookName, primaryChapter.number, verseNumber, secondaryTranslationId),
          ].filter((note, index, rows) => rows.findIndex(item => item.id === note.id) === index)
          const rowClassName = `relative rounded-lg border transition-all ${selectionMode ? 'verse-selection-target cursor-pointer' : ''} ${startsParagraph ? 'mt-4' : ''} ${
            selected
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
              : highlighted
                ? 'bg-yellow-100 dark:bg-yellow-900/35 border-yellow-300 dark:border-yellow-700'
              : isSuperscription
                ? 'bg-white dark:bg-black border-gray-200 dark:border-gray-800'
              : 'bg-gray-50 dark:bg-gray-700/60 border-gray-200 dark:border-gray-700'
          } ${
            hasComment
              ? 'ring-1 ring-amber-200/70 dark:ring-amber-700/40'
              : ''
          }`

          return (
            <div
              key={verseNumber}
              id={`verse-${primaryChapter.number}-${verseNumber}`}
              ref={(element) => setRowRef(verseNumber, element)}
              role={selectionMode ? 'button' : undefined}
              tabIndex={selectionMode ? 0 : undefined}
              aria-pressed={selectionMode ? Boolean(selected) : undefined}
              aria-label={selectionMode ? `${selected ? 'Remove' : 'Select'} ${bookName} ${primaryChapter.number}:${verseNumber}` : undefined}
              onClick={selectionMode ? () => handleVerseClick(verseNumber) : undefined}
              onKeyDown={event => handleSelectionKeyDown(event, verseNumber)}
              className={rowClassName}
            >
              {selectionMode && (
                <span
                  className={`absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                    selected
                      ? 'border-primary bg-primary text-white dark:border-blue-400 dark:bg-blue-500'
                      : 'border-gray-300 bg-white text-transparent dark:border-gray-600 dark:bg-gray-800'
                  }`}
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
              <div className="hidden md:grid md:grid-cols-2 md:gap-3 md:p-2">
                <div className="group flex items-start gap-2 rounded-md p-2 hover:bg-white/70 dark:hover:bg-gray-700 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(verseNumber)}>
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium min-w-[2rem] pt-0.5 select-none text-right">{verseNumber}</span>
                  <p
                    className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                    style={verseStyle}
                    data-verse-content={primaryVerse ? '' : undefined}
                    data-book={bookName}
                    data-chapter={primaryChapter.number}
                    data-verse={verseNumber}
                    data-translation={primaryTranslationId}
                  >
                    {primaryVerse ? <VerseText text={primaryVerse.text} layout={primaryLayout} highlights={primaryHighlights} /> : <MissingVerse translationId={primaryTranslationId} />}
                  </p>
                  {!selectionMode && <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || '')
                    }}
                    className={`p-1 rounded transition-all ${
                      bookmarked
                        ? 'text-secondary'
                        : 'text-gray-300 dark:text-gray-600 hover:text-secondary opacity-0 group-hover:opacity-100'
                    }`}
                    title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                  >
                    {bookmarked ? '★' : '☆'}
                  </button>}
                </div>

                <div className="flex items-start gap-2 rounded-md p-2 hover:bg-white/60 dark:hover:bg-gray-700 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(verseNumber)}>
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium min-w-[2rem] pt-0.5 select-none text-right">{verseNumber}</span>
                  <p
                    className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}
                    style={verseStyle}
                    data-verse-content={secondaryVerse ? '' : undefined}
                    data-book={bookName}
                    data-chapter={primaryChapter.number}
                    data-verse={verseNumber}
                    data-translation={secondaryTranslationId}
                  >
                    {secondaryVerse ? <VerseText text={secondaryVerse.text} layout={secondaryLayout} highlights={secondaryHighlights} /> : <MissingVerse translationId={secondaryTranslationId} />}
                  </p>
                </div>
              </div>

              <div className="md:hidden p-2 space-y-2">
                <div className="rounded-md bg-white dark:bg-black p-2 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(verseNumber)}>
                  <div className="text-[11px] uppercase tracking-wide text-primary dark:text-blue-400 font-semibold mb-1">{primaryTranslationId}</div>
                  <div className="flex items-start gap-2 group">
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium min-w-[1.3rem] pt-0.5 select-none text-right">{verseNumber}</span>
                    <p
                      className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                      style={verseStyle}
                      data-verse-content={primaryVerse ? '' : undefined}
                      data-book={bookName}
                      data-chapter={primaryChapter.number}
                      data-verse={verseNumber}
                      data-translation={primaryTranslationId}
                    >
                      {primaryVerse ? <VerseText text={primaryVerse.text} layout={primaryLayout} highlights={primaryHighlights} /> : <MissingVerse translationId={primaryTranslationId} />}
                    </p>
                    {!selectionMode && <button
                      onClick={(event) => {
                        event.stopPropagation()
                        onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || '')
                      }}
                      className={`p-1 rounded transition-all ${
                        bookmarked
                          ? 'text-secondary'
                          : 'text-gray-300 dark:text-gray-600 hover:text-secondary opacity-0 group-hover:opacity-100'
                      }`}
                      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                    >
                      {bookmarked ? '★' : '☆'}
                    </button>}
                  </div>
                </div>

                <div className="rounded-md bg-white/70 dark:bg-black p-2 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(verseNumber)}>
                  <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold mb-1">{secondaryTranslationId}</div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium min-w-[1.3rem] pt-0.5 select-none text-right">{verseNumber}</span>
                    <p
                      className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}
                      style={verseStyle}
                      data-verse-content={secondaryVerse ? '' : undefined}
                      data-book={bookName}
                      data-chapter={primaryChapter.number}
                      data-verse={verseNumber}
                      data-translation={secondaryTranslationId}
                    >
                      {secondaryVerse ? <VerseText text={secondaryVerse.text} layout={secondaryLayout} highlights={secondaryHighlights} /> : <MissingVerse translationId={secondaryTranslationId} />}
                    </p>
                  </div>
                </div>
              </div>
              <InlineVerseNotes notes={inlineNotes} />
            </div>
          )
        })}
      </div>
      <div className="reader-chapter-end-spacer" aria-hidden="true" />
    </div>
  )
}

export default ParallelBibleChapter

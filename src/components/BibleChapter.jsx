import { Fragment, useEffect, useRef, useCallback } from 'react'
import VerseText from './VerseText'
import { getVerseLayout } from '../utils/verseLayout'
import InlineVerseNotes, { getInlineNotesAfterVerse } from './InlineVerseNotes'

function BibleChapter({
  chapter,
  bookName = 'Revelation',
  hasCommentary,
  onVerseClick,
  isBookmarked,
  isVerseHighlighted,
  getTextHighlights,
  notes = [],
  translationId,
  onBookmarkToggle,
  onVersePosition,
  isVerseSelected,
  textSize = 18,
  verseStacking = false,
  verseLayout = null,
  selectionMode = false,
}) {
  const containerRef = useRef(null)
  const verseRefs = useRef({})

  // Dynamic text style from numeric textSize (px)
  const verseStyle = { fontSize: `${textSize}px`, lineHeight: 1.6 }

  // Track verse positions for sidebar alignment
  useEffect(() => {
    if (!onVersePosition || !containerRef.current) return

    const updatePositions = () => {
      const containerRect = containerRef.current.getBoundingClientRect()
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      
      chapter.verses.forEach(verse => {
        const verseEl = verseRefs.current[verse.number]
        if (verseEl) {
          const rect = verseEl.getBoundingClientRect()
          const verseKey = `${chapter.number}-${verse.number}`
          onVersePosition(verseKey, {
            top: rect.top + scrollTop - 80, // Account for header
            height: rect.height,
            offsetFromContainer: rect.top - containerRect.top
          })
        }
      })
    }

    // Update positions after render and on scroll
    updatePositions()
    const handleScroll = () => requestAnimationFrame(updatePositions)
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', updatePositions, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updatePositions)
    }
  }, [chapter, onVersePosition])

  const setVerseRef = useCallback((verseNumber, el) => {
    verseRefs.current[verseNumber] = el
  }, [])

  const handleSelectionKeyDown = (event, verse) => {
    if (!selectionMode || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onVerseClick(chapter.number, verse.number, verse.text)
  }

  const handleVerseActivation = verse => {
    if (!globalThis.window?.getSelection?.()?.isCollapsed) return
    onVerseClick(chapter.number, verse.number, verse.text)
  }

  return (
    <div
      className={`bg-white dark:bg-black rounded-none sm:rounded-xl shadow-none sm:shadow-md px-1 py-1 sm:p-6 md:p-8 ${selectionMode ? 'verse-selection-mode' : ''}`}
      ref={containerRef}
    >

      {/* Verses */}
      {!verseStacking ? (
        <div>
          {chapter.verses.map((verse) => {
            const hasComment = hasCommentary(chapter.number, verse.number)
            const bookmarked = isBookmarked(verse.number)
            const selected = isVerseSelected?.(chapter.number, verse.number)
            const highlighted = isVerseHighlighted?.(chapter.number, verse.number)
            const layout = getVerseLayout(verseLayout, bookName, chapter.number, verse.number)
            const textHighlights = getTextHighlights?.(chapter.number, verse.number, translationId, verse.text) || []
            const inlineNotes = selectionMode ? [] : getInlineNotesAfterVerse(
              notes, bookName, chapter.number, verse.number, translationId
            )

            return (
              <div
                key={verse.number}
                id={`verse-${chapter.number}-${verse.number}`}
                ref={(el) => setVerseRef(verse.number, el)}
                role={selectionMode ? 'button' : undefined}
                tabIndex={selectionMode ? 0 : undefined}
                aria-pressed={selectionMode ? Boolean(selected) : undefined}
                aria-label={selectionMode ? `${selected ? 'Remove' : 'Select'} ${bookName} ${chapter.number}:${verse.number}` : undefined}
                onClick={selectionMode ? () => handleVerseActivation(verse) : undefined}
                onKeyDown={event => handleSelectionKeyDown(event, verse)}
                className={`group flex flex-wrap items-start gap-0.5 sm:gap-2 py-0.5 sm:py-1 px-0 sm:px-2 rounded-lg transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 ${selectionMode ? 'verse-selection-target cursor-pointer' : ''} ${layout?.breakBefore ? 'mt-3 sm:mt-4' : ''} ${
                  verse.isSuperscription ? 'mb-2 border-l-2 border-gray-200 dark:border-gray-700 pl-2 italic' : ''
                } ${
                  hasComment ? 'hover:bg-amber-50 dark:hover:bg-amber-900/30 active:bg-amber-100 dark:active:bg-amber-900/50' : ''
                } ${
                  selected
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-700'
                    : highlighted ? 'bg-yellow-100 dark:bg-yellow-900/35 ring-1 ring-yellow-300 dark:ring-yellow-700' : ''
                }`}
              >
                {/* Verse Number */}
                <span className="text-[10px] sm:text-sm text-gray-400 dark:text-gray-500 font-medium min-w-[1rem] sm:min-w-[2rem] pt-1 sm:pt-0.5 select-none text-right">
                  {verse.number}
                </span>

                {selectionMode && (
                  <span
                    className={`mt-1 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs font-bold ${
                      selected
                        ? 'border-primary bg-primary text-white dark:border-blue-400 dark:bg-blue-500'
                        : 'border-gray-300 text-transparent dark:border-gray-600'
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}

                {/* Verse Text */}
                <p
                  className={`verse-text flex-1 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 ${
                    verse.isSuperscription
                      ? 'text-gray-500 dark:text-gray-400'
                      : hasComment ? 'text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'
                  }`}
                  style={verseStyle}
                  onClick={selectionMode ? undefined : () => handleVerseActivation(verse)}
                  data-verse-content
                  data-book={bookName}
                  data-chapter={chapter.number}
                  data-verse={verse.number}
                  data-translation={translationId}
                >
                  <VerseText text={verse.text} layout={layout} highlights={textHighlights} />
                </p>

                {/* Bookmark Button */}
                {!selectionMode && <button
                  data-testid={`verse-bookmark-${verse.number}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onBookmarkToggle(chapter.number, verse.number, verse.text)
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
                <InlineVerseNotes notes={inlineNotes} />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="verse-text px-0 sm:px-2" style={verseStyle}>
          {chapter.verses.map((verse, verseIndex) => {
            const hasComment = hasCommentary(chapter.number, verse.number)
            const bookmarked = isBookmarked(verse.number)
            const selected = isVerseSelected?.(chapter.number, verse.number)
            const highlighted = isVerseHighlighted?.(chapter.number, verse.number)
            const layout = getVerseLayout(verseLayout, bookName, chapter.number, verse.number)
            const textHighlights = getTextHighlights?.(chapter.number, verse.number, translationId, verse.text) || []
            const inlineNotes = selectionMode ? [] : getInlineNotesAfterVerse(
              notes, bookName, chapter.number, verse.number, translationId
            )

            return (
              <Fragment key={verse.number}>
                {layout?.breakBefore && verseIndex > 0 && <span className="block h-3 sm:h-4" aria-hidden="true" />}
                <span
                  id={`verse-${chapter.number}-${verse.number}`}
                  ref={(el) => setVerseRef(verse.number, el)}
                  role={selectionMode ? 'button' : undefined}
                  tabIndex={selectionMode ? 0 : undefined}
                  aria-pressed={selectionMode ? Boolean(selected) : undefined}
                  aria-label={selectionMode ? `${selected ? 'Remove' : 'Select'} ${bookName} ${chapter.number}:${verse.number}` : undefined}
                  onClick={selectionMode ? () => handleVerseActivation(verse) : undefined}
                  onKeyDown={event => handleSelectionKeyDown(event, verse)}
                  className={`group/stack inline rounded-md px-0.5 sm:px-1 py-0.5 ${selectionMode ? 'verse-selection-target cursor-pointer' : ''} ${
                  verse.isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : ''
                } ${
                  hasComment ? 'hover:bg-amber-50 dark:hover:bg-amber-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${
                  selected
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-700'
                    : highlighted ? 'bg-yellow-100 dark:bg-yellow-900/35 ring-1 ring-yellow-300 dark:ring-yellow-700' : ''
                }`}
              >
                <span className="text-[10px] sm:text-sm text-gray-400 dark:text-gray-500 font-medium select-none mr-1">
                  {verse.number}
                </span>
                {selectionMode && (
                  <span
                    className={`mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold align-middle ${
                      selected
                        ? 'border-primary bg-primary text-white dark:border-blue-400 dark:bg-blue-500'
                        : 'border-gray-300 text-transparent dark:border-gray-600'
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
                <span
                  className={`cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 ${
                    verse.isSuperscription
                      ? 'text-gray-500 dark:text-gray-400'
                      : hasComment ? 'text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={selectionMode ? undefined : () => handleVerseActivation(verse)}
                  data-verse-content
                  data-book={bookName}
                  data-chapter={chapter.number}
                  data-verse={verse.number}
                  data-translation={translationId}
                >
                  <VerseText text={verse.text} layout={layout} highlights={textHighlights} />
                </span>
                {!selectionMode && <button
                  data-testid={`verse-bookmark-${verse.number}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onBookmarkToggle(chapter.number, verse.number, verse.text)
                  }}
                  className={`ml-1 align-baseline rounded transition-all ${
                    bookmarked
                      ? 'text-secondary'
                      : 'text-gray-300 dark:text-gray-600 hover:text-secondary opacity-0 group-hover/stack:opacity-100'
                  }`}
                  title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                >
                  {bookmarked ? '★' : '☆'}
                </button>}
                  {verseIndex < chapter.verses.length - 1 && ' '}
                </span>
                <InlineVerseNotes notes={inlineNotes} compact />
              </Fragment>
            )
          })}
        </div>
      )}
      <div className="reader-chapter-end-spacer" aria-hidden="true" />
    </div>
  )
}

export default BibleChapter

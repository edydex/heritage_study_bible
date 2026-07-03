import { useEffect, useRef, useCallback } from 'react'
import { applyHighlightRanges } from '../utils/verseHighlightText'

// Render verse text, converting:
//   <b>...</b> tags to bold spans (used in Psalms headers etc.)
//   || to poetic line breaks (used in LSV for poetry)
function renderVerseText(text) {
  const lines = String(text).replace(/\s*\|\|\s*/g, '\n').split('\n')
  if (lines.length === 1 && !text.includes('<b>')) return text

  return lines.map((line, li) => {
    let rendered
    if (line.includes('<b>')) {
      const parts = line.split(/(<b>.*?<\/b>)/g)
      rendered = parts.map((part, i) => {
        const m = part.match(/^<b>(.*?)<\/b>$/)
        if (m) return <strong key={`b${i}`} className="font-bold">{m[1]}</strong>
        return part
      })
    } else {
      rendered = line
    }

    if (li === 0) return <span key={li}>{rendered}</span>
    return <span key={li}><br /><span className="inline-block w-4" />{rendered}</span>
  })
}

function renderVerseBody(verse, getVerseHighlights, chapterNumber) {
  const ranges = getVerseHighlights?.(chapterNumber, verse.number) || []
  if (ranges.length > 0) {
    const highlighted = applyHighlightRanges(verse.text, ranges)
    if (highlighted) return highlighted
  }
  return renderVerseText(verse.text)
}

function BibleChapter({
  chapter,
  bookName = 'Revelation',
  hasCommentary,
  onVerseClick,
  isBookmarked,
  onBookmarkToggle,
  onVersePosition,
  isVerseSelected,
  getVerseHighlights,
  highlightMode = false,
  renderAfterVerse,
  textSize = 18,
  verseStacking = false,
}) {
  const containerRef = useRef(null)
  const verseRefs = useRef({})

  const verseHoverClasses = (selected, hasComment) => {
    if (selected) return ''
    if (hasComment) {
      return 'hover:bg-amber-50 dark:hover:bg-amber-900/30 active:bg-amber-100 dark:active:bg-amber-900/50'
    }
    return 'hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600'
  }

  const verseStyle = { fontSize: `${textSize}px`, lineHeight: 1.6 }

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
            top: rect.top + scrollTop - 80,
            height: rect.height,
            offsetFromContainer: rect.top - containerRect.top
          })
        }
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
  }, [chapter, onVersePosition])

  const setVerseRef = useCallback((verseNumber, el) => {
    verseRefs.current[verseNumber] = el
  }, [])

  const handleVerseTextClick = (ch, verse, text) => {
    if (highlightMode) return
    onVerseClick?.(ch, verse, text)
  }

  const textInteractionClass = highlightMode
    ? 'select-text cursor-text'
    : 'cursor-pointer hover:text-gray-900 dark:hover:text-gray-100'

  return (
    <div className="bg-white dark:bg-black rounded-none sm:rounded-xl shadow-none sm:shadow-md px-1 py-1 sm:p-6 md:p-8" ref={containerRef}>

      {!verseStacking ? (
        <div>
          {chapter.verses.map((verse) => {
            const hasComment = hasCommentary(chapter.number, verse.number)
            const bookmarked = isBookmarked(verse.number)
            const selected = isVerseSelected?.(chapter.number, verse.number)

            return (
              <div key={verse.number}>
                <div
                  id={`verse-${chapter.number}-${verse.number}`}
                  ref={(el) => setVerseRef(verse.number, el)}
                  data-ink-anchor={`verse-${chapter.number}-${verse.number}`}
                  className={`group flex items-start gap-0.5 sm:gap-2 py-0.5 sm:py-1 px-0 sm:px-2 rounded-lg transition-all duration-300 ${verseHoverClasses(selected, hasComment)} ${
                    verse.isSuperscription ? 'mb-2 border-l-2 border-gray-200 dark:border-gray-700 pl-2 italic' : ''
                  } ${
                    selected ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-700' : ''
                  }`}
                >
                <span className="text-[10px] sm:text-sm text-gray-400 dark:text-gray-500 font-medium min-w-[1rem] sm:min-w-[2rem] pt-1 sm:pt-0.5 select-none text-right">
                  {verse.number}
                </span>

                <p
                  className={`verse-text flex-1 ${textInteractionClass} ${
                    verse.isSuperscription
                      ? 'text-gray-500 dark:text-gray-400'
                      : hasComment ? 'text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'
                  }`}
                  style={verseStyle}
                  data-verse-text
                  data-verse={verse.number}
                  data-chapter={chapter.number}
                  onClick={() => handleVerseTextClick(chapter.number, verse.number, verse.text)}
                >
                  {renderVerseBody(verse, getVerseHighlights, chapter.number)}
                </p>

                <button
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
                </button>
                </div>
                {renderAfterVerse?.(verse.number)}
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

            return (
              <span
                key={verse.number}
                id={`verse-${chapter.number}-${verse.number}`}
                ref={(el) => setVerseRef(verse.number, el)}
                className={`group/stack inline rounded-md px-0.5 sm:px-1 py-0.5 ${verseHoverClasses(selected, hasComment)} ${
                  verse.isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : ''
                } ${
                  selected ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-700' : ''
                }`}
              >
                <span className="text-[10px] sm:text-sm text-gray-400 dark:text-gray-500 font-medium select-none mr-1">
                  {verse.number}
                </span>
                <span
                  className={`${textInteractionClass} ${
                    verse.isSuperscription
                      ? 'text-gray-500 dark:text-gray-400'
                      : hasComment ? 'text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'
                  }`}
                  data-verse-text
                  data-verse={verse.number}
                  data-chapter={chapter.number}
                  onClick={() => handleVerseTextClick(chapter.number, verse.number, verse.text)}
                >
                  {renderVerseBody(verse, getVerseHighlights, chapter.number)}
                </span>
                <button
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
                </button>
                {verseIndex < chapter.verses.length - 1 && ' '}
              </span>
            )
          })}
        </div>
      )}
      <div className="reader-chapter-end-spacer" aria-hidden="true" />
    </div>
  )
}

export default BibleChapter

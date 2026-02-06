import { useEffect, useRef, useCallback, useMemo } from 'react'

// Render verse text, converting:
//   <b>...</b> tags to bold spans (used in Psalms headers etc.)
//   || to poetic line breaks (used in LSV for poetry)
function renderVerseText(text) {
  // Split on || for poetic line breaks, then handle <b> tags within each segment
  const lines = text.split(' || ')
  if (lines.length === 1 && !text.includes('<b>')) return text

  return lines.map((line, li) => {
    // Handle <b> tags within each line segment
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
    // Each subsequent || segment starts on a new indented line
    return <span key={li}><br /><span className="inline-block w-4" />{rendered}</span>
  })
}

function BibleChapter({ chapter, bookName = 'Revelation', hasCommentary, onVerseClick, isBookmarked, onBookmarkToggle, onVersePosition, textSize = 18 }) {
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

  return (
    <div className="bg-white rounded-none sm:rounded-xl shadow-none sm:shadow-md px-1 py-1 sm:p-6 md:p-8" ref={containerRef}>

      {/* Verses */}
      <div>
        {chapter.verses.map((verse) => {
          const hasComment = hasCommentary(chapter.number, verse.number)
          const bookmarked = isBookmarked(verse.number)
          
          return (
            <div 
              key={verse.number}
              id={`verse-${chapter.number}-${verse.number}`}
              ref={(el) => setVerseRef(verse.number, el)}
              className={`group flex items-start gap-0.5 sm:gap-2 py-0.5 sm:py-1 px-0 sm:px-2 rounded-lg transition-all duration-300 hover:bg-gray-50 active:bg-gray-100 ${
                hasComment ? 'hover:bg-amber-50 active:bg-amber-100' : ''
              }`}
            >
              {/* Verse Number */}
              <span className="text-[10px] sm:text-sm text-gray-400 font-medium min-w-[1rem] sm:min-w-[2rem] pt-1 sm:pt-0.5 select-none text-right">
                {verse.number}
              </span>

              {/* Verse Text */}
              <p 
                className={`verse-text flex-1 cursor-pointer hover:text-gray-900 ${
                  hasComment ? 'text-gray-800' : 'text-gray-700'
                }`}
                style={verseStyle}
                onClick={() => onVerseClick(chapter.number, verse.number, verse.text)}
              >
                {renderVerseText(verse.text)}
              </p>

              {/* Bookmark Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onBookmarkToggle(chapter.number, verse.number, verse.text)
                }}
                className={`p-1 rounded transition-all ${
                  bookmarked 
                    ? 'text-secondary' 
                    : 'text-gray-300 hover:text-secondary opacity-0 group-hover:opacity-100'
                }`}
                title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
              >
                {bookmarked ? '★' : '☆'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default BibleChapter

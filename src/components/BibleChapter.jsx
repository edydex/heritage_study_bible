import { useEffect, useRef, useCallback } from 'react'

function BibleChapter({ chapter, bookName = 'Revelation', hasCommentary, onVerseClick, isBookmarked, onBookmarkToggle, onVersePosition, textSize = 'medium' }) {
  const containerRef = useRef(null)
  const verseRefs = useRef({})

  // Text size classes
  const textSizeClasses = {
    small: 'text-[15px] sm:text-base leading-6 sm:leading-relaxed',
    medium: 'text-[17px] sm:text-lg leading-7 sm:leading-relaxed',
    large: 'text-[20px] sm:text-xl leading-8 sm:leading-relaxed',
  }

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
      <div className="space-y-0 sm:space-y-1">
        {chapter.verses.map((verse) => {
          const hasComment = hasCommentary(chapter.number, verse.number)
          const bookmarked = isBookmarked(verse.number)
          
          return (
            <div 
              key={verse.number}
              id={`verse-${chapter.number}-${verse.number}`}
              ref={(el) => setVerseRef(verse.number, el)}
              className={`group flex items-start gap-0.5 sm:gap-2 py-1 px-0 sm:p-2 rounded-lg transition-all duration-300 hover:bg-gray-50 active:bg-gray-100 ${
                hasComment ? 'hover:bg-amber-50 active:bg-amber-100' : ''
              }`}
            >
              {/* Verse Number */}
              <span className="text-[10px] sm:text-sm text-gray-400 font-medium min-w-[1rem] sm:min-w-[2rem] pt-1 sm:pt-1 select-none text-right">
                {verse.number}
              </span>

              {/* Verse Text */}
              <p 
                className={`verse-text ${textSizeClasses[textSize]} flex-1 cursor-pointer hover:text-gray-900 ${
                  hasComment ? 'text-gray-800' : 'text-gray-700'
                }`}
                onClick={() => onVerseClick(chapter.number, verse.number, verse.text)}
              >
                {verse.text}
                {hasComment && (
                  <span className="inline-block ml-1.5 sm:ml-2 text-secondary opacity-60 group-hover:opacity-100 transition-opacity text-sm" title="View commentary">
                    💬
                  </span>
                )}
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

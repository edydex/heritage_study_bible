import { useEffect, useMemo, useRef, useCallback } from 'react'

function renderVerseText(text) {
  const lines = String(text || '').replace(/\s*\|\|\s*/g, '\n').split('\n')
  if (lines.length === 1 && !String(text || '').includes('<b>')) return text

  return lines.map((line, lineIndex) => {
    let rendered
    if (line.includes('<b>')) {
      const parts = line.split(/(<b>.*?<\/b>)/g)
      rendered = parts.map((part, partIndex) => {
        const match = part.match(/^<b>(.*?)<\/b>$/)
        if (match) return <strong key={`b${partIndex}`} className="font-bold">{match[1]}</strong>
        return part
      })
    } else {
      rendered = line
    }

    if (lineIndex === 0) return <span key={lineIndex}>{rendered}</span>
    return <span key={lineIndex}><br /><span className="inline-block w-4" />{rendered}</span>
  })
}

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
  onBookmarkToggle,
  onVersePosition,
  isVerseSelected,
  textSize = 18,
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
    onVerseClick(primaryChapter.number, verseNumber, verseText)
  }

  return (
    <div className="bg-white dark:bg-black rounded-none sm:rounded-xl shadow-none sm:shadow-md px-1 py-1 sm:p-6 md:p-8" ref={containerRef}>
      <div className="space-y-2">
        {verseNumbers.map((verseNumber) => {
          const primaryVerse = primaryVerseMap.get(verseNumber)
          const secondaryVerse = secondaryVerseMap.get(verseNumber)
          const hasComment = hasCommentary(primaryChapter.number, verseNumber)
          const bookmarked = isBookmarked(verseNumber)
          const selected = isVerseSelected?.(primaryChapter.number, verseNumber)

          const rowClassName = `rounded-lg border transition-all ${
            selected
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
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
              className={rowClassName}
            >
              <div className="hidden md:grid md:grid-cols-2 md:gap-3 md:p-2">
                <div className="group flex items-start gap-2 rounded-md p-2 hover:bg-white/70 dark:hover:bg-gray-700 cursor-pointer" onClick={() => handleVerseClick(verseNumber)}>
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium min-w-[2rem] pt-0.5 select-none text-right">{verseNumber}</span>
                  <p className="verse-text flex-1 text-gray-800 dark:text-gray-200" style={verseStyle}>
                    {primaryVerse ? renderVerseText(primaryVerse.text) : <MissingVerse translationId={primaryTranslationId} />}
                  </p>
                  <button
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
                  </button>
                </div>

                <div className="flex items-start gap-2 rounded-md p-2 hover:bg-white/60 dark:hover:bg-gray-700 cursor-pointer" onClick={() => handleVerseClick(verseNumber)}>
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium min-w-[2rem] pt-0.5 select-none text-right">{verseNumber}</span>
                  <p className="verse-text flex-1 text-gray-700 dark:text-gray-300" style={verseStyle}>
                    {secondaryVerse ? renderVerseText(secondaryVerse.text) : <MissingVerse translationId={secondaryTranslationId} />}
                  </p>
                </div>
              </div>

              <div className="md:hidden p-2 space-y-2">
                <div className="rounded-md bg-white dark:bg-black p-2 cursor-pointer" onClick={() => handleVerseClick(verseNumber)}>
                  <div className="text-[11px] uppercase tracking-wide text-primary dark:text-blue-400 font-semibold mb-1">{primaryTranslationId}</div>
                  <div className="flex items-start gap-2 group">
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium min-w-[1.3rem] pt-0.5 select-none text-right">{verseNumber}</span>
                    <p className="verse-text flex-1 text-gray-800 dark:text-gray-200" style={verseStyle}>
                      {primaryVerse ? renderVerseText(primaryVerse.text) : <MissingVerse translationId={primaryTranslationId} />}
                    </p>
                    <button
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
                    </button>
                  </div>
                </div>

                <div className="rounded-md bg-white/70 dark:bg-black p-2 cursor-pointer" onClick={() => handleVerseClick(verseNumber)}>
                  <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold mb-1">{secondaryTranslationId}</div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium min-w-[1.3rem] pt-0.5 select-none text-right">{verseNumber}</span>
                    <p className="verse-text flex-1 text-gray-700 dark:text-gray-300" style={verseStyle}>
                      {secondaryVerse ? renderVerseText(secondaryVerse.text) : <MissingVerse translationId={secondaryTranslationId} />}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ParallelBibleChapter

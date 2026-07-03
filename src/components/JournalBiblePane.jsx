import { useCallback, useMemo } from 'react'
import BibleChapter from './BibleChapter'
import JournalGapBlock from './JournalGapBlock'
import VerseGapZone from './VerseGapZone'
import { AFTER_ALL_VERSES } from '../hooks/useJournal'

function JournalBiblePane({
  book,
  chapter,
  chapterData,
  loading,
  loadError,
  translationId,
  getVerseHighlights,
  highlightMode = false,
  gaps = [],
  onGapTextChange,
  onGapRemove,
  onInsertGap,
  inkBlockingText = false,
}) {
  const gapsByAfterVerse = useMemo(() => {
    const map = new Map()
    for (const gap of gaps) {
      const key = gap.afterVerse
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(gap)
    }
    return map
  }, [gaps])

  const lastVerse = chapterData?.verses?.[chapterData.verses.length - 1]?.number

  const renderAfterVerse = useCallback((verseNumber) => {
    const verseGaps = gapsByAfterVerse.get(verseNumber) ?? []
    const endGaps = verseNumber === lastVerse ? (gapsByAfterVerse.get(AFTER_ALL_VERSES) ?? []) : []

    return (
      <>
        {verseGaps.map(gap => (
          <JournalGapBlock
            key={gap.id}
            gap={gap}
            onTextChange={onGapTextChange}
            onRemove={onGapRemove}
            inkBlockingText={inkBlockingText}
          />
        ))}
        <VerseGapZone afterVerse={verseNumber} onInsert={onInsertGap} />
        {verseNumber === lastVerse && endGaps.map(gap => (
          <JournalGapBlock
            key={gap.id}
            gap={gap}
            onTextChange={onGapTextChange}
            onRemove={onGapRemove}
            inkBlockingText={inkBlockingText}
          />
        ))}
        {verseNumber === lastVerse && (
          <VerseGapZone afterVerse={AFTER_ALL_VERSES} onInsert={onInsertGap} />
        )}
      </>
    )
  }, [
    gapsByAfterVerse,
    lastVerse,
    onGapTextChange,
    onGapRemove,
    onInsertGap,
    inkBlockingText,
  ])

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
          isBookmarked={() => false}
          onBookmarkToggle={() => {}}
          getVerseHighlights={getVerseHighlights}
          highlightMode={highlightMode}
          renderAfterVerse={renderAfterVerse}
          textSize={18}
        />
      )}
      {!loading && !chapterData && !loadError && (
        <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
          No text for {book} {chapter} in {translationId}.
        </div>
      )}
    </div>
  )
}

export default JournalBiblePane

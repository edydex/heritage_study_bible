import { useHeritageAudio } from './audio/AudioProvider'
import { interactiveWordRanges } from '../services/wordStudy'
import WordStudyDialog from './WordStudyDialog'
import { getTranslationById } from '../data/translations'
import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import VerseText from './VerseText'
import { loadRomansWordLinks, verseWordLinks, originalSourceForBook, originalVerseLanguage } from '../data/originalLanguages'
import { getVerseLayout } from '../utils/verseLayout'
import { getParallelVerseHighlightClasses } from '../utils/highlightColors'

function MissingVerse({ translationId }) {
  return (
    <div className="text-sm text-gray-400 dark:text-gray-500 italic">
      {translationId === 'ORIGINAL' ? 'No text in the installed source.' : `Verse not present in ${translationId}.`}
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
  onOccurrenceNavigate,
  isBookmarked,
  isVerseHighlighted,
  getVerseHighlightColor,
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
  const audio = useHeritageAudio()
  const [study, setStudy] = useState(null)
  const [heldMessage, setHeldMessage] = useState('')
  const holdWord = word => { setActiveWord(word.paired ? word : null); setHeldMessage(word.paired ? word.label : 'No checked translation match is installed for this word.') }
  const containerRef = useRef(null)
  const rowRefs = useRef({})
  const [alignment, setAlignment] = useState(null)
  const [showWordLinks, setShowWordLinks] = useState(true)
  const [activeWord, setActiveWord] = useState(null)
  const [linkError, setLinkError] = useState('')
  const [linkRetry, setLinkRetry] = useState(0)
  const original = secondaryTranslationId === 'ORIGINAL'
  const source = originalSourceForBook(bookName)
  const hebrew = original && source.id === 'WLC-OSHB'
  const numberingUnsupported = original && getTranslationById(primaryTranslationId)?.versification !== 'western'
  const canLink = original && !numberingUnsupported && primaryTranslationId === 'BSB' && bookName === 'Romans'
  useEffect(() => {
    let cancelled = false
    setAlignment(null); setActiveWord(null); setLinkError('')
    if (canLink) loadRomansWordLinks().then(data => { if (!cancelled) setAlignment(data) })
      .catch(() => { if (!cancelled) setLinkError('Word links could not load. The Bible text is still available.') })
    return () => { cancelled = true }
  }, [canLink, linkRetry])
  useEffect(() => { setActiveWord(null); setStudy(null); setHeldMessage('') }, [bookName, primaryChapter.number, showWordLinks, selectionMode])


  const primaryVerseMap = useMemo(() => {
    return new Map((primaryChapter?.verses || []).map(verse => [verse.number, verse]))
  }, [primaryChapter])

  const secondaryVerseMap = useMemo(() => {
    return new Map((numberingUnsupported ? [] : secondaryChapter?.verses || []).map(verse => [verse.number, verse]))
  }, [secondaryChapter, numberingUnsupported])

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
      className={`parallel-word-study ${audio?.settings.parallelMonochrome ? 'word-links-monochrome' : 'word-links-color'} bg-white dark:bg-black rounded-none sm:rounded-xl shadow-none sm:shadow-md px-1 py-1 sm:p-6 md:p-8 ${selectionMode ? 'verse-selection-mode' : ''}`}
      ref={containerRef}
    >
      {original && <div className="mb-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
        <div className="font-semibold text-gray-900 dark:text-gray-100">Original languages · {hebrew ? 'Hebrew / Aramaic' : 'Greek New Testament'}</div>
        <p><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>.</p>
        {numberingUnsupported && <p role="status" className="mt-2">The original source uses Western verse numbering. A checked mapping for {primaryTranslationId} is not installed, so its source column is left empty. Choose BSB, SYNO-W or another Western-numbered primary translation to compare.</p>}
        {hebrew && <details className="mt-2 text-xs"><summary>Source and verse numbering</summary><p className="mt-1">WLC 4.20 as maintained by OSHB. Written readings appear in the text; traditional read-aloud alternatives (qere) are listed separately. Hebrew and Aramaic labels follow source morphology. Original source references are retained where numbering differs. Nehemiah 7:68 is absent from this witness.</p><p className="mt-1">Original work of the Open Scriptures Hebrew Bible available at <a className="underline" href="https://github.com/openscriptures/morphhb">github.com/openscriptures/morphhb</a>. WLC text is public domain; metadata is <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Adapted for BSB verse numbering and separate reading notes.</p></details>}
        {hebrew && !numberingUnsupported && secondaryChapter?.superscription && <div className="mt-3 border-t pt-2"><p className="text-xs">Hebrew source heading · {secondaryChapter.superscription.sourceRefs.join(', ')}</p><p dir="rtl" lang="he" className="mt-1 text-lg">{secondaryChapter.superscription.text}</p></div>}
        {canLink ? <>
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={showWordLinks} onChange={event => setShowWordLinks(event.target.checked)} /> Word links</label>
          {showWordLinks && <details className="mt-1 text-xs"><summary className="cursor-pointer">How word links work</summary><p className="mt-1">Matching tints (or underline patterns in B&W mode) connect Greek words and BSB phrases. Tap a word for its occurrences. Hold it, or press Shift+Enter, to identify its translation match. Links are omitted where source wording differs.</p><p className="mt-1">Links come from Berean’s published translation tables. This is a named scholarly edition of the Greek New Testament.</p></details>}
          {selectionMode && showWordLinks && <p className="mt-1 text-xs">Word links pause while selecting verses.</p>}
          {linkError && <p role="status" className="mt-2">{linkError} <button className="underline" onClick={() => setLinkRetry(value => value + 1)}>Retry links</button></p>}
          {showWordLinks && !alignment && !linkError && <p role="status" className="mt-1 text-xs">Loading word links…</p>}

        </> : <p className="mt-1 text-xs">Word links are available with BSB in Romans.</p>}
      </div>}
      {heldMessage && <div role="status" className="sticky top-16 z-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 flex items-center justify-between gap-3"><span>{heldMessage}</span><button aria-label="Clear word match" onClick={() => { setActiveWord(null); setHeldMessage('') }}>✕</button></div>}
      {study && <WordStudyDialog word={study} onClose={() => setStudy(null)} onNavigate={onOccurrenceNavigate} />}
      <div className="space-y-2">
        {verseNumbers.map((verseNumber) => {
          const primaryVerse = primaryVerseMap.get(verseNumber)
          const secondaryVerse = secondaryVerseMap.get(verseNumber)
          const links = canLink && showWordLinks && !selectionMode
            ? verseWordLinks(alignment, primaryChapter.number, verseNumber, secondaryVerse?.text || '', primaryVerse?.text || '') : null
          const isSuperscription = Boolean(primaryVerse?.isSuperscription || secondaryVerse?.isSuperscription)
          const hasComment = hasCommentary(primaryChapter.number, verseNumber)
          const bookmarked = isBookmarked(verseNumber)
          const selected = isVerseSelected?.(primaryChapter.number, verseNumber)
          const highlightColor = getVerseHighlightColor?.(primaryChapter.number, verseNumber)
            || (isVerseHighlighted?.(primaryChapter.number, verseNumber) ? 'yellow' : null)
          const primaryLayout = getVerseLayout(primaryVerseLayout, bookName, primaryChapter.number, verseNumber)
          const secondaryLayout = getVerseLayout(secondaryVerseLayout, bookName, primaryChapter.number, verseNumber)
          const startsParagraph = primaryLayout?.breakBefore || secondaryLayout?.breakBefore

          const primaryHighlights = getTextHighlights?.(primaryChapter.number, verseNumber, primaryTranslationId, primaryVerse?.text || '') || []
          const secondaryHighlights = getTextHighlights?.(primaryChapter.number, verseNumber, secondaryTranslationId, secondaryVerse?.text || '') || []
          const context = { book: bookName, chapter: primaryChapter.number, verse: verseNumber }
          const primaryWords = selectionMode ? [] : interactiveWordRanges(primaryVerse?.text || '', links?.target, { ...context, translationId: primaryTranslationId })
          const secondaryWords = selectionMode ? [] : interactiveWordRanges(secondaryVerse?.text || '', links?.source, { ...context, translationId: secondaryTranslationId })
          const rowClassName = `relative rounded-lg border transition-all ${selectionMode ? 'verse-selection-target cursor-pointer' : ''} ${startsParagraph ? 'mt-4' : ''} ${
            selected
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
              : highlightColor
                ? getParallelVerseHighlightClasses(highlightColor)
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
                    {primaryVerse ? <VerseText text={primaryVerse.text} layout={primaryLayout} highlights={primaryHighlights} wordLinks={primaryWords} activeWordLink={activeWord?.id} onWordLink={holdWord} onWordTap={setStudy} /> : <MissingVerse translationId={primaryTranslationId} />}
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
                    dir={original ? source.direction : undefined}
                    lang={hebrew ? secondaryVerse?.languages?.length === 1 ? secondaryVerse.languages[0] : 'he' : original ? 'grc' : undefined}
                  >
                    {secondaryVerse ? <VerseText text={secondaryVerse.text} layout={secondaryLayout} highlights={secondaryHighlights} wordLinks={secondaryWords} activeWordLink={activeWord?.id} onWordLink={holdWord} onWordTap={setStudy} /> : <MissingVerse translationId={secondaryTranslationId} />}
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
                      {primaryVerse ? <VerseText text={primaryVerse.text} layout={primaryLayout} highlights={primaryHighlights} wordLinks={primaryWords} activeWordLink={activeWord?.id} onWordLink={holdWord} onWordTap={setStudy} /> : <MissingVerse translationId={primaryTranslationId} />}
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
                  <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold mb-1">{original ? hebrew ? `${originalVerseLanguage(secondaryVerse)} · WLC / OSHB` : source.label : secondaryTranslationId}</div>
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
                      dir={original ? source.direction : undefined}
                      lang={hebrew ? secondaryVerse?.languages?.length === 1 ? secondaryVerse.languages[0] : 'he' : original ? 'grc' : undefined}
                    >
                      {secondaryVerse ? <VerseText text={secondaryVerse.text} layout={secondaryLayout} highlights={secondaryHighlights} wordLinks={secondaryWords} activeWordLink={activeWord?.id} onWordLink={holdWord} onWordTap={setStudy} /> : <MissingVerse translationId={secondaryTranslationId} />}
                    </p>
                  </div>
                </div>
              </div>
              {hebrew && secondaryVerse && <div className="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400" onClick={event => event.stopPropagation()}>
                <span>{originalVerseLanguage(secondaryVerse)} · WLC {secondaryVerse.sourceRefs?.join(', ')}</span>
                {secondaryVerse.variants?.length > 0 && <details className="mt-1"><summary>Readings (qere)</summary>{secondaryVerse.variants.map((variant, i) => <p key={i} className="mt-1">Written: <bdi dir="rtl" className="text-base">{variant.written}</bdi> · Read: <bdi dir="rtl" className="text-base">{variant.reading}</bdi></p>)}</details>}
              </div>}
            </div>
          )
        })}
      </div>
      <div className="reader-chapter-end-spacer" aria-hidden="true" />
    </div>
  )
}

export default ParallelBibleChapter

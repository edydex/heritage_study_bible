import { useHeritageAudio } from './audio/AudioProvider'
import { interactiveWordRanges } from '../services/wordStudy'
import WordStudyDialog from './WordStudyDialog'
import { getTranslationById, loadTranslation } from '../data/translations'
import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import VerseText from './VerseText'
import { synodalAdditionNote, synodalAdditionRanges } from '../data/synodalTextAdditions'
import VerseNumber from './VerseNumber'
import { loadGreekWordLinks, greekWordLinkTranslations, originalSourceForBook, originalVerseLanguage, visibleVerseText } from '../data/originalLanguages'
import { chapterWordAnchors } from '../services/parallelWordAnchors'
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
  const [studySelection, setStudy] = useState(null)
  const heldStudyClick = useRef(false)
  const selectWord = word => setActiveWord(word)
  const studyWord = (word, pointerGesture) => { heldStudyClick.current = Boolean(pointerGesture); selectWord(word); setStudy(word) }
  const containerRef = useRef(null)
  const rowRefs = useRef({})
  const [alignment, setAlignment] = useState(null)
  const [showWordLinks, setShowWordLinks] = useState(true)
  const [activeSelection, setActiveWord] = useState(null)
  const [linkError, setLinkError] = useState('')
  const [linkRetry, setLinkRetry] = useState(0)
  const original = secondaryTranslationId === 'ORIGINAL'
  const primaryOriginal = primaryTranslationId === 'ORIGINAL'
  const source = originalSourceForBook(bookName)
  const hebrew = original && source.id === 'WLC-OSHB'
  const numberingUnsupported = original && getTranslationById(primaryTranslationId)?.versification !== 'western'
  const linkTranslations = [...greekWordLinkTranslations, 'ORIGINAL']
  const canLink = !numberingUnsupported && source.id === 'N1904'
    && linkTranslations.includes(primaryTranslationId) && linkTranslations.includes(secondaryTranslationId)
  useEffect(() => {
    let cancelled = false
    setAlignment(null); setLinkError('')
    if (canLink) Promise.all([
      primaryOriginal ? null : loadGreekWordLinks(bookName, primaryTranslationId),
      original ? null : loadGreekWordLinks(bookName, secondaryTranslationId),
      loadTranslation('ORIGINAL', bookName).then(corpus => corpus.books.find(book => book.name === bookName)),
      loadTranslation(primaryTranslationId, bookName).then(corpus => corpus.books.find(book => book.name === bookName)),
      loadTranslation(secondaryTranslationId, bookName).then(corpus => corpus.books.find(book => book.name === bookName)),
    ]).then(([primary, secondary, sourceBook, primaryBook, secondaryBook]) => {
      if (!cancelled) setAlignment({ primary, secondary, sourceBook, primaryBook, secondaryBook })
    })
      .catch(() => { if (!cancelled) setLinkError('Word links could not load. The Bible text is still available.') })
    return () => { cancelled = true }
  }, [canLink, bookName, primaryTranslationId, secondaryTranslationId, primaryChapter.number, original, primaryOriginal, linkRetry])
  useEffect(() => { setActiveWord(null); setStudy(null) }, [bookName, primaryChapter.number, primaryTranslationId, secondaryTranslationId, selectionMode])

  const chapterLinks = useMemo(() => alignment && canLink && !selectionMode ? chapterWordAnchors({
    primaryData: alignment.primary, secondaryData: alignment.secondary,
    sourceBook: alignment.sourceBook, primaryBook: alignment.primaryBook, secondaryBook: alignment.secondaryBook,
    chapter: primaryChapter.number,
  }) : null, [alignment, canLink, selectionMode, primaryChapter.number])

  const russianChapter = primaryTranslationId === 'SYNO-W' ? primaryChapter : secondaryTranslationId === 'SYNO-W' ? secondaryChapter : null
  const russianLinks = primaryTranslationId === 'SYNO-W' ? alignment?.primary : secondaryTranslationId === 'SYNO-W' ? alignment?.secondary : null
  const reviewedRussianVerses = (russianChapter?.verses || []).filter(verse => {
    const entry = russianLinks?.verses?.[`${russianChapter.number}:${verse.number}`]
    return entry?.review?.completeAccounting && entry.targetText === visibleVerseText(verse.text)
  }).length


  const primaryVerseMap = useMemo(() => {
    return new Map((primaryChapter?.verses || []).map(verse => [verse.number, verse]))
  }, [primaryChapter])

  const secondaryVerseMap = useMemo(() => {
    return new Map((numberingUnsupported ? [] : secondaryChapter?.verses || []).map(verse => [verse.number, verse]))
  }, [secondaryChapter, numberingUnsupported])

  const getWords = useCallback((side, verseNumber) => {
    if (selectionMode) return []
    const primary = side === 'primary'
    const verse = (primary ? primaryVerseMap : secondaryVerseMap).get(verseNumber)
    const ref = `${primaryChapter.number}:${verseNumber}`
    const pairs = chapterLinks?.[side].get(ref)
    return interactiveWordRanges(verse?.text || '', showWordLinks ? pairs : pairs?.map(({ pattern, ...pair }) => pair), {
      book: bookName, chapter: primaryChapter.number, verse: verseNumber,
      translationId: primary ? primaryTranslationId : secondaryTranslationId,
      comparisonTranslationId: primary
        ? primaryOriginal ? secondaryTranslationId : primaryTranslationId
        : original ? primaryTranslationId : secondaryTranslationId,
      lookupLinks: chapterLinks?.[primary ? 'lookupPrimary' : 'lookupSecondary'].get(ref),
      unpairedNotes: chapterLinks?.[primary ? 'primaryNotes' : 'secondaryNotes'].get(ref),
      sourceReferences: chapterLinks?.[primary ? 'primarySourceReferences' : 'secondarySourceReferences'].get(ref),
    })
  }, [selectionMode, primaryVerseMap, secondaryVerseMap, primaryChapter.number, chapterLinks, showWordLinks,
    bookName, primaryTranslationId, secondaryTranslationId, primaryOriginal, original])

  // Keep the physical selection while links load; derive its current anchors
  // instead of retaining the unpaired snapshot captured by an early tap/hold.
  const resolveSelection = useCallback(selection => {
    if (!selection || selection.book !== bookName || selection.chapter !== primaryChapter.number) return null
    const side = selection.translationId === primaryTranslationId ? 'primary'
      : selection.translationId === secondaryTranslationId ? 'secondary' : null
    return side ? getWords(side, selection.verse).find(word => word.startOffset === selection.startOffset
      && word.endOffset === selection.endOffset && word.word === selection.word) || null : null
  }, [bookName, primaryChapter.number, primaryTranslationId, secondaryTranslationId, getWords])
  const activeWord = useMemo(() => resolveSelection(activeSelection), [resolveSelection, activeSelection])
  const study = useMemo(() => resolveSelection(studySelection), [resolveSelection, studySelection])
  const linksLoading = canLink && !alignment && !linkError && !selectionMode
  const heldMessage = !activeWord ? '' : linksLoading ? `Loading word links for “${activeWord.word}”…`
    : linkError ? `Word links could not load for “${activeWord.word}”.`
      : activeWord.paired ? activeWord.label : activeWord.unpairedReason || `No checked translation match is installed for “${activeWord.word}”.`

  const verseNumbers = useMemo(() => {
    const keys = new Set([...primaryVerseMap.keys(), ...secondaryVerseMap.keys()])
    return [...keys].sort((a, b) => a - b)
  }, [primaryVerseMap, secondaryVerseMap])

  const verseStyle = { fontSize: `${textSize}px`, lineHeight: 1.6 }

  const setRowRef = useCallback((verseNumber, element) => {
    rowRefs.current[verseNumber] = element
  }, [])

  const showCounterpart = reference => {
    if (reference.chapter !== primaryChapter.number) {
      onOccurrenceNavigate?.(bookName, reference.chapter, reference.verse)
      return
    }
    const matches = [...(containerRef.current?.querySelectorAll('[data-word-link]') || [])]
    const match = matches.find(node => node.dataset.wordLink === activeWord?.id
      && node.closest('[data-translation]')?.dataset.translation === reference.translationId
      && Number(node.closest('[data-verse]')?.dataset.verse) === reference.verse
      && node.getBoundingClientRect().height > 0)
    match?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

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
      onPointerDownCapture={() => { heldStudyClick.current = false }}
      onKeyDownCapture={() => { heldStudyClick.current = false }}
      onClickCapture={event => {
        // A touch hold opens the modal before release. Its compatibility click
        // may land on the new backdrop; consume that release, not the next tap.
        if (heldStudyClick.current) { heldStudyClick.current = false; event.preventDefault(); event.stopPropagation() }
      }}
    >
      {(original || canLink) && <div className="mb-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
        <div className="font-semibold text-gray-900 dark:text-gray-100">{original ? 'Original languages' : 'Word links'} · {hebrew ? 'Hebrew / Aramaic' : 'Greek New Testament'}</div>
        <p><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>.</p>
        {numberingUnsupported && <p role="status" className="mt-2">The original source uses Western verse numbering. A checked mapping for {primaryTranslationId} is not installed, so its source column is left empty. Choose BSB, SYNO-W or another Western-numbered primary translation to compare.</p>}
        {hebrew && <details className="mt-2 text-xs"><summary>Source and verse numbering</summary><p className="mt-1">WLC 4.20 as maintained by OSHB. Written readings appear in the text; traditional read-aloud alternatives (qere) are listed separately. Hebrew and Aramaic labels follow source morphology. Original source references are retained where numbering differs. Nehemiah 7:68 is absent from this witness.</p><p className="mt-1">Original work of the Open Scriptures Hebrew Bible available at <a className="underline" href="https://github.com/openscriptures/morphhb">github.com/openscriptures/morphhb</a>. WLC text is public domain; metadata is <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Adapted for BSB verse numbering and separate reading notes.</p></details>}
        {hebrew && !numberingUnsupported && secondaryChapter?.superscription && <div className="mt-3 border-t pt-2"><p className="text-xs">Hebrew source heading · {secondaryChapter.superscription.sourceRefs.join(', ')}</p><p dir="rtl" lang="he" className="mt-1 text-lg">{secondaryChapter.superscription.text}</p></div>}
        {canLink ? <>
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={showWordLinks} onChange={event => setShowWordLinks(event.target.checked)} /> Word links</label>
          {!selectionMode && <p className="mt-2 text-xs">Tap a word to highlight its match in both columns. Hold it, or choose Study word, for occurrences.</p>}
          {russianChapter && alignment && <p className="mt-1 text-xs" data-russian-link-coverage="true">Russian Synodal: {reviewedRussianVerses} of {russianChapter.verses.length} verses in this chapter have reviewed word links. Work is continuing; unreviewed words remain unlinked.</p>}
          {russianChapter?.verses.some(verse => synodalAdditionRanges('SYNO-W', bookName, russianChapter.number, verse.number, verse.text).length > 0)
            && <p lang="ru" className="mt-1 text-xs">[[…]] — {synodalAdditionNote}</p>}
          {showWordLinks && <details className="mt-1 text-xs"><summary className="cursor-pointer">How word links work</summary><p className="mt-1">Each checked match has a distinct color and pattern combination, shared across both columns. Nearby matches favor contrasting colors and textures; words translated together share one combination. B&W mode uses underline patterns. Uncertain matches and differing source readings remain uncolored. Hold a word, or press Shift+Enter, for word study.</p><p className="mt-1">BSB links use Berean’s published translation tables and checked repairs. LSV, KJV and Russian Synodal use reviewed phrase correspondences; a phrase can include several words. Uncolored words can still be studied without implying an exact translation match.</p></details>}
          {selectionMode && showWordLinks && <p className="mt-1 text-xs">Word links pause while selecting verses.</p>}
          {linkError && <p role="status" className="mt-2">{linkError} <button className="underline" onClick={() => setLinkRetry(value => value + 1)}>Retry links</button></p>}
          {showWordLinks && !alignment && !linkError && <p role="status" className="mt-1 text-xs">Loading word links…</p>}

        </> : <p className="mt-1 text-xs">{hebrew ? 'Tap a Hebrew or Aramaic word, then choose Study word (or hold it), to find its source lemma throughout the Old Testament, including inflected forms. Strong’s identifiers follow OSHB. English phrase links are not installed.' : 'Word links are available for BSB, LSV, KJV and reviewed Russian Synodal passages in the Greek New Testament. Tap a word, then choose Study word (or hold it), for occurrences.'}</p>}
      </div>}
      {heldMessage && <div role="region" aria-label="Selected word match" className="word-match-bar sticky top-16 z-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 mb-3 shadow-sm flex flex-wrap items-center justify-between gap-2"><span role="status">{heldMessage}</span>{activeWord?.notes?.length > 0 && <details className="w-full text-sm"><summary>Reading note</summary>{activeWord.notes.map((note, index) => <p key={index} className="mt-1">{note}</p>)}</details>}<div className="flex flex-wrap items-center gap-2">{activeWord?.counterparts?.filter(ref => ref.chapter !== activeWord.chapter || ref.verse !== activeWord.verse).map(ref => <button key={`${ref.translationId}:${ref.chapter}:${ref.verse}`} className="rounded border px-3 py-2 text-sm" onClick={() => showCounterpart(ref)}>Show {ref.translationId === 'ORIGINAL' ? 'Original' : ref.translationId} {ref.chapter}:{ref.verse}</button>)}<button className="rounded border px-3 py-2 text-sm font-semibold" onClick={() => setStudy(activeWord)}>Study word</button><button className="rounded px-3 py-2" aria-label="Clear word match" onClick={() => { setActiveWord(null); setStudy(null) }}>✕</button></div></div>}
      {study && !linksLoading && <WordStudyDialog word={study} onClose={() => setStudy(null)} onNavigate={onOccurrenceNavigate} />}
      <div className="space-y-2">
        {verseNumbers.map((verseNumber) => {
          const primaryVerse = primaryVerseMap.get(verseNumber)
          const secondaryVerse = secondaryVerseMap.get(verseNumber)
          const ref = `${primaryChapter.number}:${verseNumber}`
          const links = { primary: chapterLinks?.primary.get(ref), secondary: chapterLinks?.secondary.get(ref) }
          const isSuperscription = Boolean(primaryVerse?.isSuperscription || secondaryVerse?.isSuperscription)
          const hasComment = hasCommentary(primaryChapter.number, verseNumber)
          const bookmarked = isBookmarked(verseNumber)
          const selected = isVerseSelected?.(primaryChapter.number, verseNumber)
          const highlightColor = getVerseHighlightColor?.(primaryChapter.number, verseNumber)
            || (isVerseHighlighted?.(primaryChapter.number, verseNumber) ? 'yellow' : null)
          const primaryLayout = getVerseLayout(primaryVerseLayout, bookName, primaryChapter.number, verseNumber)
          const secondaryLayout = getVerseLayout(secondaryVerseLayout, bookName, primaryChapter.number, verseNumber)
          const startsParagraph = primaryLayout?.breakBefore || secondaryLayout?.breakBefore

          const primaryAdditions = synodalAdditionRanges(primaryTranslationId, bookName, primaryChapter.number, verseNumber, primaryVerse?.text)
          const secondaryAdditions = synodalAdditionRanges(secondaryTranslationId, bookName, primaryChapter.number, verseNumber, secondaryVerse?.text)
          const primaryHighlights = getTextHighlights?.(primaryChapter.number, verseNumber, primaryTranslationId, primaryVerse?.text || '') || []
          const secondaryHighlights = getTextHighlights?.(primaryChapter.number, verseNumber, secondaryTranslationId, secondaryVerse?.text || '') || []
          const primaryWords = getWords('primary', verseNumber)
          const secondaryWords = getWords('secondary', verseNumber)
          const rowClassName = `relative rounded-lg border transition-all ${selectionMode ? 'verse-selection-target cursor-pointer' : ''} ${startsParagraph ? 'mt-4' : ''} ${
            selected
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
              : highlightColor
                ? getParallelVerseHighlightClasses(highlightColor)
              : isSuperscription
                ? 'bg-white dark:bg-black border-gray-200 dark:border-gray-800'
              : 'bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700'
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
                <div className="group flex items-start gap-2 rounded-md p-2 hover:bg-white/70 dark:hover:bg-gray-950 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(verseNumber)}>
                  <VerseNumber number={verseNumber} bookmarked={bookmarked} selectionMode={selectionMode} textSize={textSize} onToggle={() => onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || secondaryVerse?.text || '')} />
                  <p
                    className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                    style={verseStyle}
                    data-verse-content={primaryVerse ? '' : undefined}
                    data-book={bookName}
                    data-chapter={primaryChapter.number}
                    data-verse={verseNumber}
                    data-translation={primaryTranslationId}
                  >
                    {primaryVerse ? <VerseText text={primaryVerse.text} layout={primaryLayout} highlights={primaryHighlights} additions={primaryAdditions} wordLinks={primaryWords} activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} /> : <MissingVerse translationId={primaryTranslationId} />}
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-md p-2 hover:bg-white/60 dark:hover:bg-gray-950 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(verseNumber)}>
                  <VerseNumber number={verseNumber} bookmarked={bookmarked} selectionMode={selectionMode} textSize={textSize} onToggle={() => onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || secondaryVerse?.text || '')} />
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
                    {secondaryVerse ? <VerseText text={secondaryVerse.text} layout={secondaryLayout} highlights={secondaryHighlights} additions={secondaryAdditions} wordLinks={secondaryWords} activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} /> : <MissingVerse translationId={secondaryTranslationId} />}
                  </p>
                </div>
              </div>

              <div className="md:hidden p-2 space-y-2">
                <div className="rounded-md bg-white dark:bg-black p-2 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(verseNumber)}>
                  <div className="text-[11px] uppercase tracking-wide text-primary dark:text-blue-400 font-semibold mb-1">{primaryTranslationId}</div>
                  <div className="flex items-start gap-2 group">
                    <VerseNumber number={verseNumber} bookmarked={bookmarked} selectionMode={selectionMode} textSize={textSize} onToggle={() => onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || secondaryVerse?.text || '')} />
                    <p
                      className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                      style={verseStyle}
                      data-verse-content={primaryVerse ? '' : undefined}
                      data-book={bookName}
                      data-chapter={primaryChapter.number}
                      data-verse={verseNumber}
                      data-translation={primaryTranslationId}
                    >
                      {primaryVerse ? <VerseText text={primaryVerse.text} layout={primaryLayout} highlights={primaryHighlights} additions={primaryAdditions} wordLinks={primaryWords} activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} /> : <MissingVerse translationId={primaryTranslationId} />}
                    </p>
                  </div>
                </div>

                <div className="rounded-md bg-white/70 dark:bg-black p-2 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(verseNumber)}>
                  <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold mb-1">{original ? hebrew ? `${originalVerseLanguage(secondaryVerse)} · WLC / OSHB` : source.label : secondaryTranslationId}</div>
                  <div className="flex items-start gap-2">
                    <VerseNumber number={verseNumber} bookmarked={bookmarked} selectionMode={selectionMode} textSize={textSize} onToggle={() => onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || secondaryVerse?.text || '')} />
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
                      {secondaryVerse ? <VerseText text={secondaryVerse.text} layout={secondaryLayout} highlights={secondaryHighlights} additions={secondaryAdditions} wordLinks={secondaryWords} activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} /> : <MissingVerse translationId={secondaryTranslationId} />}
                    </p>
                  </div>
                </div>
              </div>
              {canLink && showWordLinks && alignment && !links.primary?.length && !links.secondary?.length && !selectionMode && primaryVerse && secondaryVerse && <p className="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400">
                {alignment.primary?.unavailable?.[`${primaryChapter.number}:${verseNumber}`] === 'no-unambiguous-shared-phrase'
                  ? 'No unambiguous translation phrase link is installed for this verse.'
                  : 'Word links are unavailable here because the source or translation wording differs from the mapping.'}
              </p>}
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

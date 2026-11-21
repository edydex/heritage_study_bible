import { useHeritageAudio } from './audio/AudioProvider'
import { interactiveWordRanges } from '../services/wordStudy'
import WordStudyDialog from './WordStudyDialog'
import { getTranslationById, loadTranslation } from '../data/translations'
import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import VerseText from './VerseText'
import BibleChapter from './BibleChapter'
import { textualAdditionLabels, textualAdditionRanges } from '../data/textualAdditions'
import VerseNumber from './VerseNumber'
import { loadGreekWordLinks, greekWordLinkTranslations, originalSourceForBook, originalVerseLanguage, visibleVerseText } from '../data/originalLanguages'
import { chapterWordAnchors } from '../services/parallelWordAnchors'
import { getVerseLayout } from '../utils/verseLayout'
import { getParallelVerseHighlightClasses } from '../utils/highlightColors'
import { UKRK_DISPLAY_ABBR, translationDisplayAbbr, translationDisplayText } from '../utils/translationDisplay'
import { psalmComparisonVerseNumber } from '../utils/psalmSuperscriptions'

function MissingVerse({ translationId, joinedWith }) {
  return (
    <span className="text-sm text-gray-400 dark:text-gray-500 italic">
      {joinedWith ? `Included with verse ${joinedWith}.` : translationId === 'ORIGINAL' ? 'No text in the installed source.' : `Verse not present in ${translationDisplayAbbr(translationId)}.`}
    </span>
  )
}

function HebrewHeading({ heading }) {
  if (!heading) return null
  return <div className="mb-3 border-b pb-2"><p className="text-xs">Hebrew source heading · {heading.sourceRefs.join(', ')}</p><p dir="rtl" lang="he" className="mt-1 text-lg">{heading.text}</p></div>
}

function HebrewVerseNotes({ verse }) {
  return (
    <div className="px-2 pb-2 text-xs text-gray-500 dark:text-gray-400" onClick={event => event.stopPropagation()}>
      <span>{originalVerseLanguage(verse)} · WLC {verse.sourceRefs?.join(', ')}</span>
      {verse.variants?.length > 0 && <details className="mt-1"><summary>Readings (qere)</summary><p className="mt-1">{verse.variants.map((variant, i) => <span key={i} className="block">Written: <bdi dir="rtl" className="text-base">{variant.written}</bdi> · Read: <bdi dir="rtl" className="text-base">{variant.reading}</bdi></span>)}</p></details>}
    </div>
  )
}

function reviewedVerseCount(chapter, data) {
  return (chapter?.verses || []).filter(verse => {
    const entry = data?.verses?.[`${chapter.number}:${verse.number}`]
    return entry?.review?.completeAccounting && entry.targetText === visibleVerseText(verse.text)
  }).length
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
  const linkTranslations = [...greekWordLinkTranslations, 'ORIGINAL']
  const canLink = source.id === 'N1904'
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
  const isUkrainianPrimary = primaryTranslationId === 'UKRK'
  const ukrainianChapter = isUkrainianPrimary ? primaryChapter : secondaryTranslationId === 'UKRK' ? secondaryChapter : null
  const ukrainianLinks = isUkrainianPrimary ? alignment?.primary : alignment?.secondary
  const reviewedUkrainianVerses = ukrainianLinks?.targetId === 'UKRK' && ukrainianLinks.book === bookName
    ? reviewedVerseCount(ukrainianChapter, ukrainianLinks) : 0
  const ukrainianChapterReviewed = reviewedUkrainianVerses > 0 && reviewedUkrainianVerses === ukrainianChapter.verses.length
  const separateOriginal = original && getTranslationById(primaryTranslationId)?.versification !== 'western'
    && !(isUkrainianPrimary && ukrainianChapterReviewed)
  const ukrainianReferencesDiffer = ukrainianChapterReviewed && ukrainianChapter.verses.some(verse => {
    const entry = ukrainianLinks.verses[`${ukrainianChapter.number}:${verse.number}`]
    return entry.sourceAbsent || (entry.sourceReference && (entry.sourceReference.chapter !== ukrainianChapter.number
      || entry.sourceReference.verse !== verse.number)) || entry.groups.some(group => group.sourceAnchors?.some(anchor =>
      anchor.chapter !== ukrainianChapter.number || anchor.verse !== verse.number
    ))
  })

  const primaryVerseMap = useMemo(() => {
    return new Map((primaryChapter?.verses || []).map(verse => [verse.parallelNumber ?? verse.number, verse]))
  }, [primaryChapter])

  const secondaryVerseMap = useMemo(() => {
    return new Map((secondaryChapter?.verses || []).map(verse => [verse.parallelNumber ?? verse.number, verse]))
  }, [secondaryChapter])

  const getWords = useCallback((side, rowNumber) => {
    if (selectionMode) return []
    const primary = side === 'primary'
    const verse = (primary ? primaryVerseMap : secondaryVerseMap).get(rowNumber)
    if (!verse) return []
    const verseNumber = verse.number
    const ref = `${primaryChapter.number}:${verseNumber}`
    const links = separateOriginal ? null : chapterLinks
    const pairs = links?.[side].get(ref)
    return interactiveWordRanges(verse?.text || '', showWordLinks ? pairs : pairs?.map(({ pattern, ...pair }) => pair), {
      book: bookName, chapter: primaryChapter.number, verse: verseNumber,
      translationId: primary ? primaryTranslationId : secondaryTranslationId,
      comparisonTranslationId: separateOriginal && hebrew ? 'BSB' : primary
        ? primaryOriginal ? secondaryTranslationId : primaryTranslationId
        : original ? primaryTranslationId : secondaryTranslationId,
      lookupLinks: links?.[primary ? 'lookupPrimary' : 'lookupSecondary'].get(ref),
      unpairedNotes: links?.[primary ? 'primaryNotes' : 'secondaryNotes'].get(ref),
      sourceReferences: links?.[primary ? 'primarySourceReferences' : 'secondarySourceReferences'].get(ref),
    })
  }, [selectionMode, primaryVerseMap, secondaryVerseMap, primaryChapter.number, chapterLinks, separateOriginal, hebrew, showWordLinks,
    bookName, primaryTranslationId, secondaryTranslationId, primaryOriginal, original])

  // Keep the physical selection while links load; derive its current anchors
  // instead of retaining the unpaired snapshot captured by an early tap/hold.
  const resolveSelection = useCallback(selection => {
    if (!selection || selection.book !== bookName || selection.chapter !== primaryChapter.number) return null
    const side = selection.translationId === primaryTranslationId ? 'primary'
      : selection.translationId === secondaryTranslationId ? 'secondary' : null
    const rowNumber = psalmComparisonVerseNumber(bookName, selection.chapter, selection.verse, selection.translationId)
    return side ? getWords(side, rowNumber).find(word => word.startOffset === selection.startOffset
      && word.endOffset === selection.endOffset && word.word === selection.word) || null : null
  }, [bookName, primaryChapter.number, primaryTranslationId, secondaryTranslationId, getWords])
  const activeWord = useMemo(() => resolveSelection(activeSelection), [resolveSelection, activeSelection])
  const study = useMemo(() => resolveSelection(studySelection), [resolveSelection, studySelection])
  const linksLoading = canLink && !separateOriginal && !alignment && !linkError && !selectionMode
  const displayedActiveWord = translationDisplayText(activeWord?.translationId, activeWord?.word)
  const heldMessage = !activeWord ? '' : linksLoading ? `Loading word links for “${displayedActiveWord}”…`
    : linkError ? `Word links could not load for “${displayedActiveWord}”.`
      : activeWord.paired ? activeWord.label : activeWord.unpairedReason || `No checked translation match is installed for “${displayedActiveWord}”.`

  const verseNumbers = useMemo(() => {
    const keys = new Set([...primaryVerseMap.keys(), ...secondaryVerseMap.keys()])
    return [...keys].sort((a, b) => a - b)
  }, [primaryVerseMap, secondaryVerseMap])
  const hasPsalmHeading = primaryVerseMap.get(0)?.isSuperscription || secondaryVerseMap.get(0)?.isSuperscription

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
    if (separateOriginal || !onVersePosition || !containerRef.current) return

    const updatePositions = () => {
      const containerRect = containerRef.current.getBoundingClientRect()
      const scrollTop = window.scrollY || document.documentElement.scrollTop

      verseNumbers.forEach(rowNumber => {
        const rowEl = rowRefs.current[rowNumber]
        if (!rowEl) return

        const rect = rowEl.getBoundingClientRect()
        const verseNumber = primaryVerseMap.get(rowNumber)?.number ?? rowNumber
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
  }, [onVersePosition, primaryChapter.number, primaryVerseMap, separateOriginal, verseNumbers])

  const handleVerseClick = (rowNumber) => {
    const primary = primaryVerseMap.get(rowNumber)
    const secondary = secondaryVerseMap.get(rowNumber)
    if (!primary && primaryVerseMap.get(rowNumber + 1)?.combinedWithPrevious) return
    const verseText = primary?.text || secondary?.text || ''
    if (!globalThis.window?.getSelection?.()?.isCollapsed) return
    onVerseClick(primaryChapter.number, primary?.number ?? rowNumber, verseText)
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
        {separateOriginal && <p className="mt-2">This chapter uses separate columns because the verse numbers have no checked alignment yet. Tap or hold an original word to study it.</p>}
        {hebrew && <details className="mt-2 text-xs"><summary>Source and verse numbering</summary><p className="mt-1">WLC 4.20 as maintained by OSHB. Written readings appear in the text; traditional read-aloud alternatives (qere) are listed separately. Hebrew and Aramaic labels follow source morphology. Original source references are retained where numbering differs. Nehemiah 7:68 is absent from this witness.</p><p className="mt-1">Original work of the Open Scriptures Hebrew Bible available at <a className="underline" href="https://github.com/openscriptures/morphhb">github.com/openscriptures/morphhb</a>. WLC text is public domain; metadata is <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Adapted for BSB verse numbering and separate reading notes.</p></details>}
        {hebrew && !separateOriginal && <HebrewHeading heading={secondaryChapter?.superscription} />}
        {canLink && !separateOriginal ? <>
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={showWordLinks} onChange={event => setShowWordLinks(event.target.checked)} /> Word links</label>
          {!selectionMode && <p className="mt-2 text-xs">Tap a word to highlight its match in both columns. Hold it, or choose Study word, for occurrences.</p>}
          {russianChapter && alignment && <p className="mt-1 text-xs" data-russian-link-coverage="true">Russian Synodal: {reviewedVerseCount(russianChapter, russianLinks)} of {russianChapter.verses.length} verses in this chapter have reviewed word links.</p>}
          {ukrainianChapter && alignment && <p className="mt-1 text-xs">{UKRK_DISPLAY_ABBR}: {reviewedUkrainianVerses} of {ukrainianChapter.verses.length} verses have reviewed word links.</p>}
          {original && ukrainianReferencesDiffer && <p className="mt-1 text-xs">Both editions keep their own verse numbers. Select a word to see its linked verse in the other column.</p>}
          {[['SYNO-W', russianChapter], ['UKRK', ukrainianChapter]].map(([id, chapter]) =>
            chapter?.verses.some(verse => textualAdditionRanges(id, bookName, chapter.number, verse.number, verse.text).length > 0)
              && <p key={id} lang={textualAdditionLabels[id].lang} className="mt-1 text-xs">[[…]] — {textualAdditionLabels[id].note}</p>
          )}
          {showWordLinks && <details className="mt-1 text-xs"><summary className="cursor-pointer">How word links work</summary><p className="mt-1">Each checked match has a distinct color and pattern combination, shared across both columns. Nearby matches favor contrasting colors and textures; words translated together share one combination. B&W mode uses underline patterns. Uncertain matches and differing source readings remain uncolored. Hold a word, or press Shift+Enter, for word study.</p><p className="mt-1">BSB links use Berean’s published translation tables and checked repairs. LSV, KJV, Russian Synodal and {UKRK_DISPLAY_ABBR} use reviewed phrase correspondences; a phrase can include several words. Uncolored words can still be studied without implying an exact translation match.</p></details>}
          {selectionMode && showWordLinks && <p className="mt-1 text-xs">Word links pause while selecting verses.</p>}
        </> : !separateOriginal && <p className="mt-1 text-xs">{hebrew ? 'Tap a Hebrew or Aramaic word, then choose Study word (or hold it), to find its source lemma throughout the Old Testament, including inflected forms. Strong’s identifiers follow OSHB. English phrase links are not installed.' : 'Word links are available in reviewed Greek New Testament passages. Tap a word, then choose Study word (or hold it), for occurrences.'}</p>}
        {linkError && <p role="status" className="mt-2">{linkError} <button className="underline" onClick={() => setLinkRetry(value => value + 1)}>Retry links</button></p>}
        {linksLoading && showWordLinks && <p role="status" className="mt-1 text-xs">Loading word links…</p>}
      </div>}
      {heldMessage && <div role="region" aria-label="Selected word match" className="word-match-bar sticky top-16 z-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 mb-3 shadow-sm flex flex-wrap items-center justify-between gap-2"><span role="status">{heldMessage}</span>{activeWord?.notes?.length > 0 && <details className="w-full text-sm"><summary>Reading note</summary>{activeWord.notes.map((note, index) => <p key={index} className="mt-1">{note}</p>)}</details>}<div className="flex flex-wrap items-center gap-2">{activeWord?.counterparts?.filter(ref => ref.chapter !== activeWord.chapter || ref.verse !== activeWord.verse).map(ref => <button key={`${ref.translationId}:${ref.chapter}:${ref.verse}`} className="rounded border px-3 py-2 text-sm" onClick={() => showCounterpart(ref)}>Show {ref.translationId === 'ORIGINAL' ? 'Original' : translationDisplayAbbr(ref.translationId)} {ref.chapter}:{ref.verse}</button>)}<button className="rounded border px-3 py-2 text-sm font-semibold" onClick={() => setStudy(activeWord)}>Study word</button><button className="rounded px-3 py-2" aria-label="Clear word match" onClick={() => { setActiveWord(null); setStudy(null) }}>✕</button></div></div>}
      {study && !linksLoading && <WordStudyDialog word={study} onClose={() => setStudy(null)} onNavigate={onOccurrenceNavigate} navigateToOriginal={separateOriginal} />}
      {separateOriginal ? <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <section aria-label={`${translationDisplayAbbr(primaryTranslationId)} chapter text`} className="min-w-0 [overflow-wrap:anywhere]">
          <h3 className="mb-2 px-2 font-semibold">{translationDisplayAbbr(primaryTranslationId)}</h3>
          <BibleChapter
            chapter={primaryChapter} bookName={bookName} translationId={primaryTranslationId}
            hasCommentary={hasCommentary} onVerseClick={onVerseClick} isBookmarked={isBookmarked}
            isVerseSelected={isVerseSelected} isVerseHighlighted={isVerseHighlighted} getVerseHighlightColor={getVerseHighlightColor}
            getTextHighlights={getTextHighlights} notes={notes} onBookmarkToggle={onBookmarkToggle} onVersePosition={onVersePosition}
            textSize={textSize} verseStacking={false} verseLayout={primaryVerseLayout} selectionMode={selectionMode}
          />
        </section>
        <section aria-label="Original chapter text" className="min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 px-2 [overflow-wrap:anywhere]">
          <h3 className="my-2 font-semibold">{hebrew ? 'Original Hebrew / Aramaic' : 'Original Greek'}</h3>
          {hebrew && <HebrewHeading heading={secondaryChapter?.superscription} />}
          {secondaryChapter?.verses?.length ? secondaryChapter.verses.map(verse => (
            <div key={verse.number} className="mb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-baseline gap-1.5">
                <span className="flex-none text-xs font-semibold text-gray-500 dark:text-gray-400">{verse.number}</span>
                <p className="verse-text min-w-0 flex-1" style={verseStyle} dir={source.direction}
                  lang={hebrew ? verse.languages?.length === 1 ? verse.languages[0] : 'he' : 'grc'}
                  data-verse-content data-book={bookName} data-chapter={secondaryChapter.number}
                  data-verse={verse.number} data-translation={secondaryTranslationId}>
                  <VerseText text={verse.text} translationId={secondaryTranslationId} wordLinks={getWords('secondary', verse.number)}
                    activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} />
                </p>
              </div>
              {hebrew && <HebrewVerseNotes verse={verse} />}
            </div>
          )) : <MissingVerse translationId={secondaryTranslationId} />}
        </section>
      </div> : <div className="space-y-2">
        {verseNumbers.map((rowNumber, rowIndex) => {
          const primaryVerse = primaryVerseMap.get(rowNumber)
          const secondaryVerse = secondaryVerseMap.get(rowNumber)
          const verseNumber = primaryVerse?.number ?? rowNumber
          const secondaryNumber = secondaryVerse?.number ?? rowNumber
          const primaryJoinedWith = !primaryVerse && primaryVerseMap.get(rowNumber + 1)?.combinedWithPrevious ? rowNumber + 1 : null
          const secondaryJoinedWith = !secondaryVerse && secondaryVerseMap.get(rowNumber + 1)?.combinedWithPrevious ? rowNumber + 1 : null
          const ref = `${primaryChapter.number}:${verseNumber}`
          const links = { primary: chapterLinks?.primary.get(ref), secondary: chapterLinks?.secondary.get(ref) }
          const isSuperscription = Boolean(primaryVerse?.isSuperscription || secondaryVerse?.isSuperscription)
          const hasComment = hasCommentary(primaryChapter.number, verseNumber)
          const bookmarked = isBookmarked(verseNumber)
          const selected = isVerseSelected?.(primaryChapter.number, verseNumber)
          const highlightColor = getVerseHighlightColor?.(primaryChapter.number, verseNumber)
            || (isVerseHighlighted?.(primaryChapter.number, verseNumber) ? 'yellow' : null)
          const primaryLayout = getVerseLayout(primaryVerseLayout, bookName, primaryChapter.number, verseNumber)
          const secondaryLayout = getVerseLayout(secondaryVerseLayout, bookName, primaryChapter.number, secondaryNumber)
          const startsParagraph = primaryLayout?.breakBefore || secondaryLayout?.breakBefore || (hasPsalmHeading && rowIndex === 1)

          const primaryAdditions = textualAdditionRanges(primaryTranslationId, bookName, primaryChapter.number, verseNumber, primaryVerse?.text)
          const secondaryAdditions = textualAdditionRanges(secondaryTranslationId, bookName, primaryChapter.number, secondaryNumber, secondaryVerse?.text)
          const primaryHighlights = getTextHighlights?.(primaryChapter.number, verseNumber, primaryTranslationId, primaryVerse?.text || '') || []
          const secondaryHighlights = getTextHighlights?.(primaryChapter.number, secondaryNumber, secondaryTranslationId, secondaryVerse?.text || '') || []
          const primaryWords = getWords('primary', rowNumber)
          const secondaryWords = getWords('secondary', rowNumber)
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
              key={rowNumber}
              id={`verse-${primaryChapter.number}-${verseNumber}`}
              ref={(element) => setRowRef(rowNumber, element)}
              role={selectionMode && !primaryJoinedWith ? 'button' : undefined}
              tabIndex={selectionMode && !primaryJoinedWith ? 0 : undefined}
              aria-pressed={selectionMode && !primaryJoinedWith ? Boolean(selected) : undefined}
              aria-label={selectionMode && !primaryJoinedWith ? `${selected ? 'Remove' : 'Select'} ${bookName} ${primaryChapter.number}:${verseNumber}` : undefined}
              onClick={selectionMode ? () => handleVerseClick(rowNumber) : undefined}
              onKeyDown={event => handleSelectionKeyDown(event, rowNumber)}
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
                <div className="group flex items-start gap-2 rounded-md p-2 hover:bg-white/70 dark:hover:bg-gray-950 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(rowNumber)}>
                  <VerseNumber number={verseNumber} label={primaryVerse?.numberLabel} bookmarked={bookmarked} selectionMode={selectionMode || Boolean(primaryJoinedWith)} textSize={textSize} onToggle={() => onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || secondaryVerse?.text || '')} />
                  <p
                    className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                    style={verseStyle}
                    data-verse-content={primaryVerse ? '' : undefined}
                    data-book={bookName}
                    data-chapter={primaryChapter.number}
                    data-verse={verseNumber}
                    data-translation={primaryTranslationId}
                  >
                    {primaryVerse ? <VerseText text={primaryVerse.text} layout={primaryLayout} highlights={primaryHighlights} additions={primaryAdditions} translationId={primaryTranslationId} wordLinks={primaryWords} activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} /> : <MissingVerse translationId={primaryTranslationId} joinedWith={primaryJoinedWith} />}
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-md p-2 hover:bg-white/60 dark:hover:bg-gray-950 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(rowNumber)}>
                  <VerseNumber number={secondaryNumber} label={secondaryVerse?.numberLabel} bookmarked={bookmarked} selectionMode={selectionMode || Boolean(primaryJoinedWith)} textSize={textSize} onToggle={() => onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || secondaryVerse?.text || '')} />
                  <p
                    className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}
                    style={verseStyle}
                    data-verse-content={secondaryVerse ? '' : undefined}
                    data-book={bookName}
                    data-chapter={primaryChapter.number}
                    data-verse={secondaryNumber}
                    data-translation={secondaryTranslationId}
                    dir={original ? source.direction : undefined}
                    lang={hebrew ? secondaryVerse?.languages?.length === 1 ? secondaryVerse.languages[0] : 'he' : original ? 'grc' : undefined}
                  >
                    {secondaryVerse ? <VerseText text={secondaryVerse.text} layout={secondaryLayout} highlights={secondaryHighlights} additions={secondaryAdditions} translationId={secondaryTranslationId} wordLinks={secondaryWords} activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} /> : <MissingVerse translationId={secondaryTranslationId} joinedWith={secondaryJoinedWith} />}
                  </p>
                </div>
              </div>

              <div className="md:hidden p-2 space-y-2">
                <div className="rounded-md bg-white dark:bg-black p-2 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(rowNumber)}>
                  <div className="text-[11px] uppercase tracking-wide text-primary dark:text-blue-400 font-semibold mb-1">{translationDisplayAbbr(primaryTranslationId)}</div>
                  <div className="flex items-start gap-2 group">
                    <VerseNumber number={verseNumber} label={primaryVerse?.numberLabel} bookmarked={bookmarked} selectionMode={selectionMode || Boolean(primaryJoinedWith)} textSize={textSize} onToggle={() => onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || secondaryVerse?.text || '')} />
                    <p
                      className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                      style={verseStyle}
                      data-verse-content={primaryVerse ? '' : undefined}
                      data-book={bookName}
                      data-chapter={primaryChapter.number}
                      data-verse={verseNumber}
                      data-translation={primaryTranslationId}
                    >
                      {primaryVerse ? <VerseText text={primaryVerse.text} layout={primaryLayout} highlights={primaryHighlights} additions={primaryAdditions} translationId={primaryTranslationId} wordLinks={primaryWords} activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} /> : <MissingVerse translationId={primaryTranslationId} joinedWith={primaryJoinedWith} />}
                    </p>
                  </div>
                </div>

                <div className="rounded-md bg-white/70 dark:bg-black p-2 cursor-pointer" onClick={selectionMode ? undefined : () => handleVerseClick(rowNumber)}>
                  <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold mb-1">{original ? hebrew ? `${originalVerseLanguage(secondaryVerse)} · WLC / OSHB` : source.label : translationDisplayAbbr(secondaryTranslationId)}</div>
                  <div className="flex items-start gap-2">
                    <VerseNumber number={secondaryNumber} label={secondaryVerse?.numberLabel} bookmarked={bookmarked} selectionMode={selectionMode || Boolean(primaryJoinedWith)} textSize={textSize} onToggle={() => onBookmarkToggle(primaryChapter.number, verseNumber, primaryVerse?.text || secondaryVerse?.text || '')} />
                    <p
                      className={`verse-text flex-1 ${isSuperscription ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}
                      style={verseStyle}
                      data-verse-content={secondaryVerse ? '' : undefined}
                      data-book={bookName}
                      data-chapter={primaryChapter.number}
                      data-verse={secondaryNumber}
                      data-translation={secondaryTranslationId}
                      dir={original ? source.direction : undefined}
                      lang={hebrew ? secondaryVerse?.languages?.length === 1 ? secondaryVerse.languages[0] : 'he' : original ? 'grc' : undefined}
                    >
                      {secondaryVerse ? <VerseText text={secondaryVerse.text} layout={secondaryLayout} highlights={secondaryHighlights} additions={secondaryAdditions} translationId={secondaryTranslationId} wordLinks={secondaryWords} activeWordLink={activeWord?.id} onWordLink={studyWord} onWordTap={selectWord} /> : <MissingVerse translationId={secondaryTranslationId} joinedWith={secondaryJoinedWith} />}
                    </p>
                  </div>
                </div>
              </div>
              {canLink && showWordLinks && alignment && !links.primary?.length && !links.secondary?.length && !selectionMode && primaryVerse && secondaryVerse && <p className="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400">
                {alignment.primary?.unavailable?.[`${primaryChapter.number}:${verseNumber}`] === 'no-unambiguous-shared-phrase'
                  ? 'No unambiguous translation phrase link is installed for this verse.'
                  : 'Word links are unavailable here because the source or translation wording differs from the mapping.'}
              </p>}
              {hebrew && secondaryVerse && <HebrewVerseNotes verse={secondaryVerse} />}
            </div>
          )
        })}
      </div>}
      <div className="reader-chapter-end-spacer" aria-hidden="true" />
    </div>
  )
}

export default ParallelBibleChapter

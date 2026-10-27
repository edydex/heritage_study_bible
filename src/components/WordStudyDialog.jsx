import { useEffect, useRef, useState } from 'react'
import { studyWord, sourceVerseWords, loadOccurrenceTranslations, occurrenceKey } from '../services/wordStudy'

export function OccurrenceText({ text, ranges = [] }) {
  const merged = []
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) continue
    const previous = merged.at(-1)
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end)
    else merged.push([start, end])
  }
  const parts = []
  let cursor = 0
  for (const [start, end] of merged) {
    parts.push(text.slice(cursor, start), <mark key={start} className="font-semibold underline decoration-2 bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-white">{text.slice(start, end)}</mark>)
    cursor = end
  }
  parts.push(text.slice(cursor))
  return <span className="whitespace-pre-wrap" dir="auto">{parts}</span>
}

export default function WordStudyDialog({ word, onClose, onNavigate }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [selected, setSelected] = useState(0), [limit, setLimit] = useState(40), [retry, setRetry] = useState(0)
  const [comparison, setComparison] = useState(null), [comparisonError, setComparisonError] = useState(false), [comparisonRetry, setComparisonRetry] = useState(0)
  const [sourceWords, setSourceWords] = useState(null), [sourceError, setSourceError] = useState(false), [sourceLoading, setSourceLoading] = useState(false), [sourceWord, setSourceWord] = useState(null)
  const studyTarget = sourceWord || word
  const comparisonTranslationId = ['LSV', 'KJV'].includes(word.comparisonTranslationId || word.translationId) ? (word.comparisonTranslationId || word.translationId) : 'BSB'
  useEffect(() => { setSourceWords(null); setSourceError(false); setSourceLoading(false); setSourceWord(null) }, [word])
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  useEffect(() => {
    let live = true
    setData(null); setError(''); setSelected(0); setLimit(40)
    studyWord(studyTarget).then(value => { if (live) setData(value) }).catch(() => { if (live) setError('Word occurrences could not load. The Bible text is still available.') })
    return () => { live = false }
  }, [studyTarget, retry])
  const showTranslation = data?.sourceId === 'N1904' || data?.sourceId === 'WLC-OSHB'
  useEffect(() => {
    let live = true
    setComparison(null); setComparisonError(false)
    if (showTranslation) loadOccurrenceTranslations(data.groups[selected].results.slice(0, limit), data.sourceId, comparisonTranslationId)
      .then(value => { if (live) { setComparison(value.results); setComparisonError(value.failed) } })
      .catch(() => { if (live) setComparisonError(true) })
    return () => { live = false }
  }, [data, selected, limit, comparisonRetry, showTranslation, comparisonTranslationId])
  const group = data?.groups[selected]
  const openSourceVerse = async () => {
    setSourceLoading(true); setSourceError(false)
    try { setSourceWords(await sourceVerseWords(word)) } catch { setSourceError(true) }
    finally { setSourceLoading(false) }
  }
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose() }} className="word-study-dialog rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-5" aria-label={`Word study: ${word.word}`}>
    <header className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{studyTarget.word}</h2><button autoFocus onClick={onClose} aria-label="Close word study" className="p-2">✕</button></header>
    {word.translationId !== 'ORIGINAL' && !word.sourceRange && <div className="mt-3 border rounded p-3">
      <button className="underline" disabled={sourceLoading} onClick={openSourceVerse}>{sourceLoading ? 'Loading original verse…' : sourceWords ? 'Reload original verse' : 'Study original words in this verse'}</button>
      {sourceError && <p role="status">The original verse could not load. Try again.</p>}
      {sourceWords?.length === 0 && <p className="mt-2 text-sm">No original verse is present in the installed source at this reference.</p>}
      {sourceWords?.length > 0 && <><p className="mt-2 text-sm">Choose a word from the original verse to find its source lemma across the Bible. No exact translation match is implied for “{word.word}”.</p>
        <div dir="auto" className="mt-2 flex flex-wrap gap-2">{sourceWords.map(item => <button key={item.id} className="border rounded px-2 py-1 text-lg" aria-pressed={sourceWord?.id === item.id} onClick={() => setSourceWord(item)}>{item.word}</button>)}</div>
        {sourceWord && <button className="mt-2 underline text-sm" onClick={() => setSourceWord(null)}>Back to {word.translationId} word forms</button>}
      </>}
    </div>}
    {!data && !error && <p role="status">Finding occurrences…</p>}
    {error && <p role="status">{error} <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {data && <>
      <p className="text-sm mt-2">{data.kind === 'lemma' ? 'Occurrences of the source lemma, including its inflected forms.' : 'Matching word form (accents and case ignored), not a dictionary root.'} {data.scope}.</p>
      {showTranslation && <p className="text-sm mt-2">{comparisonTranslationId} wording appears with each verse. {data.sourceId === 'WLC-OSHB' ? 'The Hebrew/Aramaic word is highlighted; an exact English word match is not available.' : <>Highlighted phrases use installed translation links; a phrase may include more than one English word.{comparisonTranslationId === 'LSV' && ' LSV phrase links are partial.'}</>}</p>}
      {data.groups.length > 1 && <div className="flex flex-wrap gap-2 mt-3">{data.groups.map((item, index) => <button key={item.lemma} className="border rounded px-3 py-2" aria-pressed={selected === index} onClick={() => { setSelected(index); setLimit(40) }}>{item.lemma}</button>)}</div>}
      {group && <>
        <h3 className="font-semibold mt-4">{group.lemma} {data.sourceId !== 'WLC-OSHB' && group.strongs.map(value => `G${value}`).join(' / ')}{group.language && <span className="ml-2 font-normal text-sm">{group.language === 'arc' ? 'Aramaic' : 'Hebrew'}</span>}</h3>
        <p className="text-sm">{group.results.reduce((count, row) => count + row.count, 0)} occurrences in {group.results.length} verses</p>
        {showTranslation && !comparison && !comparisonError && <p role="status" className="text-sm mt-2">Loading {comparisonTranslationId} wording…</p>}
        {comparisonError && <p role="status" className="text-sm mt-2">Some {comparisonTranslationId} wording or word mappings could not load. The source verses are still available. <button className="underline" onClick={() => setComparisonRetry(value => value + 1)}>Retry translations</button></p>}
        <ul className="mt-3 space-y-3">{group.results.slice(0, limit).map(row => {
          const translation = comparison?.[occurrenceKey(row)]
          return <li key={occurrenceKey(row)}><button className="text-left w-full rounded border border-gray-200 dark:border-gray-700 p-3" onClick={() => { onClose(); onNavigate?.(row.book, row.chapter, row.verse || 1) }}>
            <strong>{row.book} {row.chapter}{row.heading ? ' · source heading' : `:${row.verse}`}</strong>
            {translation && <div className="mt-2" data-occurrence-translation={comparisonTranslationId}>
              <p className="text-sm font-semibold">{translation.phrases.length ? `${comparisonTranslationId} · ${translation.phrases.map(phrase => `“${phrase}”`).join(' / ')}` : comparisonTranslationId}</p>
              {translation.text ? <p className="mt-1"><OccurrenceText text={translation.text} ranges={translation.ranges} /></p> : <p className="text-sm italic">{row.heading ? 'Source heading shown below.' : `Verse not present in ${comparisonTranslationId}.`}</p>}
              {translation.status === 'unmapped' && <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">Exact word mapping unavailable; the full verse is shown for context.</p>}
              {translation.status === 'matched' && translation.missingCount > 0 && <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">Some occurrences in this verse have no checked translation match.</p>}
            </div>}
            <p className={`mt-2 ${showTranslation ? 'text-sm text-gray-600 dark:text-gray-300' : ''}`}>
              {showTranslation && <span className="block text-xs mb-1">{data.sourceId === 'N1904' ? 'Greek · N1904' : 'Hebrew / Aramaic · WLC'}</span>}
              <OccurrenceText text={row.text} ranges={row.ranges} />
            </p>
          </button></li>
        })}</ul>
        {group.results.length > limit && <button className="border rounded px-3 py-2 mt-3" onClick={() => setLimit(value => value + 40)}>Show more</button>}
      </>}
      {data.kind === 'lemma' && <p className="text-xs mt-4">{data.sourceId === 'WLC-OSHB' ? 'Original work of the Open Scriptures Hebrew Bible · CC BY 4.0; WLC text · public domain. Source homograph identifiers and Hebrew/Aramaic distinctions are retained. Written readings are indexed; qere alternatives remain separate.' : 'N1904 morphology: Ulrik Sandborg-Petersen, building on Maurice A. Robinson · Biblical Humanities · CC0. BSB word correspondences: Berean translation tables · public domain. Different textual readings remain unlinked.'}</p>}
    </>}
  </dialog>
}

import { useEffect, useRef, useState } from 'react'
import { studyWord, loadOccurrenceTranslations, occurrenceKey } from '../services/wordStudy'

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
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  useEffect(() => {
    let live = true
    setData(null); setError(''); setSelected(0); setLimit(40)
    studyWord(word).then(value => { if (live) setData(value) }).catch(() => { if (live) setError('Word occurrences could not load. The Bible text is still available.') })
    return () => { live = false }
  }, [word, retry])
  const showTranslation = data?.sourceId === 'N1904' || data?.sourceId === 'WLC-OSHB'
  useEffect(() => {
    let live = true
    setComparison(null); setComparisonError(false)
    if (showTranslation) loadOccurrenceTranslations(data.groups[selected].results.slice(0, limit), data.sourceId)
      .then(value => { if (live) { setComparison(value.results); setComparisonError(value.failed) } })
      .catch(() => { if (live) setComparisonError(true) })
    return () => { live = false }
  }, [data, selected, limit, comparisonRetry, showTranslation])
  const group = data?.groups[selected]
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose() }} className="word-study-dialog rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-5" aria-label={`Word study: ${word.word}`}>
    <header className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{word.word}</h2><button autoFocus onClick={onClose} aria-label="Close word study" className="p-2">✕</button></header>
    {!data && !error && <p role="status">Finding occurrences…</p>}
    {error && <p role="status">{error} <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {data && <>
      <p className="text-sm mt-2">{data.kind === 'lemma' ? 'Occurrences of the source lemma, including its inflected forms.' : 'Matching word form (accents and case ignored), not a dictionary root.'} {data.scope}.</p>
      {showTranslation && <p className="text-sm mt-2">BSB wording appears with each verse. Highlighted phrases use checked translation links; a phrase may include more than one English word.</p>}
      {data.groups.length > 1 && <div className="flex flex-wrap gap-2 mt-3">{data.groups.map((item, index) => <button key={item.lemma} className="border rounded px-3 py-2" aria-pressed={selected === index} onClick={() => { setSelected(index); setLimit(40) }}>{item.lemma}</button>)}</div>}
      {group && <>
        <h3 className="font-semibold mt-4">{group.lemma} {group.strongs.map(value => `G${value}`).join(' / ')}</h3>
        <p className="text-sm">{group.results.reduce((count, row) => count + row.count, 0)} occurrences in {group.results.length} verses</p>
        {showTranslation && !comparison && !comparisonError && <p role="status" className="text-sm mt-2">Loading BSB wording…</p>}
        {comparisonError && <p role="status" className="text-sm mt-2">Some BSB wording or word mappings could not load. The source verses are still available. <button className="underline" onClick={() => setComparisonRetry(value => value + 1)}>Retry translations</button></p>}
        <ul className="mt-3 space-y-3">{group.results.slice(0, limit).map(row => {
          const translation = comparison?.[occurrenceKey(row)]
          return <li key={occurrenceKey(row)}><button className="text-left w-full rounded border border-gray-200 dark:border-gray-700 p-3" onClick={() => { onClose(); onNavigate?.(row.book, row.chapter, row.verse) }}>
            <strong>{row.book} {row.chapter}:{row.verse}</strong>
            {translation && <div className="mt-2" data-occurrence-translation="BSB">
              <p className="text-sm font-semibold">{translation.phrases.length ? `BSB · ${translation.phrases.map(phrase => `“${phrase}”`).join(' / ')}` : 'BSB'}</p>
              {translation.text ? <p className="mt-1"><OccurrenceText text={translation.text} ranges={translation.ranges} /></p> : <p className="text-sm italic">Verse not present in BSB.</p>}
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
      {data.kind === 'lemma' && <p className="text-xs mt-4">N1904 morphology: Ulrik Sandborg-Petersen, building on Maurice A. Robinson · Biblical Humanities · CC0. BSB word correspondences: Berean translation tables · public domain. Different textual readings remain unlinked.</p>}
    </>}
  </dialog>
}

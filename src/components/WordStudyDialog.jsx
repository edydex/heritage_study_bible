import { useEffect, useRef, useState } from 'react'
import { studyWord } from '../services/wordStudy'

export default function WordStudyDialog({ word, onClose, onNavigate }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [selected, setSelected] = useState(0), [limit, setLimit] = useState(40), [retry, setRetry] = useState(0)
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
  const group = data?.groups[selected]
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose() }} className="word-study-dialog rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-5" aria-label={`Word study: ${word.word}`}>
    <header className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{word.word}</h2><button autoFocus onClick={onClose} aria-label="Close word study" className="p-2">✕</button></header>
    {!data && !error && <p role="status">Finding occurrences…</p>}
    {error && <p role="status">{error} <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {data && <>
      <p className="text-sm mt-2">{data.kind === 'lemma' ? 'Occurrences of the source lemma, including its inflected forms.' : 'Matching word form (accents and case ignored), not a dictionary root.'} {data.scope}.</p>
      {data.groups.length > 1 && <div className="flex flex-wrap gap-2 mt-3">{data.groups.map((item, index) => <button key={item.lemma} className="border rounded px-3 py-2" aria-pressed={selected === index} onClick={() => { setSelected(index); setLimit(40) }}>{item.lemma}</button>)}</div>}
      {group && <><h3 className="font-semibold mt-4">{group.lemma} {group.strongs.map(value => `G${value}`).join(' / ')}</h3><p className="text-sm">{group.results.reduce((count, row) => count + row.count, 0)} occurrences in {group.results.length} verses</p>
        <ul className="mt-3 space-y-3">{group.results.slice(0, limit).map(row => <li key={`${row.book}:${row.chapter}:${row.verse}`}><button className="text-left w-full rounded border border-gray-200 dark:border-gray-700 p-3" onClick={() => { onClose(); onNavigate?.(row.book, row.chapter, row.verse) }}><strong>{row.book} {row.chapter}:{row.verse}</strong><p className="mt-1">{row.text}</p></button></li>)}</ul>
        {group.results.length > limit && <button className="border rounded px-3 py-2 mt-3" onClick={() => setLimit(value => value + 40)}>Show more</button>}
      </>}
      {data.kind === 'lemma' && <p className="text-xs mt-4">N1904 morphology: Ulrik Sandborg-Petersen, building on Maurice A. Robinson · Biblical Humanities · CC0.</p>}
    </>}
  </dialog>
}

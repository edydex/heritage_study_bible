'use client'
import { useId, useState } from 'react'
import { passageReferenceChoices, passageSelectionChoices, type PassageReference } from '../../packages/bible-reference/range.js'
import './passage-reference.css'

export type ResolvedPassage = PassageReference & { bookId: string }
export default function PassageReferenceInput({ books, onResolve, onValidityChange, singleChapter = false, allowVerseList = false, label = 'Passage shortcut' }: {
  books: readonly { id: string; name: string }[]; onResolve: (passage: ResolvedPassage) => void
  onValidityChange?: (valid: boolean) => void; singleChapter?: boolean; allowVerseList?: boolean; label?: string
}) {
  const parse = allowVerseList ? passageSelectionChoices : passageReferenceChoices
  const id = useId()
  const [value, setValue] = useState('')
  const [selected, setSelected] = useState('')
  const choices = parse(value).map(choice => ({ ...choice,
    bookId: books.find(book => book.name === choice.book)?.id || '',
    invalidReason: choice.invalidReason || (singleChapter && choice.startChapter !== choice.endChapter ? 'Add each chapter as a separate reading.' : ''),
  }))
  function resolve(choice: ResolvedPassage) {
    if (!choice.bookId || choice.invalidReason) return
    setSelected(choice.book); onResolve(choice); onValidityChange?.(true)
  }
  const current = choices.find(choice => choice.book === selected)
  return <div className="heritage-passage-shortcut">
    <label htmlFor={id}>{label}</label>
    <input id={id} type="text" autoComplete="off" placeholder="1 chr 3 7-10" value={value} aria-describedby={`${id}-hint`} onChange={event => {
      const next = event.target.value; setValue(next); setSelected(''); onValidityChange?.(!next.trim())
      const candidates = parse(next)
      if (candidates.length === 1) {
        const choice = candidates[0], bookId = books.find(book => book.name === choice.book)?.id
        if (bookId && !choice.invalidReason && (!singleChapter || choice.startChapter === choice.endChapter)) resolve({ ...choice, bookId })
      }
    }} />
    <small id={`${id}-hint`} role="status">{current?.verseNumbers ? `${current.book} ${current.startChapter}:${current.verseNumbers.join(',')}` : current ? `${current.book} ${current.startChapter}:${current.startVerse}${current.endVerse === current.startVerse && current.endChapter === current.startChapter ? '' : `–${current.endChapter !== current.startChapter ? `${current.endChapter}:` : ''}${current.endVerse}`}`
      : !value.trim() ? allowVerseList ? 'Heritage shortcuts work here, including John 8:31-32,44.' : 'Use Heritage shortcuts, or choose the book and verses below.'
        : choices.length > 1 ? 'Which book did you mean?' : choices[0]?.invalidReason || 'Enter a book, chapter and verse, for example Joh 3:16 or 1 chr 3 7-10.'}</small>
    {!current && choices.length > 1 && <div className="heritage-passage-shortcut__choices">{choices.map(choice => <button key={choice.book} type="button" disabled={!choice.bookId || Boolean(choice.invalidReason)} title={choice.invalidReason || undefined} onClick={() => resolve(choice)}>{choice.book}{choice.invalidReason && <small>{choice.invalidReason}</small>}</button>)}</div>}
  </div>
}

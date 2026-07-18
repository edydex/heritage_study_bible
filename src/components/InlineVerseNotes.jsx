import { getAnnotationVerses } from '../utils/verseAnnotations'

export function getInlineNotesAfterVerse(notes, book, chapter, verse, translationId) {
  return (Array.isArray(notes) ? notes : []).filter(note => {
    if (note.inline !== true) return false
    if (note.translationId && note.translationId !== translationId) return false
    const verses = getAnnotationVerses(note).slice().sort((left, right) =>
      left.book.localeCompare(right.book)
      || left.chapter - right.chapter
      || left.verse - right.verse
    )
    const last = verses[verses.length - 1]
    return last?.book === book && last.chapter === Number(chapter) && last.verse === Number(verse)
  })
}

export default function InlineVerseNotes({ notes = [], compact = false }) {
  if (notes.length === 0) return null
  return (
    <div
      className={`${compact ? 'my-2 ml-5' : 'mt-2 ml-4 sm:ml-10'} space-y-2 basis-full`}
      onClick={event => event.stopPropagation()}
    >
      {notes.map(note => (
        <aside
          key={note.id}
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-950 dark:border-green-800 dark:bg-green-950/35 dark:text-green-100"
          aria-label={`Note on ${note.reference || 'selected text'}`}
        >
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">
            <span aria-hidden="true">📝</span>
            <span>{note.reference || 'Study note'}</span>
          </div>
          {note.kind === 'text' && note.selectedText && (
            <p className="mb-1 line-clamp-2 text-xs italic text-green-700/80 dark:text-green-300/80">
              “{note.selectedText}”
            </p>
          )}
          <p className="whitespace-pre-wrap">{note.text}</p>
        </aside>
      ))}
    </div>
  )
}

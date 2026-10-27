import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AudioPlayerControls, useHeritageAudio } from './AudioProvider'
import { AUDIO_CATALOG_CHANGED, audioBooks, bibleAudioTranslations, formatAudioTime, getAudioTrack } from '../../services/audioCatalog'
import { bookListeningProgress } from '../../services/audioProgress'
import ListeningProgress from './ListeningProgress'
import BookAudioPanel from './BookAudioPanel'

export default function AudioLibrary() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const audio = useHeritageAudio()
  const [, setRevision] = useState(0)
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener(AUDIO_CATALOG_CHANGED, refresh); return () => window.removeEventListener(AUDIO_CATALOG_CHANGED, refresh) }, [])
  const [filter, setFilter] = useState('all')
  const progress = audio?.player.getProgress?.() || {}
  const selected = audioBooks.find(book => book.id === params.get('book'))
  const kind = params.get('kind') === 'bible' || params.has('translation') || selected?.kind === 'bible' ? 'bible' : 'audiobook'
  const showBibleBooks = audio?.settings.showBibleBooksInAudiobooks === true
  const bookParams = book => ({ kind: book.kind === 'bible' ? 'bible' : 'audiobook',
    ...(book.kind === 'bible' ? { translation: book.editions[0].tracks[0].bible.translation } : {}), book: book.id })
  const recentBooks = audioBooks.map(book => ({ book, progress: bookListeningProgress(book.id, progress) }))
    .filter(({ book }) => kind === 'bible' ? book.kind === 'bible' : showBibleBooks || book.kind !== 'bible')
    .filter(item => item.progress?.started).sort((a, b) => b.progress.updatedAt - a.progress.updatedAt)
  const lastTrack = getAudioTrack(audio?.state.trackId)
  const translation = bibleAudioTranslations.find(item => item.id === params.get('translation'))
  return <main className="audio-library min-h-screen dark:bg-gray-900">
    <header><button type="button" onClick={() => navigate('/resources/books')}>← Books</button><h1>Audio library</h1><button type="button" onClick={() => navigate('/settings/audio')}>Audio Settings</button><button type="button" onClick={() => navigate('/settings/storage')}>Internal Storage</button></header>
    <AudioPlayerControls defaultExpanded={false} />
    {!selected && recentBooks.length > 0 && <section aria-label="Continue listening" className="continue-listening"><h2>Continue listening</h2>
      {recentBooks.map(({ book, progress: cursor }) => <article className="listening-card" key={book.id}>
        <div className="audio-book-cover" aria-hidden="true">{book.kind === 'bible' ? '✝' : book.title.charAt(0)}</div>
        <div className="listening-card-info"><button type="button" className="listening-book-title" onClick={() => setParams(bookParams(book))}>{book.title}</button><small>{cursor.track.title} · {formatAudioTime(cursor.position)}</small><ListeningProgress progress={cursor} rate={audio?.state.rate} /></div>
        <button type="button" aria-label={`${lastTrack?.bookId === book.id && audio.state.status === 'playing' ? 'Pause' : 'Resume'} ${book.title}`} onClick={() => lastTrack?.bookId === book.id && audio.state.status === 'playing' ? audio.player.pause() : audio.player.play(cursor.track.id)}>{lastTrack?.bookId === book.id && audio.state.status === 'playing' ? 'Ⅱ' : '▶'}</button>
      </article>)}
    </section>}
    {selected ? <><button type="button" onClick={() => { const back = bookParams(selected); delete back.book; setParams(back) }}>← {selected.kind === 'bible' ? 'Bible books' : 'Audio library'}</button><BookAudioPanel key={selected.id} bookId={selected.id} full /></> : <>
      {(showBibleBooks || kind === 'bible') && <div className="audio-actions"><button type="button" aria-pressed={kind === 'bible'} onClick={() => { setParams({ kind: 'bible' }); setQuery('') }}>Bible</button><button type="button" aria-pressed={kind === 'audiobook'} onClick={() => { setParams({ kind: 'audiobook' }); setQuery('') }}>Audiobooks</button></div>}<label htmlFor="audio-search">Search audio library</label><input id="audio-search" className="w-full mt-2" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title or author" />
      {(kind === 'audiobook' || translation) && <div className="audio-actions" aria-label="Listening status">{[['all', 'All titles'], ['started', 'In progress'], ['finished', 'Finished']].map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>}
      {kind === 'bible' && !translation ? bibleAudioTranslations.filter(item => `${item.title} ${item.author} ${item.books.map(book => book.title).join(' ')}`.toLowerCase().includes(query.toLowerCase())).map(item => <section key={item.id}><h2>{item.title}</h2><p>{item.author}</p><p>{item.books.length} books</p><button type="button" onClick={() => { setParams({ kind: 'bible', translation: item.id }); setQuery('') }}>Browse {item.id} books</button></section>) : <>
      {translation && kind === 'bible' && <><button type="button" onClick={() => setParams({ kind: 'bible' })}>← Translations</button><h2 className="mt-4">{translation.title}</h2></>}
      {(kind === 'bible' ? translation?.books || [] : audioBooks.filter(book => book.kind !== 'bible')).filter(book => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())).filter(book => { const cursor = bookListeningProgress(book.id, progress); return filter === 'all' || (filter === 'started' ? cursor?.started && cursor.percent < 100 : cursor?.percent === 100) }).map(book => <section key={book.id}>
        <h2>{book.title}</h2><p>{book.author}</p><ListeningProgress progress={bookListeningProgress(book.id, progress)} rate={audio?.state.rate} /><div className="audio-actions"><button type="button" onClick={() => setParams(bookParams(book))}>Tracks and downloads</button><button type="button" onClick={() => book.kind === 'bible' ? navigate(`/${book.bibleSlug}/1`, { state: { audioTranslation: book.editions[0].tracks[0].bible.translation } }) : navigate(book.community ? `/resources/content/${encodeURIComponent(book.community.contentKey)}` : `/resources/books/${book.textBookId || book.id}`)}>Read</button></div>
      </section>)}</>}
    </>}
  </main>
}

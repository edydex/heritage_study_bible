import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AudioPlayerControls, useHeritageAudio } from './AudioProvider'
import { AUDIO_CATALOG_CHANGED, audioBooks, bibleAudioTranslations, formatAudioTime, getAudioTrack } from '../../services/audioCatalog'
import BookAudioPanel from './BookAudioPanel'

export default function AudioLibrary() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('bible')
  const audio = useHeritageAudio()
  const [, setRevision] = useState(0)
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener(AUDIO_CATALOG_CHANGED, refresh); return () => window.removeEventListener(AUDIO_CATALOG_CHANGED, refresh) }, [])
  const lastTrack = getAudioTrack(audio?.state.trackId)
  const translation = bibleAudioTranslations.find(item => item.id === params.get('translation'))
  const selected = audioBooks.find(book => book.id === params.get('book'))
  return <main className="audio-library min-h-screen dark:bg-gray-900">
    <header><button type="button" onClick={() => navigate('/resources/books')}>← Books</button><h1>Audio library</h1><button type="button" onClick={() => navigate('/settings/audio')}>Audio Settings</button><button type="button" onClick={() => navigate('/settings/storage')}>Internal Storage</button></header>
    <AudioPlayerControls />
    {lastTrack && <section><h2>Continue listening</h2><p>{lastTrack.bookTitle} · {lastTrack.title}</p><button type="button" onClick={() => audio.player.play()}>{audio.state.status === 'playing' ? 'Playing' : `Resume at ${formatAudioTime(audio.state.position)}`}</button></section>}
    {selected ? <><button type="button" onClick={() => setParams(selected.kind === 'bible' ? { translation: selected.editions[0].tracks[0].bible.translation } : {})}>← {selected.kind === 'bible' ? 'Bible books' : 'Audio library'}</button><BookAudioPanel key={selected.id} bookId={selected.id} full /></> : <>
      <div className="audio-actions"><button type="button" aria-pressed={kind === 'bible'} onClick={() => setKind('bible')}>Bible</button><button type="button" aria-pressed={kind === 'audiobook'} onClick={() => setKind('audiobook')}>Audiobooks</button></div><label htmlFor="audio-search">Search audio library</label><input id="audio-search" className="w-full mt-2" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title or author" />
      {kind === 'bible' && !translation ? bibleAudioTranslations.filter(item => `${item.title} ${item.author} ${item.books.map(book => book.title).join(' ')}`.toLowerCase().includes(query.toLowerCase())).map(item => <section key={item.id}><h2>{item.title}</h2><p>{item.author}</p><p>{item.books.length} books</p><button type="button" onClick={() => { setParams({ translation: item.id }); setQuery('') }}>Browse {item.id} books</button></section>) : <>
      {translation && kind === 'bible' && <><button type="button" onClick={() => setParams({})}>← Translations</button><h2 className="mt-4">{translation.title}</h2></>}
      {(kind === 'bible' ? translation?.books || [] : audioBooks.filter(book => book.kind !== 'bible')).filter(book => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())).map(book => <section key={book.id}>
        <h2>{book.title}</h2><p>{book.author}</p><div className="audio-actions"><button type="button" onClick={() => setParams({ ...(translation ? { translation: translation.id } : {}), book: book.id })}>Tracks and downloads</button><button type="button" onClick={() => book.kind === 'bible' ? navigate(`/${book.bibleSlug}/1`, { state: { audioTranslation: book.editions[0].tracks[0].bible.translation } }) : navigate(book.community ? `/resources/content/${encodeURIComponent(book.community.contentKey)}` : `/resources/books/${book.textBookId || book.id}`)}>Read</button></div>
      </section>)}</>}
    </>}
  </main>
}

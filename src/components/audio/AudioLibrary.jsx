import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHeritageAudio } from './AudioProvider'
import { audioBooks, formatAudioTime, getAudioTrack } from '../../services/audioCatalog'
import BookAudioPanel from './BookAudioPanel'

export default function AudioLibrary() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const audio = useHeritageAudio()
  const lastTrack = getAudioTrack(audio?.state.trackId)
  const selected = audioBooks.find(book => book.id === params.get('book'))
  return <main className="audio-library min-h-screen dark:bg-gray-900">
    <header><button type="button" onClick={() => navigate('/resources/books')}>← Books</button><h1>Audio library</h1><button type="button" onClick={() => navigate('/settings/storage')}>Internal Storage</button></header>
    {lastTrack && <section><h2>Continue listening</h2><p>{lastTrack.bookTitle} · {lastTrack.title}</p><button type="button" onClick={() => audio.player.play()}>{audio.state.status === 'playing' ? 'Playing' : `Resume at ${formatAudioTime(audio.state.position)}`}</button></section>}
    {selected ? <><button type="button" onClick={() => setParams({})}>← All audiobooks</button><BookAudioPanel key={selected.id} bookId={selected.id} full /></> : <>
      <label htmlFor="audio-search">Search audiobooks</label><input id="audio-search" className="w-full mt-2" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title or author" />
      {audioBooks.filter(book => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())).map(book => <section key={book.id}>
        <h2>{book.title}</h2><p>{book.author}</p><div className="audio-actions"><button type="button" onClick={() => setParams({ book: book.id })}>Tracks and downloads</button><button type="button" onClick={() => navigate(`/resources/books/${book.id}`)}>Read</button></div>
      </section>)}
    </>}
  </main>
}

import SongLyrics from '../../../../../packages/song-text/SongLyrics.jsx'
import { parseSongLyrics } from '../../../../../packages/song-text/index.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadPublicSong } from '@/lib/publicSite'
import { songbookLanguage } from '@/lib/songbookSearch'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

export default async function SongPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = await searchParams
  const language = songbookLanguage(query.lang)
  const russian = language === 'ru'
  const result = await loadPublicSong(id)
  if (!result) notFound()
  const { song, content } = result
  const back = new URLSearchParams({ lang: language, ...(typeof query.q === 'string' ? { q: query.q } : {}) })
  const versions = [
    { language: 'en', title: song.title, lyrics: content.lyrics, chords: content.chordSheet },
    { language: 'ru', title: song.russianTitle || song.title, lyrics: content.russianLyrics, chords: content.russianChordSheet },
  ].sort((a, b) => Number(b.language === language) - Number(a.language === language))
  return <main className="site-main song-detail">
    <Link className="songbook-back" href={`/songs?${back}`}>{russian ? '← Все песни' : '← All songs'}</Link>
    <header className="page-heading">
      <p className="eyebrow">{russian ? 'Песни церкви' : 'Church songbook'}</p>
      <h1>{russian && song.russianTitle ? song.russianTitle : song.title}</h1>
      {song.authors.length ? <p>{song.authors.join(', ')}</p> : null}
    </header>
    <div className="lyrics-languages">
      {versions.filter(version => version.lyrics || version.chords).map(version => <article key={version.language} lang={version.language}>
        <header><span>{version.language.toUpperCase()}</span><h2>{version.title}</h2></header>
        {version.lyrics ? <SongLyrics sections={parseSongLyrics(version.lyrics, { language: version.language })} language={version.language} /> : null}
        {version.chords ? <details><summary>{version.language === 'ru' ? 'Аккорды' : 'Chords'}</summary><pre className="songbook-chords">{version.chords}</pre></details> : null}
        {(content.copyright || content.license) && <footer>{[content.copyright, content.license].filter(Boolean).join(' · ')}</footer>}
      </article>)}
    </div>
    {!content.lyrics && !content.russianLyrics && <p>{russian ? 'Церковь пока не добавила слова этой песни.' : 'The church has not added lyrics for this song yet.'}</p>}
  </main>
}

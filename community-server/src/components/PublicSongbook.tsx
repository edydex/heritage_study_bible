'use client'
import Link from 'next/link'
import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { groupSongbook, songbookLanguage, songbookTitle, type SongbookEntry } from '@/lib/songbookSearch'

export default function PublicSongbook({ songs }: { songs: SongbookEntry[] }) {
  const params = useSearchParams()
  const language = songbookLanguage(params.get('lang'))
  const query = params.get('q') || ''
  const russian = language === 'ru'
  const groups = useMemo(() => groupSongbook(songs, language, query), [songs, language, query])
  const count = groups.reduce((n, group) => n + group.songs.length, 0)
  function update(key: string, value: string) {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
    window.history.replaceState(null, '', url.pathname + url.search)
  }
  return <section className="public-songbook" lang={language}>
    <div className="public-songbook__tools">
      <div className="public-songbook__languages" role="group" aria-label="Song language">
        <button type="button" lang="ru" aria-pressed={russian} onClick={() => update('lang', 'ru')}>Русский</button>
        <button type="button" lang="en" aria-pressed={!russian} onClick={() => update('lang', 'en')}>English</button>
      </div>
      <label className="public-songbook__search">
        <span>{russian ? 'Поиск песен' : 'Search songs'}</span>
        <div><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg>
          <input type="search" aria-label={russian ? 'Поиск песен' : 'Search songs'} value={query} autoComplete="off" placeholder={russian ? 'Название или автор…' : 'Title or author…'} onChange={event => update('q', event.target.value)} />
          {query && <button type="button" onClick={() => update('q', '')} aria-label={russian ? 'Очистить поиск' : 'Clear search'}>×</button>}
        </div>
      </label>
      <p className="public-songbook__hint">{russian ? 'Поиск по русским и английским названиям.' : 'Search English and Russian titles, including alternate names.'}</p>
    </div>
    <p className="public-songbook__count" role="status">{russian ? `Найдено песен: ${count}` : `${count} ${count === 1 ? 'song' : 'songs'}`}</p>
    {groups.length ? groups.map(group => <section className="public-songbook__group" key={group.letter} aria-label={group.letter}>
      <h2>{group.letter}</h2>
      <ul>{group.songs.map(song => <li key={song.id}>
        <Link href={`/songs/${encodeURIComponent(song.slug)}?${new URLSearchParams({ lang: language, ...(query ? { q: query } : {}) })}`}>
          <span className="public-songbook__title">{song.displayTitle}</span>
          <span className="public-songbook__badges">
            {songbookTitle(song, 'en') && <span lang="en" aria-label="English title available">EN</span>}
            {songbookTitle(song, 'ru') && <span lang="en" aria-label="Russian title available">RU</span>}
          </span>
          <span className="public-songbook__arrow" aria-hidden="true">↗</span>
        </Link>
      </li>)}</ul>
    </section>) : <div className="public-songbook__empty">
      <h2>{russian ? 'Песни не найдены' : 'No songs found'}</h2>
      <p>{songs.length === 0 ? (russian ? 'Здесь появятся песни, опубликованные церковью.' : 'The church’s songs will appear here as they are published.') : query ? (russian ? 'Попробуйте другое название или очистите поиск.' : 'Try another title or clear the search.') : (russian ? 'Опубликованных песен на русском пока нет. Попробуйте English.' : 'No English songs have been published yet. Try Русский.')}</p>
    </div>}
  </section>
}

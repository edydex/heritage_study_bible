import Link from 'next/link'
import { loadPublicSongs } from '@/lib/publicSite'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Songs' }

export default async function SongsPage() {
  const songs = await loadPublicSongs().catch(() => [])
  return (
    <main className="site-main page-stack">
      <header className="page-heading">
        <p className="eyebrow">Church songbook</p>
        <h1>Songs we sing</h1>
        <p>Every song title in our library is listed. Lyrics appear only when the church has approved them for public sharing.</p>
      </header>
      {songs.length ? <div className="song-grid">
        {songs.map(song => <Link key={song.id} href={`/songs/${encodeURIComponent(song.slug)}`}>
          <span className="song-grid__letter">{song.title.slice(0, 1).toUpperCase()}</span>
          <span><strong>{song.title}</strong>{song.russianTitle && song.russianTitle !== song.title ? <small>{song.russianTitle}</small> : null}</span>
          <span aria-hidden="true">→</span>
        </Link>)}
      </div> : <div className="empty-state"><h2>No songs yet</h2><p>The church song library will appear here.</p></div>}
    </main>
  )
}

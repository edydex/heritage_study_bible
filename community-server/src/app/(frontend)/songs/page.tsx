import { loadPublicSongs } from '@/lib/publicSite'
import PublicSongbook from '@/components/PublicSongbook'
export const dynamic = 'force-dynamic'
export default async function SongsPage() {
  const songs = await loadPublicSongs()
  return <main className="site-main songbook-page">
    <header className="page-heading"><p className="eyebrow">Church songbook</p><h1>Songs we sing</h1>
      <p>Find a song in English or Russian.</p></header>
    <PublicSongbook songs={songs} />
  </main>
}

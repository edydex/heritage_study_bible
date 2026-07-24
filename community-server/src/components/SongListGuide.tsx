export default function SongListGuide() {
  return (
    <section className="heritage-song-guide">
      <div>
        <p className="heritage-admin-eyebrow">Songbook</p>
        <h2>One listing, both languages</h2>
        <p>
          Start with the English and Russian titles. Lyrics, chords, scores, and recordings are optional,
          so a song can be listed before every file is ready.
        </p>
      </div>
      <a className="heritage-song-add" href="/admin/collections/songs/create">Add a song</a>
    </section>
  )
}

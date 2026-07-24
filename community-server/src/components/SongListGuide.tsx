export default function SongListGuide() {
  return (
    <section className="heritage-song-guide">
      <div>
        <p className="heritage-admin-eyebrow">Songbook</p>
        <h2>One listing, every available version</h2>
        <p>
          Start with the English and Russian titles. Lyrics, chords, scores, and recordings are optional.
          Add source notes when you know them; the editor will not make the publishing decision for your church.
        </p>
      </div>
      <a className="heritage-song-add" href="/admin/collections/songs/create">Add a song</a>
    </section>
  )
}

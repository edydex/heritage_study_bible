export default function SongListGuide() {
  return (
    <section className="heritage-song-guide">
      <div>
        <p className="heritage-admin-eyebrow">Songbook</p>
        <h2>Choose what your church shares</h2>
        <p>
          Published songs appear on the church website and in Heritage Bible Songs. Unlisted songs
          work through a direct link. Private songs stay in the church workspace. Click a song’s
          publication setting in the list to change it; your choice saves immediately. Select several
          rows and use Edit to change them together.
        </p>
      </div>
      <a className="heritage-song-add" href="/admin/collections/songs/create">Add a song</a>
    </section>
  )
}

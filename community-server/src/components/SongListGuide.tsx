'use client'
import {useEffect, useRef, useState} from 'react'
import {useListQuery} from '@payloadcms/ui'

export default function SongListGuide() {
  const {query, handleSearchChange} = useListQuery()
  const current = typeof query?.search === 'string' ? query.search : ''
  const [search, setSearch] = useState(current)
  const requested = useRef(current)
  useEffect(() => {requested.current=current; setSearch(current)}, [current])
  useEffect(() => {
    if (search === requested.current) return
    const timer = setTimeout(() => {requested.current=search; void handleSearchChange?.(search)}, 300)
    return () => clearTimeout(timer)
  }, [search, handleSearchChange])
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
        <div className="heritage-song-search" role="search">
          <label htmlFor="song-library-search">Search songs
            <input id="song-library-search" type="search" placeholder="English or Russian title, alternate title, or author…" value={search} onChange={event=>setSearch(event.target.value)} />
          </label>
          {search && <button type="button" onClick={()=>setSearch('')}>Clear search</button>}
        </div>
      </div>
      <a className="heritage-song-add" href="/admin/collections/songs/create">Add a song</a>
    </section>
  )
}

'use client'
import {useEffect, useRef, useState} from 'react'
import {useListQuery} from '@payloadcms/ui'
import {archivedSongLibraryView, songLibraryViewWhere} from '../lib/songLibraryView'
import {useWorkspaceText} from './useWorkspaceText'

export default function SongListGuide() {
  const {query, handleSearchChange, refineListData} = useListQuery()
  const t = useWorkspaceText()
  const archived = archivedSongLibraryView(query?.where)
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
        <p className="heritage-admin-eyebrow">{t('Song library')}</p>
        <h2>{t(archived?'Archived songs':'Active songs')}</h2>
        <p>{t(archived?'Open a song and choose Restore to library in its ⋮ menu. Restored songs are Private until you publish them.'
          :'Open a song to edit it. To remove it, choose Delete from library in its ⋮ menu. Saved services keep their slides.')}</p>
        <div className="heritage-song-library-views" aria-label={t('Library view')}>
          {[false,true].map(value=><button key={String(value)} type="button" aria-pressed={archived===value}
            onClick={()=>void refineListData({where:songLibraryViewWhere(query?.where,value),page:1})}>{t(value?'Archived songs':'Active songs')}</button>)}
        </div>
        <div className="heritage-song-search" role="search">
          <label htmlFor="song-library-search">{t('Search songs')}
            <input id="song-library-search" type="search" placeholder={t('English or Russian title, alternate title, or author…')} value={search} onChange={event=>setSearch(event.target.value)} />
          </label>
          {search && <button type="button" onClick={()=>setSearch('')}>{t('Clear search')}</button>}
        </div>
      </div>
      <a className="heritage-song-add" href="/admin/collections/songs/create">{t('Add a song')}</a>
    </section>
  )
}

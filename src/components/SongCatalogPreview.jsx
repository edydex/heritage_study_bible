import { useCallback } from 'react'
import SongPreview from '../../community-server/packages/song-text/SongPreview.jsx'
import { loadMergedSong } from '../services/songCatalog.js'

export default function SongCatalogPreview({ item, children }) {
  const load = useCallback(async signal => {
    const song = await loadMergedSong(item.id)
    signal.throwIfAborted()
    return ['en', 'ru'].flatMap(language => {
      const section = song?.languages?.[language]?.[0]?.sections?.[0]
      return section ? [{ ...section, language }] : []
    })
  }, [item.id])
  return <SongPreview title={item.title} loadSections={load} block>{children}</SongPreview>
}

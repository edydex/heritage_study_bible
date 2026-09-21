'use client'
import { DefaultCell, useConfig } from '@payloadcms/ui'
import { useCallback } from 'react'
import type { DefaultCellComponentProps } from 'payload'
import SongPreview from '../../packages/song-text/SongPreview.jsx'
import { firstSongSections } from '../../packages/song-text/index.js'

export default function SongTitleCell(props: DefaultCellComponentProps) {
  const { config } = useConfig()
  const language = 'name' in props.field && props.field.name === 'russianTitle' ? 'ru' : undefined
  const load = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`${config.routes.api}/songs/${encodeURIComponent(props.rowData.id)}?depth=0`, { credentials:'same-origin', cache:'no-store', signal:AbortSignal.any([signal,AbortSignal.timeout(5000)]) })
    if (!response.ok) throw new Error('Song preview unavailable')
    return firstSongSections(await response.json(), language)
  }, [config.routes.api, props.rowData.id, language])
  return <SongPreview key={props.rowData.id} title={String(props.cellData || props.rowData.title || 'Song')} loadSections={load}><DefaultCell {...props} /></SongPreview>
}

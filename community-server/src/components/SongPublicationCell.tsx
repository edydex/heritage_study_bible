'use client'

import { useAuth, useConfig } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps, SelectFieldClient } from 'payload'
import { useEffect, useRef, useState } from 'react'
import { songPublicationChange, songPublicationChoice, type SongPublicationChoice } from '../lib/songPublicationChoice'
import { useWorkspaceText } from './useWorkspaceText'

type Visibility = SongPublicationChoice
const labels: Record<Visibility, string> = {
  published: 'Published', unlisted: 'Unlisted', private: 'Private', archived: 'Archived',
}
const normalize = (value: unknown): Visibility => value === 'archived' || value === 'published' || value === 'unlisted' ? value : 'private'

export default function SongPublicationCell({ cellData, rowData }: DefaultCellComponentProps<SelectFieldClient>) {
  const t = useWorkspaceText()
  const archived = rowData.status === 'archived'
  const [value, setValue] = useState<Visibility>(songPublicationChoice(cellData, rowData.status))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const { permissions } = useAuth()
  const { config } = useConfig()
  const router = useRouter()
  const title = String(rowData.title || `Song ${rowData.id}`)
  const editable = Boolean(permissions?.collections?.songs?.update)

  useEffect(() => {
    setValue(songPublicationChoice(cellData, rowData.status))
  }, [cellData, rowData.id, archived])

  async function save(next: Visibility) {
    if (pending.current || next === value || !editable) return
    const previous = value
    pending.current = true
    setSaving(true)
    setValue(next)
    setError('')
    setMessage('Saving…')
    try {
      const response = await fetch(`${config.routes.api}/songs/${encodeURIComponent(rowData.id)}?depth=0`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songPublicationChange(next)),
        signal: AbortSignal.timeout(20000),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.errors?.[0]?.message || 'Could not save this publication setting.')
      }
      if (!result.doc || !(result.doc.songbookVisibility in labels)) {
        throw new Error('The server did not confirm the change. Reload the list to check it.')
      }
      const saved = songPublicationChoice(result.doc.songbookVisibility, result.doc.status)
      setValue(saved)
      setMessage('Saved')
      router.refresh()
    } catch (cause) {
      setValue(previous)
      setMessage('')
      setError(cause instanceof Error && cause.name === 'Error'
        ? cause.message : 'Could not confirm the change. Check your connection and reload the list.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return <div className="heritage-song-publication-cell" onClick={event => event.stopPropagation()}>
    <select
      aria-label={`Songbook publication for ${title}`}
      aria-busy={saving}
      disabled={!editable || saving}
      title={t('Choose a publication setting. Changes save immediately.')}
      value={value}
      onChange={event => void save(normalize(event.target.value))}
    >
      {Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}
    </select>
    {message && <small role="status">{message}</small>}
    {error && <small role="alert">{error}</small>}
  </div>
}

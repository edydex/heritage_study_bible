'use client'

import { useAuth, useConfig } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps, SelectFieldClient } from 'payload'
import { useEffect, useRef, useState } from 'react'

type Visibility = 'en' | 'ru'
const labels: Record<Visibility, string> = {
  en: 'English', ru: 'Russian',
}
const normalize = (value: unknown): Visibility => value === 'en' ? 'en' : 'ru'

export default function SongLanguageCell({ cellData, rowData }: DefaultCellComponentProps<SelectFieldClient>) {
  const archived = rowData.status === 'archived'
  const [value, setValue] = useState<Visibility>(normalize(cellData))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const { permissions } = useAuth()
  const { config } = useConfig()
  const router = useRouter()
  const title = String(rowData.title || `Song ${rowData.id}`)
  const editable = Boolean(permissions?.collections?.songs?.update) && !archived

  useEffect(() => {
    setValue(normalize(cellData))
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
        body: JSON.stringify({ defaultSongLanguage: next }),
        signal: AbortSignal.timeout(20000),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.errors?.[0]?.message || 'Could not save this default language.')
      }
      if (!result.doc || !(result.doc.defaultSongLanguage in labels)) {
        throw new Error('The server did not confirm the change. Reload the list to check it.')
      }
      const saved = normalize(result.doc.defaultSongLanguage)
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
      aria-label={`Default song language for ${title}`}
      aria-busy={saving}
      disabled={!editable || saving}
      title={archived ? 'Open the song to restore it before changing its language.' : 'Choose a default language. Changes save immediately.'}
      value={value}
      onChange={event => void save(normalize(event.target.value))}
    >
      {Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
    {message && <small role="status">{message}</small>}
    {error && <small role="alert">{error}</small>}
  </div>
}

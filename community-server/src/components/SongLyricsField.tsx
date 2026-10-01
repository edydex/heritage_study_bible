'use client'

import { TextareaField, useField, useFormFields } from '@payloadcms/ui'
import type { TextareaFieldClientProps } from 'payload'
import { useLayoutEffect, useRef, useState } from 'react'
import SongLyricsTextarea from './SongLyricsTextarea'
import { SongSectionSuggestionError, suggestEnglishSongSections } from '../lib/songSectionSuggestion'
import { useWorkspaceText } from './useWorkspaceText'

/** Keep Payload's validation and form state; only the textarea's size changes. */
export default function SongLyricsField(props: TextareaFieldClientProps) {
  const root = useRef<HTMLDivElement>(null)
  const value = useFormFields(([fields]) => fields[props.path]?.value)
  const russian = useFormFields(([fields]) => fields.russianLyrics?.value)
  const { setValue } = useField<string>({ path: props.path })
  const t = useWorkspaceText()
  const [suggestion, setSuggestion] = useState<{ text: string; russian: string; english: string } | null>(null)
  const [error, setError] = useState<{key: string; variables?: Record<string, string | number>} | null>(null)
  const stale = suggestion && (suggestion.russian !== russian || suggestion.english !== value)
  useLayoutEffect(() => {
    const textarea = root.current?.querySelector('textarea')
    if (!textarea) return
    const resize = () => {
      if (!textarea.clientWidth) return // Chords can be mounted inside a closed panel.
      textarea.style.height = 'auto'
      const border = textarea.offsetHeight - textarea.clientHeight
      textarea.style.height = `${textarea.scrollHeight + border}px`
    }
    resize()
    // Observe width changes, not our own textarea height changes.
    let width = root.current!.clientWidth
    const widthObserver = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width
      if (next !== width) { width = next; resize() }
    })
    widthObserver.observe(root.current!)
    return () => widthObserver.disconnect()
  }, [value])
  return <div ref={root} className="heritage-song-lyrics"><TextareaField {...props} />
    {props.path === 'lyrics' && !props.readOnly && <div className="heritage-song-section-assist">
      <button type="button" disabled={!value || !russian} onClick={() => {
        try { const result = suggestEnglishSongSections(String(russian || ''), String(value || '')); setSuggestion({ text: result.text, russian: String(russian), english: String(value) }); setError(null) }
        catch (caught) { setSuggestion(null); setError(caught instanceof SongSectionSuggestionError ? caught : {key: caught instanceof Error ? caught.message : 'Could not match sections.'}) }
      }}>{t('Match Russian sections')}</button>
      {!suggestion && !error && <small>{t('Suggest English verse, chorus and slide breaks from Russian. You review before applying.')}</small>}
      {error && <p role="status">{t(error.key, error.variables)}</p>}
      {suggestion && <div className="heritage-song-section-suggestion">
        <label htmlFor="english-section-suggestion">{t('Suggested English sections')}</label>
        <small>{t('Based on line counts. Check that the words match each verse and chorus; edit anything here before confirming.')}</small>
        <SongLyricsTextarea id="english-section-suggestion" value={suggestion.text} onChange={event => setSuggestion({ ...suggestion, text: event.target.value })} />
        {stale && <p role="status">{t('Lyrics changed. Match sections again for a fresh suggestion.')}</p>}
        <div><button type="button" disabled={Boolean(stale) || !suggestion.text.trim()} onClick={() => { setValue(suggestion.text); setSuggestion(null) }}>{t('Confirm sections')}</button>
          <button type="button" onClick={() => { setSuggestion(null); setError(null) }}>{t('Cancel')}</button></div>
      </div>}
    </div>}
  </div>
}

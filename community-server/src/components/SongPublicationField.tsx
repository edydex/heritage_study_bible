'use client'
import { useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import type { SelectFieldClientProps } from 'payload'
import { songPublicationChange, songPublicationChoice, type SongPublicationChoice } from '../lib/songPublicationChoice'
import { useWorkspaceText } from './useWorkspaceText'

const descriptions = {
  published: 'Visible in the church songbook and Heritage Songs.',
  unlisted: 'Available through its link. Hidden from the songbook and search.',
  private: 'Available only in the church workspace. Public links are withdrawn.',
  archived: 'Removed from the active library and public pages. Choose another option to restore it.',
}
export default function SongPublicationField({ path, readOnly }: SelectFieldClientProps) {
  const t = useWorkspaceText()
  const { id } = useDocumentInfo()
  const slug = useFormFields(([fields]) => fields.slug?.value)
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  const archive = useField<string>({ path: 'status' })
  const choice = songPublicationChoice(value, archive.value)
  return <div className="heritage-song-publication">
    <label htmlFor={`field-${path}`}>{t('Songbook publication')}</label>
    <select id={`field-${path}`} disabled={Boolean(readOnly)} value={choice} onChange={event => {
      const change = songPublicationChange(event.target.value as SongPublicationChoice)
      archive.setValue(change.status)
      setValue(change.songbookVisibility)
    }}>
      {(['published', 'unlisted', 'private', 'archived'] as const).map(value => <option key={value} value={value}>{t(value[0].toUpperCase() + value.slice(1))}</option>)}
    </select>
    <p>{t(descriptions[choice])}</p>
    <small>{t('Save to apply. Files and internal notes stay private.')}</small>
    {id && choice !== 'private' && choice !== 'archived' && typeof slug === 'string' && slug && <a href={`/songs/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer">{t('Open song link')} ↗</a>}
    {showError && <p role="alert">{errorMessage}</p>}
  </div>
}

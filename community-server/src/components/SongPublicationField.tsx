'use client'
import { useField, useFormFields } from '@payloadcms/ui'
import type { SelectFieldClientProps } from 'payload'

const choices = [
  ['published', 'Published', 'Show in the church songbook and Heritage Bible Songs.'],
  ['unlisted', 'Unlisted', 'Anyone with the direct link can read it. Hidden from browsing and search.'],
  ['private', 'Private', 'Keep the title and lyrics in the church workspace. Withdraw existing public links.'],
] as const

export default function SongPublicationField({ path, readOnly }: SelectFieldClientProps) {
  const slug = useFormFields(([fields]) => fields.slug?.value)
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  return <fieldset className="heritage-song-publication" id={`field-${path}`} disabled={Boolean(readOnly)}>
    <legend>Songbook publication</legend>
    {choices.map(([id, label, description]) => <label key={id}>
      <input type="radio" name={path} value={id} checked={value === id} onChange={() => setValue(id)} />
      <span><strong>{label}</strong><small>{description}</small></span>
    </label>)}
    <p>Save to apply. Publishing shares the current English and Russian lyrics and chord text; files and internal notes stay private.</p>
    {value !== 'private' && typeof slug === 'string' && slug && <a href={`/songs/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer">Open public copy / sharing link ↗</a>}
    {showError && <p role="alert">{errorMessage}</p>}
  </fieldset>
}

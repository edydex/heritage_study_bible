'use client'

import { TextField, useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'
import { useEffect, useRef, useState } from 'react'
import { slugifySongTitle } from '../lib/contentAdmin'
import { useWorkspaceText } from './useWorkspaceText'

export default function SongSlugField(props: TextFieldClientProps) {
  const t = useWorkspaceText()
  const { id } = useDocumentInfo()
  const title = useFormFields(([fields]) => fields.title?.value)
  const { value, setValue } = useField<string>({ path: props.path })
  const generated = slugifySongTitle(title)
  const previous = useRef(value || '')
  const [automatic, setAutomatic] = useState(() => !id && !value)

  useEffect(() => {
    // Existing links remain stable when a title changes. A manual edit on a new
    // song also takes precedence over the automatically generated address.
    if (id) { if (automatic) setAutomatic(false); return }
    if (!automatic || props.readOnly) return
    if (value && value !== previous.current) { setAutomatic(false); return }
    previous.current = generated
    if (value !== generated) setValue(generated)
  }, [automatic, generated, value, setValue, props.readOnly, id])

  return <div className="heritage-song-slug">
    <TextField {...props} field={{ ...props.field, label: { en: 'Web address name', ru: 'Имя в веб-адресе' }, admin: { ...props.field.admin, description: undefined } }} />
    <small>{t(automatic ? 'Follows the English title until you edit it.' : 'This name is used in the song’s public link.')}</small>
    {!props.readOnly && !automatic && generated && value !== generated && <button type="button" onClick={() => { previous.current = generated; setValue(generated); setAutomatic(!id) }}>{t('Use English title')}</button>}
  </div>
}

'use client'

import { RowField, useFormFields } from '@payloadcms/ui'
import type { RowFieldClientProps } from 'payload'
import { useState } from 'react'
import { useWorkspaceText } from './useWorkspaceText'

export default function SongChordsRow(props: RowFieldClientProps) {
  const t = useWorkspaceText()
  const [open, setOpen] = useState(false)
  const hasChords = useFormFields(([fields]) => Boolean(fields.chordSheet?.value || fields.russianChordSheet?.value))
  return <section className="heritage-song-chords">
    <button type="button" className="heritage-song-disclosure" aria-expanded={open} aria-controls="song-chords" onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">{open ? '−' : '+'}</span> {t(open ? 'Hide chords' : hasChords ? 'Show chords' : 'Add Chords')}
    </button>
    <div id="song-chords" hidden={!open}>
      <p>{t('Optional. Use square brackets for chords, for example [G]Amazing [C]grace.')}</p>
      <RowField {...props} />
    </div>
  </section>
}

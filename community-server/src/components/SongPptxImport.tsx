'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'
import { useRef, useState } from 'react'
import { draftSongPptx, inspectSongPptx, SongPptxImportError, type SongPptxDraft, type SongPptxInspection } from '../lib/songPptxImport'
import { useWorkspaceText } from './useWorkspaceText'

const fieldNames = ['russianTitle', 'title', 'russianLyrics', 'lyrics', 'authors', 'defaultSongLanguage'] as const
type SongValues = Record<typeof fieldNames[number], any>
const signature = (values: SongValues) => JSON.stringify(fieldNames.map(name => values[name] ?? null))
const hasText = (values: SongValues) => fieldNames.slice(0, 4).some(name => String(values[name] || '').trim()) || Boolean(values.authors?.length)
type ImportState = { inspection: SongPptxInspection; firstIsTitle: boolean; applied?: string; before?: SongValues }

export default function SongPptxImport(props: UIFieldClientProps) {
  const t = useWorkspaceText(), input = useRef<HTMLInputElement>(null), root = useRef<HTMLElement>(null), button = useRef<HTMLButtonElement>(null)
  const fields = {
    russianTitle: useField<string>({path:'russianTitle'}), title: useField<string>({path:'title'}),
    russianLyrics: useField<string>({path:'russianLyrics'}), lyrics: useField<string>({path:'lyrics'}),
    authors: useField<string[]>({path:'authors'}), defaultSongLanguage: useField<string>({path:'defaultSongLanguage'}),
  }
  const snapshot = useFormFields(([form]) => signature(Object.fromEntries(fieldNames.map(name => [name, form[name]?.value])) as SongValues))
  const current = useRef({ values: {} as SongValues, snapshot: '' })
  current.current = { values: Object.fromEntries(fieldNames.map(name => [name, fields[name].value])) as SongValues, snapshot }
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [importState, setImport] = useState<ImportState | null>(null)
  const draft = importState ? draftSongPptx(importState.inspection, importState.firstIsTitle) : null
  function write(values: SongValues) {
    fieldNames.forEach(name => fields[name].setValue(values[name] ?? (name === 'authors' ? [] : name === 'defaultSongLanguage' ? 'ru' : '')))
  }
  function apply(state: ImportState, next: SongPptxDraft) {
    const before = structuredClone(current.current.values)
    const values: SongValues = {
      russianTitle: next.russianTitle, title: next.title, russianLyrics: next.russianLyrics, lyrics: next.lyrics, authors: next.authors,
      defaultSongLanguage: hasText(before) ? before.defaultSongLanguage : next.defaultSongLanguage,
    }
    write(values)
    setImport({...state, applied: signature(values), before})
    root.current?.closest('form')?.querySelector<HTMLInputElement>('[id="field-title"]')?.focus()
  }
  if (props.readOnly) return null
  return <section ref={root} className="heritage-song-pptx" aria-label={t('Import song from PowerPoint')}>
    <input ref={input} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" aria-label={t('Choose song PowerPoint')} hidden disabled={busy} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (!file) return
      const started = current.current.snapshot
      setBusy(true); setError('')
      try {
        if (file.size > 32 * 1024 * 1024) throw new SongPptxImportError('Choose a PowerPoint file smaller than 32 MB.')
        const inspection = await inspectSongPptx(new Uint8Array(await file.arrayBuffer()), file.name)
        const state = {inspection, firstIsTitle: inspection.firstSlideIsTitle}
        const next = draftSongPptx(inspection)
        if (!hasText(current.current.values) && started === current.current.snapshot && !next.unresolved.length) apply(state, next)
        else setImport(state)
      } catch (caught) { setError(caught instanceof SongPptxImportError ? caught.message : 'Could not read this PowerPoint. Save it as .pptx and try again.') }
      finally { setBusy(false) }
    }} />
    <div className="heritage-song-pptx-intro"><button ref={button} type="button" className="heritage-song-disclosure" disabled={busy} onClick={() => input.current?.click()}>{t(busy ? 'Reading PowerPoint…' : 'Import PowerPoint')}</button>
      <small>{t('Fill titles and lyrics from a song’s slides. Russian and English are separated automatically.')}</small></div>
    {error && <p role="alert">{t(error)}</p>}
    {importState && draft && <div className="heritage-song-pptx-summary">
      <header><strong>{importState.inspection.fileName}</strong><span>{t('{count} lyric slides · slide order and repeats preserved', {count:draft.lyricSlides})}</span></header>
      {importState.applied ? <div className="heritage-song-pptx-result"><p role="status">{t('Filled the song fields below. Review them, then Save.')}</p>
        {snapshot === importState.applied && <button type="button" className="heritage-song-disclosure" onClick={() => { write(importState.before!); setImport(null); button.current?.focus() }}>{t('Undo import')}</button>}</div>
        : <p>{t(hasText(current.current.values) ? 'Replace the titles, lyrics and authors in this form? Other song settings stay as they are.' : 'Choose the language for any uncertain text, then fill the song fields.')}</p>}
      {!!draft.unresolved.length && <div className="heritage-song-pptx-unsorted"><strong>{t('Choose a language for this text')}</strong>
        {draft.unresolved.map((line,index) => <div key={`${line.slide}-${index}`}><span>{t('Slide {number}',{number:line.slide})}: {line.text}</span><div>{(['ru','en','ignore'] as const).map(choice => <button type="button" key={choice} onClick={() => {
          const inspection = structuredClone(importState.inspection), slide = inspection.slides.find(slide => slide.number === line.slide)!
          const at = slide.lines.findIndex(candidate => candidate.language === 'unknown' && candidate.text === line.text)
          if (choice === 'ignore') slide.lines.splice(at,1); else slide.lines[at].language = choice
          setImport({...importState, inspection})
        }}>{t(choice === 'ru' ? 'Russian' : choice === 'en' ? 'English' : 'Skip text')}</button>)}</div></div>)}
      </div>}
      <details><summary>{t('Import details')}</summary>
        <label className="heritage-song-pptx-title-choice"><input type="checkbox" checked={importState.firstIsTitle} onChange={event => {
          const state = {...importState, firstIsTitle:event.target.checked, applied:undefined, before:undefined}
          const next = draftSongPptx(state.inspection,state.firstIsTitle)
          if (importState.applied === snapshot && !next.unresolved.length) apply(state,next); else setImport(state)
        }}/>{t('First slide is the song title')}</label>
        {draft.titleFallback && <p>{t('No English title was found. The original title is used as the library name; no translation is invented.')}</p>}
        {(!draft.lyrics || !draft.russianLyrics) && <p>{t('This file has lyrics in one language. The other lyrics field stays empty.')}</p>}
        {!!draft.sectionLabels.length && <p>{t('Verse and chorus headings become slide breaks: {labels}',{labels:draft.sectionLabels.join(' · ')})}</p>}
        {!!draft.blankSlides.length && <p>{t('Blank or picture-only slides skipped: {slides}',{slides:draft.blankSlides.join(', ')})}</p>}
      </details>
      {draft.missingLanguages.map(item => <p key={`${item.slide}-${item.language}`} role="status">{t('Slide {slide} has no {language} lyrics. Add the missing text under its matching slide label before saving.',{slide:item.slide,language:t(item.language === 'ru' ? 'Russian' : 'English')})}</p>)}
      {!importState.applied && <footer><button type="button" className="heritage-song-disclosure" disabled={busy || !draft.title.trim() || (!draft.russianLyrics.trim() && !draft.lyrics.trim()) || Boolean(draft.unresolved.length)} onClick={() => apply(importState,draft)}>{t(hasText(current.current.values) ? 'Replace song text' : 'Fill song fields')}</button>
        <button type="button" className="heritage-song-disclosure" onClick={() => { setImport(null); button.current?.focus() }}>{t('Cancel')}</button></footer>}
    </div>}
  </section>
}

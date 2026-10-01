'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'
import { useRef, useState } from 'react'
import SongLyricsTextarea from './SongLyricsTextarea'
import { draftSongPptx, inspectSongPptx, SongPptxImportError, type SongPptxDraft, type SongPptxInspection } from '../lib/songPptxImport'
import { useWorkspaceText } from './useWorkspaceText'

const fieldNames = ['russianTitle', 'title', 'russianLyrics', 'lyrics', 'authors', 'defaultSongLanguage'] as const
export default function SongPptxImport(props: UIFieldClientProps) {
  const t = useWorkspaceText(), input = useRef<HTMLInputElement>(null)
  const russianTitle = useField<string>({path: 'russianTitle'}), title = useField<string>({path: 'title'})
  const russianLyrics = useField<string>({path: 'russianLyrics'}), lyrics = useField<string>({path: 'lyrics'})
  const authors = useField<string[]>({path: 'authors'}), language = useField<string>({path: 'defaultSongLanguage'})
  const snapshot = useFormFields(([fields]) => JSON.stringify(fieldNames.map(name => fields[name]?.value ?? null)))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [review, setReview] = useState<{inspection: SongPptxInspection; firstIsTitle: boolean; draft: SongPptxDraft; snapshot: string} | null>(null)
  const stale = review && snapshot !== review.snapshot
  const occupied = [russianTitle.value, title.value, russianLyrics.value, lyrics.value].some(value => String(value || '').trim()) || Boolean(authors.value?.length)
  if (props.readOnly) return null
  const changeDraft = (key: 'title' | 'russianTitle' | 'lyrics' | 'russianLyrics', value: string) => {
    if (review) setReview({...review, draft: {...review.draft, [key]: value}})
  }
  return <section className="heritage-song-pptx" aria-label={t('Import song from PowerPoint')}>
    <input ref={input} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" aria-label={t('Choose song PowerPoint')} hidden disabled={busy} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (!file) return
      setBusy(true); setError(''); setNotice(''); setReview(null)
      try {
        if (file.size > 32 * 1024 * 1024) throw new SongPptxImportError('Choose a PowerPoint file smaller than 32 MB.')
        const inspection = await inspectSongPptx(new Uint8Array(await file.arrayBuffer()), file.name)
        setReview({inspection, firstIsTitle: inspection.firstSlideIsTitle, draft: draftSongPptx(inspection), snapshot})
      } catch (caught) { setError(caught instanceof SongPptxImportError ? caught.message : 'Could not read this PowerPoint. Save it as .pptx and try again.') }
      finally { setBusy(false) }
    }} />
    <div className="heritage-song-pptx-intro"><button type="button" className="heritage-song-disclosure" disabled={busy} onClick={() => input.current?.click()}>{t(busy ? 'Reading PowerPoint…' : 'Import PowerPoint')}</button>
      <small>{t('Fill titles and lyrics from a song’s slides. Russian and English are separated automatically.')}</small></div>
    {error && <p role="alert">{t(error)}</p>}
    {notice && <p role="status">{t(notice)}</p>}
    {review && <div className="heritage-song-pptx-review">
      <header><strong>{review.inspection.fileName}</strong><span>{t('{count} lyric slides · slide order and repeats preserved', {count: review.draft.lyricSlides})}</span></header>
      <label className="heritage-song-pptx-title-choice"><input type="checkbox" checked={review.firstIsTitle} onChange={event => setReview({...review, firstIsTitle: event.target.checked, draft: draftSongPptx(review.inspection, event.target.checked)})} />{t('First slide is the song title')}</label>
      <div className="heritage-song-pptx-columns">
        <div><label htmlFor="pptx-russian-title">{t('Russian title')}</label><input id="pptx-russian-title" value={review.draft.russianTitle} onChange={event => changeDraft('russianTitle', event.target.value)} />
          <label htmlFor="pptx-russian-lyrics">{t('Russian lyrics')}</label><SongLyricsTextarea id="pptx-russian-lyrics" value={review.draft.russianLyrics} onChange={event => changeDraft('russianLyrics', event.target.value)} /></div>
        <div><label htmlFor="pptx-english-title">{t('English title / library name')}</label><input id="pptx-english-title" value={review.draft.title} onChange={event => changeDraft('title', event.target.value)} />
          <label htmlFor="pptx-english-lyrics">{t('English lyrics')}</label><SongLyricsTextarea id="pptx-english-lyrics" value={review.draft.lyrics} onChange={event => changeDraft('lyrics', event.target.value)} /></div>
      </div>
      {review.draft.titleFallback && <p>{t('No English title was found. The original title is used as the library name; no translation is invented.')}</p>}
      {(!review.draft.lyrics || !review.draft.russianLyrics) && <p>{t('This file has lyrics in one language. The other lyrics field stays empty.')}</p>}
      <label htmlFor="pptx-authors">{t('Authors')}</label><input id="pptx-authors" value={review.draft.authors.join('; ')} onChange={event => setReview({...review, draft: {...review.draft, authors: event.target.value.split(';').map(value => value.trim()).filter(Boolean)}})} />
      <small>{t('Separate authors with a semicolon. Slide labels keep the two languages paired.')}</small>
      {!!review.draft.sectionLabels.length && <p>{t('Verse and chorus headings become slide breaks: {labels}', {labels: review.draft.sectionLabels.join(' · ')})}</p>}
      {!!review.draft.blankSlides.length && <p>{t('Blank or picture-only slides skipped: {slides}', {slides: review.draft.blankSlides.join(', ')})}</p>}
      {review.draft.missingLanguages.map(item => <p key={`${item.slide}-${item.language}`} role="status">{t('Slide {slide} has no {language} lyrics. Add the missing text under its matching slide label before saving.', {slide: item.slide, language: t(item.language === 'ru' ? 'Russian' : 'English')})}</p>)}
      {!!review.draft.unresolved.length && <div className="heritage-song-pptx-unsorted"><strong>{t('Choose a language for this text')}</strong>
        {review.draft.unresolved.map((line, index) => <div key={`${line.slide}-${index}`}><span>{t('Slide {number}', {number: line.slide})}: {line.text}</span><div>{(['ru', 'en', 'ignore'] as const).map(choice => <button type="button" key={choice} onClick={() => {
          const inspection = structuredClone(review.inspection)
          const slide = inspection.slides.find(slide => slide.number === line.slide)!
          const at = slide.lines.findIndex(candidate => candidate.language === 'unknown' && candidate.text === line.text)
          if (choice === 'ignore') slide.lines.splice(at, 1); else slide.lines[at].language = choice
          setReview({...review, inspection, draft: draftSongPptx(inspection, review.firstIsTitle)})
        }}>{t(choice === 'ru' ? 'Russian' : choice === 'en' ? 'English' : 'Skip text')}</button>)}</div></div>)}
      </div>}
      {occupied && <p>{t('Import replaces the titles, lyrics and authors currently in this form. Other song settings stay as they are.')}</p>}
      {stale && <p role="status">{t('The song fields changed while this review was open. Choose the file again to review against the latest text.')}</p>}
      <footer><button type="button" className="heritage-song-disclosure" disabled={Boolean(stale) || !review.draft.title.trim() || (!review.draft.russianLyrics.trim() && !review.draft.lyrics.trim()) || Boolean(review.draft.unresolved.length)} onClick={() => {
        russianTitle.setValue(review.draft.russianTitle); title.setValue(review.draft.title)
        russianLyrics.setValue(review.draft.russianLyrics); lyrics.setValue(review.draft.lyrics); authors.setValue(review.draft.authors)
        if (!occupied) language.setValue(review.draft.defaultSongLanguage)
        setReview(null); setNotice('PowerPoint imported. Review the fields below, then save the song.')
      }}>{t(occupied ? 'Replace song fields' : 'Use these lyrics')}</button><button type="button" className="heritage-song-disclosure" onClick={() => setReview(null)}>{t('Cancel')}</button>
        <small>{t('The song is saved only when you click Save.')}</small></footer>
    </div>}
  </section>
}

'use client'
import { useEffect, useRef, useState } from 'react'
import { SERMON_TEMPLATES, type SermonTemplateId, type TemplateText } from './plannerTemplates'

export default function SermonTemplateDialog({ template, project, onCancel, onCreate }: {
  template: Exclude<SermonTemplateId, 'passage'>; project: any; onCancel: () => void;
  onCreate: (english: TemplateText, russian: TemplateText, image?: File) => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [english, setEnglish] = useState<TemplateText>({ heading: '', body: '' })
  const [russian, setRussian] = useState<TemplateText>({ heading: '', body: '' })
  const [image, setImage] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  const sources = Object.values(project.items).filter((item: any) => item.kind === 'sermon') as any[]
  return <dialog ref={dialog} className="heritage-slide-dialog" aria-labelledby="template-title" onCancel={event => { if (busy) event.preventDefault(); else onCancel() }}>
    <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await onCreate(english, russian, image) } catch (error) { setError(error instanceof Error ? error.message : 'Could not add the slide.'); setBusy(false) } }}>
      <header><h2 id="template-title">Add {SERMON_TEMPLATES.find(value => value.id === template)?.label.toLowerCase()} slide</h2><button type="button" aria-label="Close template" disabled={busy} onClick={onCancel}>×</button></header>
      {sources.length ? <label>Use text from this service<select aria-label="Use existing sermon text" defaultValue="" disabled={busy} onChange={event => {
        const source = sources.find(value => value.id === event.target.value)
        for (const [id, set] of [['english', setEnglish], ['russian', setRussian]] as const) set(source ? {
          heading: source.titlesByChannel?.[id] || (template === 'title' ? source.title : ''), body: source.textByChannel?.[id] || '',
        } : { heading: '', body: '' })
      }}><option value="">Start with your own text</option>{sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label> : null}
      <div className="heritage-slide-dialog__languages">{([['English', english, setEnglish], ['Russian', russian, setRussian]] as const).map(([label, value, set]) => <fieldset key={label} disabled={busy}><legend>{label}</legend>
        <label>{template === 'title' ? 'Sermon title' : 'Heading (optional)'}<input aria-label={`${label} heading`} value={value.heading} maxLength={200} onChange={event => set({ ...value, heading: event.target.value })} autoFocus={label === 'English'} /></label>
        <label>{template === 'title' ? 'Subtitle / passage (optional)' : template === 'quote' ? 'Quotation or thought' : 'Point / outline text'}<textarea aria-label={`${label} slide text`} rows={4} value={value.body} maxLength={12000} onChange={event => set({ ...value, body: event.target.value })} /></label>
      </fieldset>)}</div>
      <small>Use one or both languages. If one is empty, both screens use the text you entered. This does not translate automatically.</small>
      {template === 'title' ? <label>Title image<input type="file" aria-label="Title image" accept="image/png,image/jpeg,image/webp" required disabled={busy} onChange={event => setImage(event.target.files?.[0])} /><small>Your title stays editable over the image.</small></label> : null}
      {error ? <p role="alert">{error}</p> : null}
      <footer><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add slide'}</button></footer>
    </form>
  </dialog>
}

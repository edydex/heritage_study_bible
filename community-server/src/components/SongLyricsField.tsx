'use client'

import { TextareaField, useFormFields } from '@payloadcms/ui'
import type { TextareaFieldClientProps } from 'payload'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { songSectionLanguageChoices, songSourceSections } from '../lib/songSourceSyntax'
import { useWorkspaceText } from './useWorkspaceText'

/** A noninteractive backdrop marks sections while the native textarea retains
 * Payload validation, selection, paste and undo. */
export default function SongLyricsField(props: TextareaFieldClientProps) {
  const root = useRef<HTMLDivElement>(null), mirror = useRef<HTMLDivElement>(null)
  const [host,setHost] = useState<HTMLElement|null>(null)
  const [bands,setBands] = useState<{top:number;height:number;label:string}[]>([])
  const t = useWorkspaceText()
  const data = useFormFields(([fields]) => ({value:fields[props.path]?.value,
    english:fields.lyrics?.value,russian:fields.russianLyrics?.value,defaultLanguage:fields.defaultSongLanguage?.value}))
  const language = props.path==='lyrics' ? 'en' : props.path==='russianLyrics' ? 'ru' : null
  const text = String(data.value || '').replace(/\r\n?/g,'\n')
  const sections = useMemo(()=>songSourceSections(text),[text])
  const {choices,conflicts} = useMemo(()=>songSectionLanguageChoices(data.english,data.russian),[data.english,data.russian])
  const primary = (sectionId:string|null) => {
    const id = sectionId?.replace(/-repeat-\d+$/, '')
    return !conflicts.includes(id || '') && (id && choices[id] || (data.defaultLanguage==='en' ? 'en' : 'ru'))===language
  }
  useLayoutEffect(() => {
    const textarea = root.current?.querySelector('textarea')
    if (!textarea) return
    const outer = textarea.closest<HTMLElement>('.textarea-outer')
    if (language && outer && outer!==host) setHost(outer)
    const resize = () => {
      if (!textarea.clientWidth) return // Chords can be inside a closed panel.
      textarea.style.height = 'auto'
      const border = textarea.offsetHeight - textarea.clientHeight
      textarea.style.height = `${textarea.scrollHeight + border}px`
      if (!language || !mirror.current || !outer) return
      const style = getComputedStyle(textarea), target = mirror.current
      for (const property of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','textIndent','textAlign','direction','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'] as const) target.style[property]=style[property]
      target.style.width = `${textarea.offsetWidth}px`
      const origin = outer.getBoundingClientRect().top
      const next: typeof bands = []
      target.querySelectorAll<HTMLElement>('[data-section]').forEach((element,index)=>{
        if (!primary(sections[index]?.id)) return
        const rects = [...element.getClientRects()].filter(rect=>rect.width>0 && rect.height>0)
        if (!rects.length) return
        const first=rects[0], last=rects[rects.length-1]
        const leading=Math.max(0,(parseFloat(style.lineHeight)-first.height)/2)
        next.push({top:Math.max(1,first.top-origin-leading),height:last.bottom-first.top+leading*2,label:sections[index].label})
      })
      setBands(next)
    }
    resize()
    let width = root.current!.clientWidth
    const widthObserver = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width
      if (next !== width) { width = next; resize() }
    })
    widthObserver.observe(root.current!)
    return () => widthObserver.disconnect()
  }, [text,host,language,data.defaultLanguage,data.english,data.russian])
  return <div ref={root} className="heritage-song-lyrics" data-language={language || undefined}>
    <TextareaField {...props} />
    {language && <p className="heritage-song-lyrics__guide">{t('Wrap a heading in asterisks, like *Chorus* or *Припев*, to make this language primary for that section and its repeats.')}</p>}
    {language==='en' && conflicts.length>0 && <p className="heritage-song-lyrics__conflict" role="alert">{t('Both languages mark “{section}” primary. Keep the asterisks in one language only.',{section:conflicts[0]})}</p>}
    {host && language && createPortal(<div className="heritage-song-lyrics__backdrop" aria-hidden="true">
      {bands.map((band,index)=><div key={index} className="heritage-song-lyrics__primary" style={{top:band.top,height:band.height}}><span title={band.label}>{t('Primary')}</span></div>)}
      <div ref={mirror} className="heritage-song-lyrics__mirror">{sections.map((section,index)=><span key={index} data-section={index}>{text.slice(section.start,section.end)}</span>)}</div>
    </div>,host)}
  </div>
}

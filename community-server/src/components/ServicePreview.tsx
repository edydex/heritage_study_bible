'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import ServiceSlidePreview from './ServiceSlidePreview'
import type { PlannerSlide } from './plannerSlides'

const CHANNELS=['english','russian','media']
export default function ServicePreview({project,rows,initialSlideId,initialChannel,dirty,mediaUrl,onClose}: {
  project: Record<string,any>; rows: PlannerSlide[]; initialSlideId?: string; initialChannel: string; dirty: boolean;
  mediaUrl: (assetId:string)=>string | undefined; onClose: (row?:PlannerSlide)=>void
}) {
  const slides=useMemo(()=>rows.filter(row=>row.cue),[rows])
  const [selectedId,setSelectedId]=useState(initialSlideId || slides[0]?.id)
  const [channel,setChannel]=useState(initialChannel)
  const [size,setSize]=useState(220)
  const dialog=useRef<HTMLDialogElement>(null)
  const grid=useRef<HTMLDivElement>(null)
  const active=slides.find(row=>row.id===selectedId) || slides[0]
  const index=slides.indexOf(active)
  const next=slides[index+1]
  const label=(id:string)=>id==='media' ? 'Singers' : project.channels[id]?.label || id
  useEffect(()=>{dialog.current?.showModal();grid.current?.focus()},[])
  useEffect(()=>{grid.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest'})},[selectedId])
  function move(offset:number) { const target=slides[Math.max(0,Math.min(slides.length-1,index+offset))]; if(target) setSelectedId(target.id) }
  return <dialog ref={dialog} className="heritage-service-preview" aria-labelledby="service-preview-title" onCancel={event=>{event.preventDefault();onClose(active)}}
    onKeyDown={event=>{
      const target=event.target as HTMLElement
      if (target.closest('input,select,textarea,video,[contenteditable="true"],[contenteditable="plaintext-only"]')) return
      if (event.key==='ArrowRight' || event.key==='ArrowLeft') {event.preventDefault();move(event.key==='ArrowRight'?1:-1)}
      if (event.key===' ' && (!target.closest('button') || target.closest('[data-preview-tile]'))) {event.preventDefault();move(1)}
      if (event.key==='Home' || event.key==='End') {event.preventDefault();const target=event.key==='Home'?slides[0]:slides.at(-1);if(target) setSelectedId(target.id)}
    }}>
    <header className="heritage-service-preview__header">
      <div><h2 id="service-preview-title">Service Preview</h2><span>{project.title} · {project.serviceDate}</span></div>
      <button type="button" onClick={()=>onClose(active)}>← Back to editing</button>
    </header>
    <div className="heritage-service-preview__layout">
      <section className="heritage-service-preview__slides" aria-label="All slides">
        <div className="heritage-service-preview__grid-toolbar">
          <strong>{slides.length} slides</strong>
          <div role="group" aria-label="Thumbnail output">{CHANNELS.map(id=><button key={id} type="button" aria-pressed={channel===id} onClick={()=>setChannel(id)}>{label(id)}</button>)}</div>
          <div role="group" aria-label="Thumbnail size"><button type="button" aria-label="Smaller thumbnails" disabled={size<=160} onClick={()=>setSize(value=>value-40)}>−</button><button type="button" aria-label="Larger thumbnails" disabled={size>=380} onClick={()=>setSize(value=>value+40)}>+</button></div>
        </div>
        <div ref={grid} tabIndex={0} aria-label="Slide tiles" className="heritage-service-preview__grid" style={{'--preview-tile-size':`${size}px`} as React.CSSProperties}>
          {rows.map(row=>!row.cue ? <h3 key={row.id} className="heritage-service-preview__section">{row.title}</h3> : <button type="button" key={row.id} data-preview-tile={row.id} aria-label={`Preview slide ${row.number}: ${row.title}`} aria-pressed={active?.id===row.id}
            onClick={()=>setSelectedId(row.id)} onDoubleClick={()=>onClose(row)}>
            <div className="heritage-service-preview__thumbnail" aria-hidden="true"><ServiceSlidePreview project={project} rows={rows} slide={row} channelId={channel} mediaUrl={mediaUrl} /></div>
            <span className="heritage-service-preview__tile-caption"><b>{row.number}</b><span>{row.title}</span>{row.kind==='blank'?<small>Blank</small>:row.cue?.channels?.[channel]?.mode==='hide'?<small>Hidden</small>:null}</span>
          </button>)}
          {!slides.length ? <p>No slides in this service yet.</p> : null}
        </div>
      </section>
      <aside className="heritage-service-preview__controls" aria-label="Rehearsal controls">
        <p className="heritage-service-preview__draft">{dirty?'Unsaved draft':'Saved service'} · Preview only</p>
        <div className="heritage-service-preview__cue" aria-live="polite"><strong>Slide {active?.number || 0} <small>/ {slides.length}</small></strong><h3>{active?.title || 'No slide selected'}</h3><p>Next: {next?.title || 'End of service'}</p></div>
        <nav aria-label="Preview navigation"><button type="button" disabled={index<=0} onClick={()=>move(-1)}>← Previous</button><button type="button" disabled={!next} onClick={()=>move(1)}>Next →</button></nav>
        <p className="heritage-service-preview__hint">← / → or Space to navigate.<br />Double-click a tile to edit it.</p>
        {active ? <div className="heritage-service-preview__outputs" aria-label="Selected output previews">
          {CHANNELS.map(id=><section key={id} aria-label={`${label(id)} output`}><h3>{label(id)}</h3><div className="heritage-service-preview__output-frame"><ServiceSlidePreview project={project} rows={rows} slide={active} channelId={id} mediaUrl={mediaUrl} playVideo={id===channel} /></div></section>)}
        </div> : null}
      </aside>
    </div>
  </dialog>
}

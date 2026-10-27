'use client'
import { useWorkspaceText } from './useWorkspaceText'
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import ServiceSlidePreview from './ServiceSlidePreview'
import { isSongTitleSlide, type PlannerSlide } from './plannerSlides'

const CHANNELS=['english','russian','media']
export default function ServicePreview({project,rows,initialSlideId,initialChannel,dirty,mediaUrl,onClose,inline=false,showMode=false,liveCueId,onSelect,onChannel,onSlideMenu}: {
  project: Record<string,any>; rows: PlannerSlide[]; initialSlideId?: string; initialChannel: string; dirty: boolean;
  mediaUrl: (assetId:string)=>string | undefined; onClose: (row?:PlannerSlide)=>void;
  inline?: boolean; showMode?: boolean; liveCueId?: string; onSelect?: (row:PlannerSlide)=>void; onChannel?: (id:string)=>void; onSlideMenu?: (row:PlannerSlide,x:number,y:number)=>void
}) {
  const t = useWorkspaceText()
  const slides=useMemo(()=>rows.filter(row=>row.cue),[rows])
  const [selectedId,setSelectedId]=useState(initialSlideId || slides[0]?.id)
  const [channel,setChannel]=useState(initialChannel)
  const [size,setSize]=useState(200)
  const dialog=useRef<HTMLDialogElement>(null)
  const grid=useRef<HTMLDivElement>(null)
  const pendingTake=useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(()=>()=>{if(pendingTake.current)clearTimeout(pendingTake.current)},[])
  function edit(row:PlannerSlide) {if(pendingTake.current)clearTimeout(pendingTake.current);pendingTake.current=null;onClose(row)}
  const active=slides.find(row=>row.id===(inline ? initialSlideId : selectedId)) || slides[0]
  const outputChannel=inline ? initialChannel : channel
  const index=slides.indexOf(active)
  const next=slides[index+1]
  const label=(id:string)=>t(id==='media' ? 'Stage-Facing Screen' : project.channels[id]?.label || id)
  useEffect(()=>{if(!inline){dialog.current?.showModal();grid.current?.focus()}},[inline])
  useEffect(()=>{grid.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest'})},[active?.id])
  function choose(row:PlannerSlide) { setSelectedId(row.id);onSelect?.(row) }
  function move(offset:number) { const target=slides[Math.max(0,Math.min(slides.length-1,index+offset))]; if(target) choose(target) }
  function keyboard(event:KeyboardEvent<HTMLElement>) {
      const target=event.target as HTMLElement
      if (target.closest('input,select,textarea,video,[contenteditable="true"],[contenteditable="plaintext-only"]')) return
      if (event.key==='ArrowRight' || event.key==='ArrowLeft') {event.preventDefault();move(event.key==='ArrowRight'?1:-1)}
      if (event.key===' ' && (!target.closest('button') || target.closest('[data-preview-tile]'))) {event.preventDefault();move(1)}
      if (event.key==='Home' || event.key==='End') {event.preventDefault();const target=event.key==='Home'?slides[0]:slides.at(-1);if(target) choose(target)}
    }
  const surface=<>
    {!inline ? <header className="heritage-service-preview__header">
      <div><h2 id="service-preview-title">{t("Service Preview")}</h2><span>{project.title} · {project.serviceDate}</span></div>
      <button type="button" onClick={()=>onClose(active)}>{t("← Back to editing")}</button>
    </header> : null}
    <div className="heritage-service-preview__layout">
      <section className="heritage-service-preview__slides" aria-label={t("All slides")}>
        {showMode ? <p className="heritage-slide-overview__show-hint">{t('Click a slide to show it · Double-click to edit')}</p> : null}
        <div className="heritage-service-preview__grid-toolbar">
          <strong>{t("{count} slides", { count: slides.length })}</strong>
          <div role="group" aria-label={t("Thumbnail output")}>{CHANNELS.map(id=><button key={id} type="button" aria-pressed={outputChannel===id} onClick={()=>{setChannel(id);onChannel?.(id)}}>{label(id)}</button>)}</div>
          <div role="group" aria-label={t("Thumbnail size")}><button type="button" aria-label={t("Smaller thumbnails")} disabled={size<=160} onClick={()=>setSize(value=>Math.max(160,value-40))}>−</button><button type="button" aria-label={t("Larger thumbnails")} disabled={size>=380} onClick={()=>setSize(value=>Math.min(380,value+40))}>+</button></div>
        </div>
        <div ref={grid} tabIndex={0} aria-label={t("Slide tiles")} className="heritage-service-preview__grid" style={{'--preview-tile-size':`${size}px`} as React.CSSProperties}>
          {rows.map(row=><Fragment key={row.id}>{!row.cue || isSongTitleSlide(row) || row.sermonTitle || row.readingTitle ? <h3 className="heritage-service-preview__section" data-kind={row.kind}>{row.title}</h3> : null}{row.cue ? <button type="button" data-preview-tile={row.id} data-live={showMode && liveCueId===row.id || undefined} aria-label={t('Preview slide {number}: {title}', { number: row.number || 0, title: row.title })} aria-pressed={active?.id===row.id}
            onClick={event=>{
              if(pendingTake.current)clearTimeout(pendingTake.current)
              if(showMode && event.detail > 0) {
                // A double-click means edit, and must not first project the slide.
                if(event.detail===1)pendingTake.current=setTimeout(()=>{pendingTake.current=null;choose(row)},300)
              } else choose(row)
            }} onDoubleClick={()=>edit(row)} onContextMenu={event=>{if(onSlideMenu){event.preventDefault();onSlideMenu(row,event.clientX,event.clientY)}}}
            onKeyDown={event=>{if(onSlideMenu && (event.key==='ContextMenu' || (event.shiftKey && event.key==='F10'))){event.preventDefault();const bounds=event.currentTarget.getBoundingClientRect();onSlideMenu(row,bounds.left,bounds.bottom)}}}>
            <div className="heritage-service-preview__thumbnail" aria-hidden="true"><ServiceSlidePreview project={project} rows={rows} slide={row} channelId={outputChannel} mediaUrl={mediaUrl} /></div>
            <span className="heritage-service-preview__tile-caption"><b>{row.number}</b><span>{row.title}</span>{showMode && liveCueId===row.id ? <small className="heritage-slide-overview__live-badge">{t('On screen')}</small> : row.kind==='blank'?<small>{t("Blank")}</small>:row.cue?.channels?.[outputChannel]?.mode==='hide'?<small>{t("Hidden")}</small>:null}</span>
          </button> : null}</Fragment>)}
          {!slides.length ? <p>{t("No slides in this service yet.")}</p> : null}
        </div>
      </section>
      <aside className="heritage-service-preview__controls" aria-label={t("Rehearsal controls")}>
        <p className="heritage-service-preview__draft">{inline ? t("Preview") : <>{dirty?t("Unsaved draft"):t("Saved service")} · {t("Preview only")}</>}</p>
        <div className="heritage-service-preview__cue" aria-live="polite"><strong>{t("Slide")} {active?.number || 0} <small>/ {slides.length}</small></strong><h3>{active?.title || t("No slide selected")}</h3><p>{t("Next:")} {next?.title || t("End of service")}</p></div>
        <nav aria-label={t("Preview navigation")}><button type="button" disabled={index<=0} onClick={()=>move(-1)}>{t("← Previous")}</button><button type="button" disabled={!next} onClick={()=>move(1)}>{t("Next →")}</button></nav>
        <p className="heritage-service-preview__hint">{t("← / → or Space to navigate.")}<br />{t("Double-click a tile to edit it.")}</p>
        {inline ? <button className="heritage-slide-overview__edit" type="button" disabled={!active} onClick={()=>{if(active)edit(active)}}>{t("Edit slide")}</button> : null}
        {active ? <div className="heritage-service-preview__outputs" aria-label={t("Selected output previews")}>
          {(inline ? [outputChannel] : CHANNELS).map(id=><section key={id} aria-label={t('{label} output', { label: label(id) })}><h3>{label(id)}</h3><div className="heritage-service-preview__output-frame" lang={id === 'russian' ? 'ru' : id === 'english' ? 'en' : project.channels[id]?.language || t.language}><ServiceSlidePreview project={project} rows={rows} slide={active} channelId={id} mediaUrl={mediaUrl} playVideo={id===outputChannel} /></div></section>)}
        </div> : null}
      </aside>
    </div>
  </>
  return inline ? <section className="heritage-service-preview heritage-slide-overview" data-show-mode={showMode || undefined} aria-label={t("Slides")} onKeyDown={keyboard}>{surface}</section>
    : <dialog ref={dialog} className="heritage-service-preview" aria-labelledby="service-preview-title" onCancel={event=>{event.preventDefault();onClose(active)}} onKeyDown={keyboard}>{surface}</dialog>
}

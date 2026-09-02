'use client'
import { useEffect, useRef, useState } from 'react'
import SlideText from './SlideText'
import { outlineWithGuides, parseOutline, serializeOutline, updateOutlineRow, type OutlineRow } from './plannerOutline'
const EMPTY_SPANS: any[] = []

export default function OutlineSlideEditor({text,spans=EMPTY_SPANS,channelId,onCommit}: {
  text: string; spans?: any[]; channelId: string; onCommit: (text: string, spans: any[]) => void
}) {
  const [rows,setRows] = useState(()=>parseOutline(text,spans))
  const current = useRef(rows), container = useRef<HTMLDivElement>(null)
  const source = useRef({text,spans})
  useEffect(()=>{
    source.current = {text,spans}
    const local = serializeOutline(current.current)
    if (local.text === text && JSON.stringify(local.spans) === JSON.stringify(spans)) return
    // An external Undo/reload replaces the outline; ordinary blur commits keep row identity and focus.
    current.current = parseOutline(text,spans); setRows(current.current)
  },[text,spans])
  function update(row: OutlineRow, value: string, styles: any[]) {
    current.current = updateOutlineRow(current.current,row.id,value,styles)
    setRows(current.current)
  }
  function commit() {
    const value = serializeOutline(current.current)
    if (value.text !== source.current.text || JSON.stringify(value.spans) !== JSON.stringify(source.current.spans)) onCommit(value.text,value.spans)
  }
  function advance(row: OutlineRow) {
    const visible=outlineWithGuides(current.current), index=visible.findIndex(value=>value.id===row.id)
    const next=visible.slice(index+1).find(value=>value.kind===row.kind && value.parentId===row.parentId)
    if (next) container.current?.querySelector<HTMLElement>(`[data-outline-row="${CSS.escape(next.id)}"] [contenteditable]`)?.focus()
  }
  return <div ref={container} className="heritage-service-planner__outline" data-role="body">
    {outlineWithGuides(rows).map(row=><div key={row.id} className="heritage-service-planner__outline-row" data-outline-row={row.id} data-level={row.kind} data-empty={!row.text.length}>
      <span className="heritage-service-planner__outline-marker" aria-hidden="true" style={{color:row.prefixSpans[0]?.foreground,fontWeight:row.prefixSpans[0]?.weight}}>{row.prefix}</span>
      <SlideText text={row.text} spans={row.spans} role="outline-text" canFormat
        label={`${channelId} ${row.kind==='subpoint' ? `sub-point ${row.marker} under ${rows.find(value=>value.id===row.parentId)?.marker}` : row.kind==='point' ? `point ${row.marker}` : 'outline text'}`}
        placeholder={row.kind==='subpoint' ? 'Add sub-point…' : 'Add point…'}
        onDraftChange={(value,styles)=>update(row,value,styles)} onCommit={commit} onAdvance={()=>advance(row)} />
    </div>)}
  </div>
}

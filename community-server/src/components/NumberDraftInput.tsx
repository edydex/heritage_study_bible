
'use client'
import {useEffect, useState, useRef} from 'react'
/** Allow empty/intermediate typing; clamp once the user finishes entering a value. */
export default function NumberDraftInput({value,min,max,onCommit}:{value:number;min:number;max:number;onCommit:(value:number)=>void}) {
  const cancel=useRef(false)
  const [draft,setDraft]=useState(String(value))
  useEffect(()=>setDraft(String(value)),[value])
  function commit() {
    if(cancel.current){cancel.current=false;setDraft(String(value));return}
    const number=Number(draft)
    const next=draft.trim() && Number.isFinite(number) ? Math.max(min,Math.min(max,Math.round(number))) : value
    setDraft(String(next)); if(next!==value)onCommit(next)
  }
  return <input type="number" min={min} max={max} value={draft} onChange={event=>setDraft(event.currentTarget.value)} onBlur={commit}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}else if(event.key==='Escape'){event.preventDefault();cancel.current=true;event.currentTarget.blur()}}} />
}

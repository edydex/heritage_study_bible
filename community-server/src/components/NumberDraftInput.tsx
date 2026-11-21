'use client'
import {useEffect, useState, useRef} from 'react'

/** Keep partial input editable; live fields apply valid whole values immediately. */
export default function NumberDraftInput({value,min,max,onCommit,live=false,onEditStart,onEditEnd}:{
  value:number;min:number;max:number;onCommit:(value:number)=>void;live?:boolean;
  onEditStart?:()=>void;onEditEnd?:()=>void
}) {
  const cancel=useRef(false),focused=useRef(false),initial=useRef(value),applied=useRef(value)
  const [draft,setDraft]=useState(String(value))
  useEffect(()=>{
    applied.current=value
    if(!focused.current)setDraft(String(value))
  },[value])
  function apply(next:number) {
    if(next===applied.current)return
    applied.current=next;onCommit(next)
  }
  function finish() {
    focused.current=false
    if(cancel.current){
      cancel.current=false
      const restored=live ? initial.current : value
      setDraft(String(restored));if(live)apply(restored)
    } else {
      const number=Number(draft)
      const next=draft.trim() && Number.isFinite(number) ? Math.max(min,Math.min(max,Math.round(number))) : applied.current
      setDraft(String(next));apply(next)
    }
    onEditEnd?.()
  }
  return <input type="number" min={min} max={max} value={draft}
    onFocus={()=>{focused.current=true;initial.current=value;onEditStart?.()}}
    onChange={event=>{
      const text=event.currentTarget.value,number=Number(text)
      setDraft(text)
      if(live && text.trim() && Number.isInteger(number) && number>=min && number<=max)apply(number)
    }} onBlur={finish}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}else if(event.key==='Escape'){event.preventDefault();cancel.current=true;event.currentTarget.blur()}}} />
}

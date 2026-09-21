'use client'
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {PRESENTATION_COLORS,colorDescription,patternImage,collectPresentationColors,linePattern} from './presentationPalette'
import './presentation-accessibility.css'

const STORAGE_KEY='heritage.presentation.monochrome.v1'
const Context=createContext({monochrome:false,setMonochrome:(_value:boolean)=>{}})
export const usePresentationAccessibility=()=>useContext(Context)
export function PresentationAccessibility({children}:{children:ReactNode}) {
  const [monochrome,setValue]=useState(false)
  useEffect(()=>{try{setValue(localStorage.getItem(STORAGE_KEY)==='true')}catch{}},[])
  function setMonochrome(value:boolean){setValue(value);try{localStorage.setItem(STORAGE_KEY,String(value))}catch{}}
  return <Context.Provider value={{monochrome,setMonochrome}}>{children}</Context.Provider>
}
export function PresentationAccessibilityControl({item}:{item:unknown}) {
  const {monochrome,setMonochrome}=usePresentationAccessibility()
  const colors=collectPresentationColors(item)
  return <div className="presentation-accessibility">
    <label><input type="checkbox" checked={monochrome} onChange={event=>setMonochrome(event.target.checked)} />Monochrome / colorblind view</label>
    {monochrome && <><p>Patterns on this device. Audience screens keep their colors. Text colors use patterned underlines; thin outlines use the dash samples below.</p>
      <details open><summary>Colors in this item</summary><ul aria-label="Used slide colors">{colors.map(color=><li key={color}><span className="presentation-color-sample" aria-hidden="true"><i style={{backgroundImage:patternImage(color)}} /><svg viewBox="0 0 30 5"><path d="M0 2.5H30" stroke="black" strokeWidth="1.5" strokeDasharray={linePattern(color)} /></svg></span>{colorDescription(color)}</li>)}</ul>{!colors.length && <p>No added colors yet.</p>}</details></>}
  </div>
}
export function PresentationColorInput({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}) {
  const {monochrome}=usePresentationAccessibility()
  const [open,setOpen]=useState(false)
  if(!monochrome)return <input type="color" aria-label={label} value={value} onInput={event=>onChange(event.currentTarget.value)} />
  return <div className="presentation-color-picker">
    <button type="button" aria-label={label} aria-expanded={open} onClick={()=>setOpen(!open)}><i aria-hidden="true" style={{backgroundImage:patternImage(value)}} />{colorDescription(value)}</button>
    {open && <div className="presentation-color-options" role="group" aria-label={`${label} palette`}>{PRESENTATION_COLORS.map(item=><button type="button" key={item.color} aria-pressed={value===item.color} onClick={()=>{onChange(item.color);setOpen(false)}}><i aria-hidden="true" style={{backgroundImage:patternImage(item.color)}} />{item.name} · {item.pattern}</button>)}</div>}
  </div>
}

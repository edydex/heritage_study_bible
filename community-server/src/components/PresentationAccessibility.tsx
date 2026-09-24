'use client'
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {usePreferences} from '@payloadcms/ui'
import {PRESENTATION_COLORS,colorDescription,patternImage,collectPresentationColors,linePattern} from './presentationPalette'
import './presentation-accessibility.css'

const STORAGE_KEY='heritage.presentation.monochrome.v1'
const Context=createContext({monochrome:false,setMonochrome:(_value:boolean)=>{}})
export const usePresentationAccessibility=()=>useContext(Context)
export function PresentationAccessibility({children}:{children:ReactNode}) {
  const [monochrome,setValue]=useState(false)
  const {getPreference}=usePreferences()
  useEffect(()=>{let active=true; if(getPreference) void getPreference<boolean>(STORAGE_KEY).then(value=>{if(active)setValue(value===true)}).catch(()=>{}); return ()=>{active=false}},[getPreference])
  function setMonochrome(value:boolean){setValue(value);try{localStorage.setItem(STORAGE_KEY,String(value))}catch{}}
  return <Context.Provider value={{monochrome,setMonochrome}}>{children}</Context.Provider>
}
export function PresentationAccessibilityControl({item}:{item:unknown}) {
  const {monochrome}=usePresentationAccessibility()
  const colors=collectPresentationColors(item)
  if(!monochrome)return null
  return <div className="presentation-accessibility">
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

export function PersonalPresentationPreference() {
  const {getPreference,setPreference}=usePreferences()
  const [enabled,setEnabled]=useState(false)
  const [notice,setNotice]=useState('')
  useEffect(()=>{void getPreference<boolean>(STORAGE_KEY).then(value=>setEnabled(value===true)).catch(()=>setNotice('Could not load your display preference.'))},[getPreference])
  return <section style={{margin:'24px 0'}}><h3>Slide editor display</h3><label><input type="checkbox" checked={enabled} onChange={async event=>{const value=event.target.checked;try{await setPreference(STORAGE_KEY,value);setEnabled(value);setNotice('Saved for your account.')}catch{setNotice('Could not save. Try again.')}}} /> Monochrome / colorblind view</label><p>Use named patterns when editing slides. Audience screens keep their colors.</p><small role="status">{notice}</small></section>
}

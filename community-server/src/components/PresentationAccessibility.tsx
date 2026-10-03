'use client'
import { useWorkspaceText } from './useWorkspaceText'
import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode} from 'react'
import {usePreferences,useTranslation} from '@payloadcms/ui'
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
  const t = useWorkspaceText()
  const {monochrome}=usePresentationAccessibility()
  const colors=collectPresentationColors(item)
  if(!monochrome)return null
  return <div className="presentation-accessibility">
    {monochrome && <><p>{t("Patterns on this device. Audience screens keep their colors. Text colors use patterned underlines; thin outlines use the dash samples below.")}</p>
      <details open><summary>{t("Colors in this item")}</summary><ul aria-label={t("Used slide colors")}>{colors.map(color=><li key={color}><span className="presentation-color-sample" aria-hidden="true"><i style={{backgroundImage:patternImage(color)}} /><svg viewBox="0 0 30 5"><path d="M0 2.5H30" stroke="black" strokeWidth="1.5" strokeDasharray={linePattern(color)} /></svg></span>{colorDescription(color).split(' · ').map(part => t(part)).join(' · ')}</li>)}</ul>{!colors.length && <p>{t("No added colors yet.")}</p>}</details></>}
  </div>
}
const PICKER_COLORS = [...PRESENTATION_COLORS, {name:'Gold',color:'#ffc000',pattern:'Diagonal lines'}, {name:'Amber',color:'#8a5a00',pattern:'Horizontal lines'}]
export function PresentationColorInput({value,onChange,label,onReset,resetLabel}:{value:string|null;onChange:(value:string)=>void;label:string;onReset?:()=>void;resetLabel?:string}) {
  const t = useWorkspaceText()
  const {monochrome}=usePresentationAccessibility()
  const [open,setOpen]=useState(false)
  const [hex,setHex]=useState(value || '#ffffff')
  const [position,setPosition]=useState({left:0,top:0})
  const root=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null)
  const id=useId()
  useEffect(()=>{setHex(value || '#ffffff')},[value])
  useEffect(()=>{
    if(!open)return
    const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)}
    const move=()=>setOpen(false)
    document.addEventListener('pointerdown',close)
    window.addEventListener('resize',move)
    return ()=>{document.removeEventListener('pointerdown',close);window.removeEventListener('resize',move)}
  },[open])
  function toggle(){
    const rect=trigger.current!.getBoundingClientRect()
    const height=onReset ? 210 : 178
    setPosition({left:Math.max(8,Math.min(rect.left,innerWidth-240)),top:rect.bottom+height+8<=innerHeight ? rect.bottom+6 : Math.max(8,rect.top-height-6)})
    setHex(value || '#ffffff');setOpen(!open)
  }
  function choose(color:string){onChange(color.toLowerCase());setOpen(false)}
  const valid=/^#[\da-f]{6}$/i.test(hex)
  const description=value===null?t('Mixed colors'):value ? (monochrome ? colorDescription(value).split(' · ').map(part=>t(part)).join(' · ') : value.toUpperCase()) : t('No highlight')
  return <div ref={root} className="presentation-color-picker">
    <button ref={trigger} type="button" className="presentation-color-picker__trigger" aria-label={label} aria-expanded={open} aria-controls={open?id:undefined} title={`${label}: ${description}`} onPointerDown={event=>event.preventDefault()} onClick={toggle}><i aria-hidden="true" data-empty={!value || undefined} style={value ? {backgroundColor:monochrome?'white':value,backgroundImage:monochrome?patternImage(value):undefined} : undefined} /><span aria-hidden="true">▾</span><span className="presentation-color-picker__value">{description}</span></button>
    {open && <div id={id} className="presentation-color-options" role="group" aria-label={t('{label} palette', { label })} style={position} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);trigger.current?.focus()}}}>
      <strong>{label}</strong>
      <div className="presentation-color-options__swatches">{PICKER_COLORS.map(item=><button type="button" key={item.color} aria-label={monochrome?`${t(item.name)} · ${t(item.pattern)}`:t(item.name)} title={monochrome?`${t(item.name)} · ${t(item.pattern)}`:t(item.name)} aria-pressed={value?.toLowerCase()===item.color} onPointerDown={event=>event.preventDefault()} onClick={()=>choose(item.color)}><i aria-hidden="true" style={{backgroundColor:monochrome?'white':item.color,backgroundImage:monochrome?patternImage(item.color):undefined}} /></button>)}</div>
      <div className="presentation-color-options__custom"><input aria-label={t('{label} hex color',{label})} value={hex} spellCheck={false} maxLength={7} onChange={event=>setHex(event.currentTarget.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(valid)choose(hex)}}} /><button type="button" disabled={!valid} onPointerDown={event=>event.preventDefault()} onClick={()=>choose(hex)}>{t('Set color')}</button></div>
      {onReset && <button type="button" className="presentation-color-options__reset" onPointerDown={event=>event.preventDefault()} onClick={()=>{onReset();setOpen(false)}}>{resetLabel}</button>}
    </div>}
  </div>
}

export function PersonalPresentationPreference() {
  const {getPreference,setPreference}=usePreferences()
  const {i18n}=useTranslation()
  const ru=i18n.language==='ru'
  const [enabled,setEnabled]=useState(false)
  const [notice,setNotice]=useState('')
  useEffect(()=>{void getPreference<boolean>(STORAGE_KEY).then(value=>setEnabled(value===true)).catch(()=>setNotice(ru?'Не удалось загрузить настройки отображения.':'Could not load your display preference.'))},[getPreference,ru])
  return <section style={{margin:'24px 0'}}><h3>{ru?'Отображение в редакторе слайдов':'Slide editor display'}</h3><label><input type="checkbox" checked={enabled} onChange={async event=>{const value=event.target.checked;try{await setPreference(STORAGE_KEY,value);setEnabled(value);setNotice(ru?'Настройка сохранена.':'Saved for your account.')}catch{setNotice(ru?'Не удалось сохранить. Попробуйте ещё раз.':'Could not save. Try again.')}}} /> {ru?'Монохромный режим / различение цветов по узорам':'Monochrome / colorblind view'}</label><p>{ru?'При редактировании цвета обозначаются узорами. На экранах для аудитории цвета сохраняются.':'Use named patterns when editing slides. Audience screens keep their colors.'}</p><small role="status">{notice}</small></section>
}

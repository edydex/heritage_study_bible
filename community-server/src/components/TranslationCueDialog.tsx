'use client'
import {useEffect,useRef,useState} from 'react'
import cueSettings from '../../packages/service-core/node/services/project/TranslationCueSettings.js'
import type {PlannerSlide} from './plannerSlides'
import './translation-cue.css'
export default function TranslationCueDialog({slide,onSave,onClose}:{slide:PlannerSlide;onSave:(value:Record<string,any>)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const [settings,setSettings]=useState<Record<string,any>>(()=>cueSettings.normalizeSettings(slide.cue?.translationSettings))
  useEffect(()=>{dialog.current?.showModal()},[])
  const update=(value:Record<string,any>)=>setSettings((current:any)=>({...current,...value}))
  const reserve=cueSettings.reservation(settings,settings.captionChannel==='both'?'english':settings.captionChannel)
  return <dialog ref={dialog} className="heritage-translation-cue" onCancel={onClose} aria-labelledby="translation-cue-title">
    <form onSubmit={event=>{event.preventDefault();onSave(settings)}}>
      <h2 id="translation-cue-title">Translation · slide {slide.number}</h2>
      <p>Prepare audio on the previous slide. Translate from this slide until the next Stop Translate cue.</p>
      <label>Speaker’s language<select value={settings.sourceLanguage} onChange={event=>update({sourceLanguage:event.target.value,targetLanguage:event.target.value==='en'?'ru':'en',captionChannel:event.target.value==='en'?'russian':'english'})}><option value="en">English → Russian</option><option value="ru">Russian → English</option></select></label>
      <label><input type="checkbox" checked={settings.speechEnabled} onChange={event=>update({speechEnabled:event.target.checked})}/> Translated audio for phone listeners</label>
      <label>Translation voice<select value={settings.voice} disabled={!settings.speechEnabled} onChange={event=>update({voice:event.target.value})}><option value="cedar">Cedar</option><option value="marin">Marin</option></select></label>
      <label>On-screen translation<select value={settings.captionStyle} onChange={event=>update({captionStyle:event.target.value})}><option value="hidden">Off</option><option value="ticker">Scrolling ticker · bottom 12%</option><option value="lower-third">Appearing sentences · bottom 29%</option></select></label>
      {reserve>0 && <><label>Show translated text on<select value={settings.captionChannel} onChange={event=>update({captionChannel:event.target.value})}><option value="english">English screen</option><option value="russian">Russian screen</option><option value="both">Both audience screens</option></select></label><div className="translation-space-example"><span>Slide content · {Math.round((1-reserve)*100)}% height</span><aside style={{height:`${reserve*100}%`}}>Translation · {Math.round(reserve*100)}%</aside></div><p>Slides keep their full width. This band takes space from the slide: text wraps and reduces in size only as needed to fit above it. Plan images and objects in the remaining area. The Stage-Facing Screen keeps its full layout.</p></>}
      <p>Choose the mixer or computer audio source in SyncShow before the service. Save this service, then reload it in SyncShow.</p>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit">Save translation cue</button></footer>
    </form>
  </dialog>
}

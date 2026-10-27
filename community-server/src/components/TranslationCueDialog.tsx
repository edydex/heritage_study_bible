'use client'
import { useWorkspaceText } from './useWorkspaceText'
import {useEffect,useRef,useState} from 'react'
import cueSettings from '../../packages/service-core/node/services/project/TranslationCueSettings.js'
import type {PlannerSlide} from './plannerSlides'
import './translation-cue.css'
export default function TranslationCueDialog({slide,onSave,onClose}:{slide:PlannerSlide;onSave:(value:Record<string,any>)=>void;onClose:()=>void}) {
  const t = useWorkspaceText()
  const dialog=useRef<HTMLDialogElement>(null)
  const [settings,setSettings]=useState<Record<string,any>>(()=>cueSettings.normalizeSettings(slide.cue?.translationSettings))
  useEffect(()=>{dialog.current?.showModal()},[])
  const update=(value:Record<string,any>)=>setSettings((current:any)=>({...current,...value}))
  const reserve=cueSettings.reservation(settings,settings.captionChannel==='both'?'english':settings.captionChannel)
  return <dialog ref={dialog} className="heritage-translation-cue" onCancel={onClose} aria-labelledby="translation-cue-title">
    <form onSubmit={event=>{event.preventDefault();onSave(settings)}}>
      <h2 id="translation-cue-title">{t("Translation · slide")} {slide.number}</h2>
      <p>{t("Prepare audio on the previous slide. Translate from this slide until the next Stop Translate cue.")}</p>
      <label>{t("Speaker’s language")}<select value={settings.sourceLanguage} onChange={event=>update({sourceLanguage:event.target.value,targetLanguage:event.target.value==='en'?'ru':'en',captionChannel:event.target.value==='en'?'russian':'english'})}><option value="en">{t("English → Russian")}</option><option value="ru">{t("Russian → English")}</option></select></label>
      <label><input type="checkbox" checked={settings.speechEnabled} onChange={event=>update({speechEnabled:event.target.checked})}/>  {t("Translated audio for phone listeners")}</label>
      <p>{t("OpenAI realtime interpretation streams translated text and, when enabled, audio as the speaker talks. The interpreter supplies its own voice; a separate narration voice is not used.")}</p>
      <label>{t("On-screen translation")}<select value={settings.captionStyle} onChange={event=>update({captionStyle:event.target.value})}><option value="hidden">{t("Off")}</option><option value="ticker">{t("Scrolling ticker · bottom 12%")}</option><option value="lower-third">{t("Appearing sentences · bottom 29%")}</option></select></label>
      {reserve>0 && <><label>{t("Show translated text on")}<select value={settings.captionChannel} onChange={event=>update({captionChannel:event.target.value})}><option value="english">{t("English screen")}</option><option value="russian">{t("Russian screen")}</option><option value="both">{t("Both audience screens")}</option></select></label><div className="translation-space-example"><span>{t("Slide content ·")} {Math.round((1-reserve)*100)}{t("% height")}</span><aside style={{height:`${reserve*100}%`}}>{t("Translation ·")} {Math.round(reserve*100)}%</aside></div><p>{t("Slides keep their full width. This band takes space from the slide: text wraps and reduces in size only as needed to fit above it. Plan images and objects in the remaining area. The Stage-Facing Screen keeps its full layout.")}</p></>}
      <p>{t("Choose the mixer or computer audio source in SyncShow before the service. Save this service, then reload it in SyncShow.")}</p>
      <footer><button type="button" onClick={onClose}>{t("Cancel")}</button><button type="submit">{t("Save translation cue")}</button></footer>
    </form>
  </dialog>
}

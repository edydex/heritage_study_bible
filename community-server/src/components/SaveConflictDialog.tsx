'use client'
import {useEffect, useMemo, useRef, useState} from 'react'
import ServiceSlidePreview from './ServiceSlidePreview'
import {plannerSlides} from './plannerSlides'
import {conflictDraftSignature, conflictSavedVersion, sameConflictSavedVersion, type ConflictSavedVersion} from './serviceSaveConflict'
import {russianWorkspaceText,translateWorkspaceText} from '../lib/workspaceText'
import './save-conflict.css'

type Project = Record<string, any>
export default function SaveConflictDialog({syncId, localProject, localStatus, initialSlideIndex = 0, initialChannel = 'english', language = 'en', request, localMediaUrl, onResolve, onHistory, onClose}: {
  syncId: string; localProject: Project; localStatus: string; initialSlideIndex?: number; initialChannel?: string; language?: string;
  request: (url:string, options?:RequestInit)=>Promise<any>; localMediaUrl:(assetId:string)=>string|undefined;
  onResolve:(choice:'draft'|'saved',saved:ConflictSavedVersion,localSignature:string)=>Promise<boolean>;
  onHistory:()=>void; onClose:()=>void;
}) {
  const ru=language==='ru',t=(english:string,russian:string)=>ru?russian:english
  const dialog=useRef<HTMLDialogElement>(null)
  const [saved,setSaved]=useState<ConflictSavedVersion|null>(null)
  const [loading,setLoading]=useState(true),[resolving,setResolving]=useState(false),[error,setError]=useState('')
  const [channel,setChannel]=useState(initialChannel),[slideIndex,setSlideIndex]=useState(initialSlideIndex)
  const endpoint=`/api/community/service-documents/${encodeURIComponent(syncId)}`
  const localRows=useMemo(()=>plannerSlides(localProject,channel).filter(row=>row.cue),[localProject,channel])
  const savedRows=useMemo(()=>saved?plannerSlides(saved.project,channel).filter(row=>row.cue):[],[saved,channel])
  const index=Math.min(slideIndex,Math.max(localRows.length,savedRows.length)-1)
  const previewLanguage=channel==='russian'?'ru':channel==='english'?'en':localProject.channels?.media?.language||language
  function reviewError(caught:unknown) {
    const message=caught instanceof Error?caught.message:''
    const translated=translateWorkspaceText(message,ru?'ru':'en')
    if(!ru||translated!==message||Object.values(russianWorkspaceText).includes(message))return translated
    const status=(caught as {status?:number})?.status
    if(status===401)return 'Войдите в рабочую область снова. Ваш черновик остаётся на этом компьютере.'
    if(status===403)return 'Ваша учётная запись больше не имеет доступа к этому документу. Ваш черновик остаётся на этом компьютере.'
    if(status===404)return 'Сохранённый документ больше недоступен. Ваш черновик остаётся на этом компьютере.'
    return 'Не удалось завершить сравнение. Ваш черновик остаётся на этом компьютере. Попробуйте снова.'
  }
  const statusLabel=(status:string)=>({planning:t('Planning','Подготовка'),ready:t('Ready','Готово'),archived:t('Archived','В архиве'),cancelled:t('Cancelled','Отменено')}[status]||status)
  const reviewRequest=useRef(0)
  async function latest() {
    const response=await request(endpoint)
    return conflictSavedVersion(response.serviceDocument,syncId)
  }
  async function load() {
    const identity=++reviewRequest.current;setLoading(true);setError('')
    try {const next=await latest();if(identity===reviewRequest.current)setSaved(next)}
    catch(caught){if(identity===reviewRequest.current)setError(reviewError(caught))}
    finally{if(identity===reviewRequest.current)setLoading(false)}
  }
  useEffect(()=>{
    const invoker=document.activeElement as HTMLElement|null,node=dialog.current
    node?.showModal();void load()
    return()=>{reviewRequest.current++;node?.close();invoker?.focus()}
  },[])
  async function resolve(choice:'draft'|'saved') {
    if(!saved)return
    setResolving(true);setError('')
    const signature=conflictDraftSignature({project:localProject,status:localStatus})
    try {
      const current=await latest()
      if(!sameConflictSavedVersion(saved,current)) {
        setSaved(current);setError(t('The saved version changed again. Review the updated preview before choosing.','Сохранённая версия снова изменилась. Просмотрите новый вариант перед выбором.'));return
      }
      if(await onResolve(choice,current,signature))onClose()
      else {setSaved(await latest());setError(t('Another save arrived while yours was saving. Your draft is safe; review the latest version and choose again.','Во время сохранения появилась другая версия. Ваш черновик сохранён здесь; просмотрите последнюю версию и выберите снова.'))}
    } catch(caught){setError(reviewError(caught))}
    finally{setResolving(false)}
  }
  return <dialog ref={dialog} className="heritage-save-conflict" aria-labelledby="save-conflict-title" onCancel={event=>{event.preventDefault();if(!resolving)onClose()}}>
    <header><div><h2 id="save-conflict-title">{t('Review a save conflict','Сравнить конфликтующие версии')}</h2><p>{t('This document changed elsewhere. Compare both versions before continuing.','Документ изменён в другом месте. Сравните оба варианта перед продолжением.')}</p></div><button type="button" disabled={resolving} onClick={onClose}>{t('Keep editing','Продолжить редактирование')}</button></header>
    {error?<p role="alert">{translateWorkspaceText(error,ru?'ru':'en')}</p>:null}
    <div className="heritage-save-conflict__tools"><label>{t('Preview language','Язык просмотра')}<select value={channel} onChange={event=>setChannel(event.target.value)}><option value="english">{t('English','Английский')}</option><option value="russian">Русский</option><option value="media">{t('Stage-Facing Screen','Экран для сцены')}</option></select></label><button type="button" disabled={loading||resolving} onClick={()=>void load()}>{t('Refresh saved version','Обновить сохранённую версию')}</button><button type="button" disabled={resolving} onClick={onHistory}>{t('View version history','История версий')}</button></div>
    <div className="heritage-save-conflict__versions">
      <section aria-label={t('My draft preview','Просмотр моего черновика')}><h3>{t('My draft','Мой черновик')} <small>{localRows.length} {t('slides','слайдов')} · {statusLabel(localStatus)}</small></h3><div className="heritage-save-conflict__preview" lang={previewLanguage}>{localRows[index]?<ServiceSlidePreview project={localProject} rows={localRows} slide={localRows[index]} channelId={channel} mediaUrl={localMediaUrl}/>:<p>{t('No slide at this position.','Нет слайда в этой позиции.')}</p>}</div><p>{localRows[index]?.title}</p></section>
      <section aria-label={t('Saved version preview','Просмотр сохранённой версии')}><h3>{t('Saved version','Сохранённая версия')} {saved?<small>v{saved.syncVersion} · {savedRows.length} {t('slides','слайдов')} · {statusLabel(saved.status)}</small>:null}</h3><div className="heritage-save-conflict__preview" lang={previewLanguage}>{loading?<p role="status">{t('Loading saved version…','Загрузка сохранённой версии…')}</p>:saved&&savedRows[index]?<ServiceSlidePreview project={saved.project} rows={savedRows} slide={savedRows[index]} channelId={channel} mediaUrl={id=>`${endpoint}/history/${saved.syncVersion}/assets/${encodeURIComponent(id)}`}/>:<p>{t('No slide at this position.','Нет слайда в этой позиции.')}</p>}</div><p>{savedRows[index]?.title}</p></section>
    </div>
    <nav aria-label={t('Comparison slide navigation','Переход между слайдами для сравнения')}><button type="button" disabled={index<=0} onClick={()=>setSlideIndex(index-1)}>{t('Previous slide','Предыдущий слайд')}</button><span>{Math.max(0,index+1)} / {Math.max(localRows.length,savedRows.length)}</span><button type="button" disabled={index>=Math.max(localRows.length,savedRows.length)-1} onClick={()=>setSlideIndex(index+1)}>{t('Next slide','Следующий слайд')}</button></nav>
    <footer><p>{t('Keeping your draft makes it the new current version, replacing the saved content. Using the saved version discards this computer’s unsaved draft. Previous saved versions stay in history.','Сохранение черновика сделает его новой текущей версией, заменив сохранённое содержимое. Выбор сохранённой версии удалит несохранённый черновик на этом компьютере. Все прежние сохранённые версии останутся в истории.')}</p><div><button type="button" disabled={!saved||loading||resolving} onClick={()=>void resolve('draft')}>{resolving?t('Saving…','Сохранение…'):t('Keep my draft as a new version','Сохранить мой черновик как новую версию')}</button><button type="button" disabled={!saved||loading||resolving} onClick={()=>void resolve('saved')}>{t('Use saved version','Использовать сохранённую версию')}</button></div></footer>
  </dialog>
}

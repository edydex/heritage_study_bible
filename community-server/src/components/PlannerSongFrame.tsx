'use client'
import { useEffect, useRef, useState } from 'react'
import { useWorkspaceText } from './useWorkspaceText'
import type { PlannerSongCreatorProps } from './PlannerSongCreator'
import { PLANNER_SONG_FRAME_NAME, plannerSongFrameMessage } from '../lib/plannerSongFrame'

/** Paired SyncShow has service API access without a Payload workspace session.
 * Keep its plan open while the normal workspace form handles sign-in and Save. */
export default function PlannerSongFrame({query,onCreated}:PlannerSongCreatorProps) {
  const t = useWorkspaceText(), dialog = useRef<HTMLDialogElement>(null), frame = useRef<HTMLIFrameElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const [open,setOpen] = useState(false), [dirty,setDirty] = useState(false), [confirmClose,setConfirmClose] = useState(false)
  const keepEditing = useRef<HTMLButtonElement>(null)
  const title = query.trim().slice(0,200)
  function close() {
    dialog.current?.close(); setOpen(false); setDirty(false); setConfirmClose(false); trigger.current?.focus()
  }
  function requestClose() {
    if (dirty) {setConfirmClose(true);return}
    close()
  }
  useEffect(()=>{if(confirmClose)keepEditing.current?.focus()},[confirmClose])
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    const receive = (event:MessageEvent) => {
      const message = plannerSongFrameMessage(event,frame.current?.contentWindow,window.location.origin)
      if (message?.type === 'dirty') setDirty(message.dirty)
      if (message?.type === 'saved') {
        close(); void onCreated(message.syncId)
      }
    }
    window.addEventListener('message',receive)
    return () => window.removeEventListener('message',receive)
  },[open,onCreated])
  return <div className="heritage-add-create-song">
    <button type="button" ref={trigger} onClick={()=>setOpen(true)}><span aria-hidden="true">＋</span><span><strong>{title ? t('Create “{title}”',{title}) : t('Create a song')}</strong><small>{t('Save it to the library, then add it to this service.')}</small></span></button>
    {open && <dialog ref={dialog} className="heritage-planner-song-frame" aria-labelledby="planner-song-frame-title" onKeyDown={event=>{if(event.key==='Escape')event.stopPropagation()}} onCancel={event=>{event.preventDefault();requestClose()}}>
      <header><div><h2 id="planner-song-frame-title">{t('Create a song')}</h2><p>{t('Use your workspace account if sign-in is requested. Your service stays open.')}</p></div><button type="button" onClick={requestClose}>{t('Close')}</button></header>
      {confirmClose && <div className="heritage-planner-song-frame__discard" role="alertdialog" aria-label={t('Discard unsaved song')}><p>{t('Discard this unsaved song? Your service stays open.')}</p><div><button type="button" ref={keepEditing} onClick={()=>setConfirmClose(false)}>{t('Keep editing')}</button><button type="button" onClick={close}>{t('Discard song')}</button></div></div>}
      <iframe ref={frame} inert={confirmClose} name={PLANNER_SONG_FRAME_NAME} title={t('Song editor')} src={`/admin/collections/songs/create?plannerTitle=${encodeURIComponent(title)}`} />
    </dialog>}
  </div>
}

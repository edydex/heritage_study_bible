'use client'

import { PopupList, useConfig, useDocumentInfo, useForm, useFormModified, useRouteTransition } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { songPublicationChange } from '../lib/songPublicationChoice'
import { useWorkspaceText } from './useWorkspaceText'

export default function SongLibraryActions() {
  const {id, data, initialData, hasSavePermission} = useDocumentInfo()
  const {config} = useConfig()
  const {setModified} = useForm()
  const modified = useFormModified()
  const {startRouteTransition} = useRouteTransition()
  const router = useRouter(), t = useWorkspaceText()
  const headingId = useId()
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('')
  const [host,setHost] = useState<HTMLElement|null>(null)
  const dialog = useRef<HTMLDialogElement>(null), pending = useRef(false)
  const saved = data || initialData
  const archived = saved?.status === 'archived'
  const title = String(saved?.title || t('Song'))
  useEffect(()=>{setHost(document.body)},[])
  useEffect(()=>{
    const node = dialog.current
    if (open && node && !node.open) node.showModal()
    else if (!open && node?.open) node.close()
    return ()=>{if(node?.open)node.close()}
  },[open,host])

  async function changeLibraryState() {
    if (!id || !hasSavePermission || pending.current) return
    pending.current=true; setBusy(true); setError('')
    try {
      const change = songPublicationChange(archived ? 'private' : 'archived')
      const response = await fetch(`${config.routes.api}/songs/${encodeURIComponent(id)}?depth=0`, {
        method:'PATCH', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(change), signal:AbortSignal.timeout(20000),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.errors?.[0]?.message || t('Could not update the song. Try again.'))
      if (result.doc?.status !== change.status || result.doc?.songbookVisibility !== 'private') {
        throw new Error(t('The server did not confirm the change. Reload the song to check it.'))
      }
      // Retain the draft on failure. Discard it only after the server confirms
      // the lifecycle change, without saving pending lyric edits.
      setModified(false); setOpen(false)
      startRouteTransition(()=>router.push(`${config.routes.admin}/collections/songs`))
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'Error' ? cause.message
        : t('Could not confirm the change. Check your connection and reload the song.'))
    } finally {pending.current=false; setBusy(false)}
  }

  if (!id || !hasSavePermission) return null
  return <>
    <PopupList.Divider />
    <PopupList.Button id="action-song-library" onClick={()=>{setError('');setOpen(true)}}>
      {t(archived ? 'Restore to library…' : 'Delete from library…')}
    </PopupList.Button>
    {host && createPortal(<dialog ref={dialog} className="heritage-slide-dialog heritage-song-delete"
      onCancel={event=>{event.preventDefault();if(!busy)setOpen(false)}} aria-labelledby={headingId}>
      <header><h2 id={headingId}>{t(archived ? 'Restore “{title}” to the library?' : 'Delete “{title}” from the library?',{title})}</h2></header>
      <p>{t(archived ? 'The song will return to the active library as Private. You can publish it again when ready.'
        : 'This removes the song from the active library and public songbook. Saved services keep their slides. You can restore the song from Archived songs.')}</p>
      {modified && <p>{t('Your unsaved changes will be discarded.')}</p>}
      {error && <p role="alert">{error}</p>}
      <footer>
        <button type="button" disabled={busy} onClick={()=>setOpen(false)}>{t('Cancel')}</button>
        <button type="button" className={archived?'':'heritage-song-delete__confirm'} disabled={busy} onClick={()=>void changeLibraryState()}>
          {t(busy?'Saving…':archived?'Restore to library':'Delete from library')}
        </button>
      </footer>
    </dialog>,host)}
  </>
}

'use client'
import { useDocumentInfo, useFormInitializing, useFormModified } from '@payloadcms/ui'
import { useEffect, useRef } from 'react'
import { PLANNER_SONG_FRAME_NAME } from '../lib/plannerSongFrame'

/** Only the same-origin song editor frame can return a saved song to its caller. */
export function usePlannerSongFrame(title:{value?:string;setValue:(value:string)=>void}, russianTitle:{value?:string;setValue:(value:string)=>void}) {
  const {id,data} = useDocumentInfo(), modified = useFormModified(), initializing = useFormInitializing(), prefilled = useRef(false)
  const fields = useRef({title,russianTitle}); fields.current = {title,russianTitle}
  useEffect(() => {
    if (window.name !== PLANNER_SONG_FRAME_NAME || window.parent === window) return
    try { if (window.parent.location.origin !== window.location.origin) return } catch { return }
    // Native fields register their initial state during mount. Prefill after
    // that registration, and never overwrite a title typed in the meantime.
    const pending = !id && !initializing && !prefilled.current ? requestAnimationFrame(() => {
      prefilled.current = true
      const requested = new URL(window.location.href).searchParams.get('plannerTitle')?.trim().slice(0,200) || ''
      if (requested && !fields.current.title.value) fields.current.title.setValue(requested)
      if (/[а-яё]/i.test(requested) && !fields.current.russianTitle.value) fields.current.russianTitle.setValue(requested)
    }) : undefined
    window.parent.postMessage({type:'heritage-song:dirty',dirty:modified},window.location.origin)
    if (id && typeof data?.syncId === 'string' && !modified) {
      window.parent.postMessage({type:'heritage-song:saved',syncId:data.syncId},window.location.origin)
    }
    return () => {if(pending !== undefined)cancelAnimationFrame(pending)}
  },[id,data?.syncId,modified,initializing,title.value,russianTitle.value,title.setValue,russianTitle.setValue])
}

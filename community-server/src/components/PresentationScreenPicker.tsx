'use client'
import {useEffect,useRef,useState} from 'react'
import {useWorkspaceText} from './useWorkspaceText'

export type PresentationScreens = {screenIds: string[]; hintScreenIds: string[]; localOnly?: true}
export const DEFAULT_PRESENTATION_SCREENS: PresentationScreens = {screenIds: ['english', 'russian', 'media'], hintScreenIds: ['media']}
const screens = [
  {id: 'english', name: 'English', symbol: 'Aa', detail: 'Audience screen'},
  {id: 'russian', name: 'Russian', symbol: 'Яя', detail: 'Audience screen'},
  {id: 'media', name: 'Stage-Facing', symbol: '≡', detail: 'Current slide + what’s next'},
]

export default function PresentationScreenPicker({value, onChange}: {value: PresentationScreens; onChange: (value: PresentationScreens) => void}) {
  const t = useWorkspaceText()
  return <fieldset className="presentation-screen-picker">
    <legend>{t('Which screens will you use?')}</legend>
    {screens.map(screen => {
      const active = value.screenIds.includes(screen.id)
      return <div className={`presentation-screen-card${active ? ' is-selected' : ''}`} key={screen.id}>
        <button type="button" className="presentation-screen-choice" aria-pressed={active} onClick={() => {
          const screenIds = active ? value.screenIds.filter(id => id !== screen.id) : [...value.screenIds, screen.id]
          const hintScreenIds = value.hintScreenIds.filter(id => screenIds.includes(id))
          if (!active && screen.id === 'media') hintScreenIds.push('media')
          onChange({...value, screenIds, hintScreenIds})
        }}><span className="presentation-screen-icon" aria-hidden="true">{screen.symbol}</span><strong>{t(screen.name)}</strong><small>{t(screen.detail)}</small></button>
        <label className="presentation-screen-hint"><input type="checkbox" disabled={!active} checked={value.hintScreenIds.includes(screen.id)} onChange={event => onChange({...value, hintScreenIds: event.target.checked ? [...value.hintScreenIds, screen.id] : value.hintScreenIds.filter(id => id !== screen.id)})} />{t('Show next slide')}</label>
      </div>
    })}
    <p className="presentation-screen-count" role="status">{value.screenIds.length ? t('{count} screen(s) selected', {count: value.screenIds.length}) : t('Choose at least one screen')}</p>
  </fieldset>
}

export function PresentationScreensDialog({value,onApply,onClose}: {value:PresentationScreens;onApply:(value:PresentationScreens)=>void;onClose:()=>void}) {
  const t=useWorkspaceText(), dialog=useRef<HTMLDialogElement>(null)
  const [draft,setDraft]=useState(value)
  useEffect(()=>{dialog.current?.showModal()},[])
  return <dialog ref={dialog} className="presentation-screens-dialog" onCancel={event=>{event.preventDefault();onClose()}}>
    <h2>{t('Presentation screens')}</h2>
    <p>{t('These choices apply to this presentation. Your saved venue setup stays unchanged.')}</p>
    <PresentationScreenPicker value={draft} onChange={setDraft} />
    <footer><button type="button" onClick={onClose}>{t('Cancel')}</button><button type="button" disabled={!draft.screenIds.length} onClick={()=>{onApply(draft);onClose()}}>{t('Apply')}</button></footer>
  </dialog>
}

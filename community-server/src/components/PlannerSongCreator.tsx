'use client'
import { useDocumentDrawer } from '@payloadcms/ui'
import { useWorkspaceText } from './useWorkspaceText'
import { slugifySongTitle } from '../lib/contentAdmin'

export type PlannerSongCreatorProps = { query: string; onCreated: (syncId: string) => Promise<void> }
export default function PlannerSongCreator({query,onCreated}: PlannerSongCreatorProps) {
  const t = useWorkspaceText(), title = query.trim().slice(0,200)
  const [DocumentDrawer,,{openDrawer,closeDrawer,isDrawerOpen}] = useDocumentDrawer({collectionSlug:'songs'})
  return <div className="heritage-add-create-song">
    <button type="button" onClick={openDrawer}><span aria-hidden="true">＋</span><span><strong>{title ? t('Create “{title}”',{title}) : t('Create a song')}</strong><small>{t('Save it to the library, then add it to this service.')}</small></span></button>
    {isDrawerOpen && <DocumentDrawer initialData={{title, slug:slugifySongTitle(title), ...(/[а-яё]/i.test(title) ? {russianTitle:title} : {}),songbookVisibility:'private'}} redirectAfterCreate={false} onSave={async ({doc}) => {
      closeDrawer()
      await onCreated((doc as typeof doc & {syncId?:string}).syncId || '')
    }} />}
  </div>
}

'use client'
import { useWorkspaceText } from './useWorkspaceText'

export default function SongAudienceLanguages({ item, onChange }: { item: any; onChange: (value: string) => void }) {
  const t = useWorkspaceText()
  const value = item.songPresentation.audienceLanguage || (item.songPresentation.stackedTranslation ? 'both' : '')
  return <div className="heritage-song-audience">
    <span>{t('Show lyrics · whole song')}</span>
    <div role="group" aria-label={t('Song audience languages')}>
      {[['both', 'Both languages'], ['english', 'English only'], ['russian', 'Russian only']].map(([id, label]) =>
        <button key={id} type="button" aria-pressed={value === id}
          disabled={id === 'both' ? !item.songPresentation.secondaryChannelId : item.variants[id]?.mode !== 'content'}
          onClick={() => onChange(id)}>{t(label)}</button>)}
    </div>
  </div>
}

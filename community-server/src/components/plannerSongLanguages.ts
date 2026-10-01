import core from '../../packages/service-core/index.js'

/** Change presentation only. Both pinned sources and per-slide choices survive. */
export function setSongAudienceLanguage(project: any, itemId: string, language: string) {
  const next = JSON.parse(JSON.stringify(project)), item = next.items[itemId]
  if (item?.kind !== 'song' || !item.songPresentation) throw new Error('Choose a song with configured lyrics.')
  if (language !== 'both' && item.variants[language]?.mode !== 'content') throw new Error('Add lyrics in that language first.')
  if (language === 'both' && !item.songPresentation.secondaryChannelId) throw new Error('Add both languages first.')
  item.songPresentation.audienceLanguage = language
  // Retain title visibility and individual singing-language choices, even in solo mode.
  item.songPresentation.stackedTranslation = language === 'both'
  item.lyricsPresetId = language === 'both' ? 'wotbc-song-stacked' : 'wotbc-song-lyrics'
  item.updatedAt = new Date().toISOString()
  return core.normalizeServiceProject(next)
}

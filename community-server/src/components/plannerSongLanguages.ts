import core from '../../packages/service-core/index.js'
import { plannerSlides } from './plannerSlides'

/** Cached offline libraries retain these annotations in canonical documents. */
export function songDocumentSectionLanguages(documents: any[]) {
  const choices: Record<string,'en'|'ru'> = Object.create(null), languages = new Set<string>()
  for (const {document} of documents) {
    const language = document?.language
    if ((language!=='en' && language!=='ru') || languages.has(language)) continue
    languages.add(language)
    const metadata = document.extraMetadata?.primarySections
    if (typeof metadata!=='string' || metadata.length>2048) continue
    let ids: unknown
    try { ids = JSON.parse(metadata) } catch { continue }
    if (!Array.isArray(ids)) continue
    for (const value of ids) {
      if (typeof value!=='string') continue
      const id = value.replace(/-repeat-\d+$/, '')
      if (choices[id] && choices[id]!==language) throw new Error(`Choose one primary language for section “${id}” in the song library.`)
      choices[id] = language
    }
  }
  return choices
}

/** Copy library defaults into existing per-slide settings when a song is first pinned. */
export function applySongSectionLanguages(project: any, itemId: string, choices: Record<string,'en'|'ru'> = {}) {
  if (!Object.keys(choices).length) return project
  const next = JSON.parse(JSON.stringify(project)), item = next.items[itemId]
  if (item?.kind !== 'song' || !item.songPresentation) return project
  const primary = next.resources[item.variants[item.primaryChannelId]?.resourceId]?.document
  for (const row of plannerSlides(next)) {
    if (row.itemId !== itemId || !row.cue?.sourceReference?.sectionId) continue
    const section = primary?.sections.find((value:any)=>value.id===row.cue!.sourceReference.sectionId)
    const language = section && (choices[section.marker] || choices[section.id]
      || choices[section.marker.replace(/-repeat-\d+$/, '')] || choices[section.id.replace(/-repeat-\d+$/, '')])
    const channel = language==='en' ? 'english' : language==='ru' ? 'russian' : null
    if (!channel || next.resources[item.variants[channel]?.resourceId]?.document.language !== language) continue
    ;(item.songPresentation.slidePrimaryChannelIds ||= {})[row.cue!.sourceLeafKey] = channel
  }
  return core.normalizeServiceProject(next)
}

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

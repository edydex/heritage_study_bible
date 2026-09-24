import { groupSermonSections } from './plannerSermonSections'
import { flattenReadingGroups, attachSectionBlanks } from './plannerReadingGroups'
import typography from '../../packages/service-core/node/services/project/SlideTypography.js'
import core from '../../packages/service-core/index.js'
import formatting from '../../packages/service-core/node/services/project/SlideFormatting.js'
import readingLabels from '../../packages/service-core/node/services/project/ReadingLabels.js'

type RecordValue = Record<string, any>

// Wide 16:9 reading pages, following the church's reference decks.
// Both languages use the same verse boundaries, sized for the longer output.
export const SCRIPTURE_PAGE_MAX_VERSES = 12
export const SCRIPTURE_PAGE_MAX_LINES = 10
export function scriptureLineCount(text: string) {
  return typography.wrappedLines(text, 85, 1920 * .98, '500')
}

export function scripturePages(item: RecordValue): number[][] {
  const presetId=['scripture-large','scripture-text'].includes(item.presetId) ? 'wotbc-reading'
    : item.presetId==='wotbc-sermon-verse' ? 'wotbc-sermon-scripture' : item.presetId
  const passages = Object.values(item.passagesByChannel) as RecordValue[]
  const verseNumbers = passages[0].verses.map((verse: RecordValue) => verse.number)
  if (passages.some(passage => JSON.stringify(passage.verses.map((verse: RecordValue) => verse.number)) !== JSON.stringify(verseNumbers))) {
    throw new Error('Scripture outputs must cover the same verses before splitting into slides.')
  }
  const pages: number[][] = []
  let current: number[] = []
  for (const number of verseNumbers) {
    const candidate = [...current, number]
    const size = item.textStyle?.bodySize || typography.textPreset(presetId).bodySize
    // Use the same font metrics, reference, credit and available rectangle as
    // the output renderer. A size change changes page capacity, not the text.
    const cue = {kind:'bible',presetId,channels:Object.fromEntries(passages.map((passage,index)=>[index,{
      mode:'content',blocks:[{...passage,type:'bible',reference:pageReference(passage.reference,item,candidate),
        verses:passage.verses.filter((verse:RecordValue)=>candidate.includes(verse.number))}]
    }]))}
    const fits = typography.groupFontSize([cue],size,size-1) === size
    if (current.length && !fits) { pages.push(current); current = [] }
    current.push(number)
  }
  if (current.length) pages.push(current)
  return pages
}

function pageReference(reference: string, item: RecordValue, numbers: number[]) {
  const book = reference.replace(/\s+\d+:.*$/, '')
  return `${book} ${item.range.start.chapter}:${formatting.verseSelectionLabel(numbers)}`
}

/** Materialize pages as standard Bible items, not browser-only previews.
 * Existing SyncShow versions therefore receive exactly the same slide breaks.
 * No source lyrics, verse text, attribution, media, or library records change.
 * This is an unsaved draft change until the manager saves a new revision. */
export function preparePlannerPresentation(project: RecordValue, options: {paginateItemIds?: ReadonlySet<string>} = {}) {
  const next = JSON.parse(JSON.stringify(project))
  let changed = false
  let readingsSplit = 0
  for (const item of Object.values(next.items) as RecordValue[]) {
    if (item.kind === 'song') {
      if (!item.songPresentation) {
        const direct = next.channelIds.filter((id: string) => item.variants[id]?.mode === 'content')
        const primaryChannelId = direct.find((id: string) => next.channels[id]?.language === 'ru') || direct[0]
        const primaryDocument = next.resources[item.variants[primaryChannelId].resourceId].document
        const secondaryChannelId = direct.find((id: string) => id !== primaryChannelId
          && next.resources[item.variants[id].resourceId].document.language !== primaryDocument.language) || null
        const authors = direct.flatMap((id: string) => {
          const document = next.resources[item.variants[id].resourceId].document
          return [...(document.authors || []), ...(document.composers || []), ...(document.translators || [])]
        })
        item.songPresentation = { stackedTranslation: Boolean(secondaryChannelId), primaryChannelId, secondaryChannelId,
          credits: [...new Set(authors)].join(' / ').slice(0, 500) }
        item.titlePresetId = 'wotbc-song-title'
        item.lyricsPresetId = secondaryChannelId ? 'wotbc-song-stacked' : 'wotbc-song-lyrics'
        changed = true
      }
      for (const variant of Object.values(item.variants) as RecordValue[]) {
        if (variant.mode !== 'hidden' && !variant.titleCardMode) {
          variant.titleCardMode = 'simple'
          changed = true
        }
      }
    }
    if (item.kind !== 'bible') continue
    if (item.presetId === 'wotbc-sermon-verse') { item.presetId = 'wotbc-sermon-scripture'; changed = true }
    if (['scripture-large', 'scripture-text'].includes(item.presetId)) {
      item.presetId = 'wotbc-reading'
      changed = true
    }
    // Loading or editing an existing service preserves authored page boundaries.
    if (options.paginateItemIds && !options.paginateItemIds.has(item.id)) continue
    // An edited slide is an intentional excerpt; automatic repagination would lose its words.
    if (Object.values(item.passagesByChannel).some((passage: any) => passage.displayText !== undefined)
      || (item.verseNumbers && item.verseNumbers.length <= SCRIPTURE_PAGE_MAX_VERSES)) continue
    const pages = scripturePages(item)
    if (pages.length <= 1) continue
    const childIds: string[] = []
    pages.forEach(numbers => {
      const id = `${item.id.slice(0, 100)}-v${numbers[0]}-${numbers.at(-1)}`
      if (next.items[id]) throw new Error(`A Scripture slide already uses the identifier ${id}.`)
      childIds.push(id)
      const passagesByChannel = Object.fromEntries(Object.entries(item.passagesByChannel).map(([channelId, raw]) => {
        const passage = raw as RecordValue
        const { contentSha256: _oldHash, ...rest } = passage
        const verses = passage.verses.filter((verse: RecordValue) => numbers.includes(verse.number))
        const first = passage.verses.findIndex((verse: RecordValue) => verse.number === numbers[0])
        const offset = first ? formatting.scriptureFlowText(passage.verses.slice(0, first)).length + 1 : 0
        const length = formatting.scriptureFlowText(verses).length
        const spans = (passage.spans || []).filter((span: any) => span.end > offset && span.start < offset + length)
          .map((span: any) => ({ ...span, start: Math.max(0, span.start - offset), end: Math.min(length, span.end - offset) }))
        delete rest.spans
        return [channelId, { ...rest, reference: pageReference(passage.reference, item, numbers),
          verses, ...(spans.length ? { spans } : {}) }]
      }))
      const firstPassage = Object.values(passagesByChannel)[0] as RecordValue
      next.items[id] = { ...item, id, title: firstPassage.reference,
        range: { ...item.range, start: { ...item.range.start, verse: numbers[0] }, end: { ...item.range.end, verse: numbers.at(-1) } },
        passagesByChannel, ...(item.verseNumbers ? {verseNumbers: numbers} : {}), presetId: item.presetId }
    })
    next.items[item.id] = { id: item.id, kind: 'group', groupKind: 'section', title: item.title,
      createdAt: item.createdAt, updatedAt: item.updatedAt, operatorNotes: item.operatorNotes,
      ...(item.plannedDurationSeconds !== undefined ? { plannedDurationSeconds: item.plannedDurationSeconds } : {}), childIds }
    // Keep the original planned duration on the reading group, not each page.
    childIds.forEach(id => { delete next.items[id].plannedDurationSeconds })
    changed = true
    readingsSplit++
  }
  changed = flattenReadingGroups(next) || changed
  changed = attachSectionBlanks(next) || changed
  changed = groupSermonSections(next) || changed
  if (!changed) return { project, changed: false, readingsSplit: 0 }
  // A linked sermon reading may now have more pages; keep its provenance and
  // update the page counters in actual service order.
  const linked = new Map<string, RecordValue[]>()
  const visit = (id: string) => {
    const item = next.items[id]
    if (item.kind === 'group') return item.childIds.forEach(visit)
    if (!item.sermonReading) return
    const key = `${item.sermonReading.sermonResourceId}:${item.sermonReading.referenceId}`
    const entries = linked.get(key) || []
    entries.push(item)
    linked.set(key, entries)
  }
  next.rootItemIds.forEach(visit)
  linked.forEach(items => items.forEach((item, index) => {
    item.sermonReading = { ...item.sermonReading, chunkIndex: index, chunkCount: items.length }
  }))
  return { project: JSON.parse(JSON.stringify(core.normalizeServiceProject(next))), changed, readingsSplit }
}


export function addReadingTitle(project: RecordValue, itemId: string, names: Record<string, string>) {
  const next = JSON.parse(JSON.stringify(project)), item = next.items[itemId]
  const titleId = `${itemId}-title`, groupId = `${itemId}-reading`
  const textByChannel: Record<string,string> = {}, spansByChannel: Record<string,any[]> = {}
  for (const [channel, raw] of Object.entries(item.passagesByChannel)) {
    const passage = raw as RecordValue
    const language = next.channels[channel].language === 'und' && channel === 'media' ? next.channels.russian?.language : next.channels[channel].language
    const reference = readingLabels.localizedReference(passage.reference, language)
    textByChannel[channel] = `${reference}\n${readingLabels.localizedEdition(names[channel] || passage.translationId, language)}`
    spansByChannel[channel] = [{start:0,end:reference.length,weight:'700'}]
  }
  next.items[titleId] = {id:titleId,kind:'notice',title:item.title,textByChannel,spansByChannel,presetId:'wotbc-reading-title',operatorNotes:'',createdAt:item.createdAt,updatedAt:item.updatedAt}
  const parent = Object.values(next.items).find((value:any)=>value.kind==='group' && value.childIds.includes(itemId)) as any
  const siblings = parent ? parent.childIds : next.rootItemIds
  siblings.splice(siblings.indexOf(itemId),1,groupId)
  next.items[groupId] = {id:groupId,kind:'group',groupKind:'section',title:item.title,childIds:[titleId,itemId],operatorNotes:'',createdAt:item.createdAt,updatedAt:item.updatedAt}
  return core.normalizeServiceProject(next)
}

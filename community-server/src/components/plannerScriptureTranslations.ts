import core from '../../packages/service-core/index.js'
import { readingOwner } from './plannerReadingGroups'
import readingLabels from '../../packages/service-core/node/services/project/ReadingLabels.js'

type Project = Record<string, any>
export type ScriptureTranslationScope = { itemIds: string[]; titleId?: string }

/** A reading is one unit; separate sermon references must never change together. */
export function scriptureTranslationScope(project: Project, selectedId: string): ScriptureTranslationScope | null {
  const readingId = readingOwner(project, selectedId)
  if (readingId) {
    const group = project.items[readingId]
    const itemIds = group.childIds.filter((id: string) => project.items[id]?.kind === 'bible')
    return itemIds.length ? {itemIds, titleId: group.childIds[0]} : null
  }
  const item = project.items[selectedId]
  if (item?.kind !== 'bible') return null
  const parent = (Object.values(project.items) as any[]).find(value => value.kind === 'group' && value.childIds.includes(selectedId))
  // Pagination creates this exact family of page IDs. A sermon group may contain
  // many unrelated passages, so sharing a parent alone is not enough.
  const pages = parent?.childIds.filter((id: string) => project.items[id]?.kind === 'bible') as string[] | undefined
  if (parent && pages?.length && pages.every(id => id.startsWith(`${parent.id.slice(0, 100)}-v`)
    && project.items[id].range.bookId === item.range.bookId
    && project.items[id].range.start.chapter === item.range.start.chapter)) return {itemIds: pages}
  return {itemIds: [selectedId]}
}

export function scriptureTranslationRequest(project: Project, scope: ScriptureTranslationScope, translationId: string) {
  const items = scope.itemIds.map(id => project.items[id])
  const {bookId, start} = items[0].range
  if (items.some(item => item.range.bookId !== bookId || item.range.start.chapter !== start.chapter || item.range.end.chapter !== start.chapter)) {
    throw new Error('Choose a passage within one chapter to change its translation.')
  }
  const verseNumbers = [...new Set<number>(items.flatMap(item => (Object.values(item.passagesByChannel)[0] as any).verses.map((verse: any) => verse.number)))].sort((a,b) => a-b)
  return {schemaVersion:1, bookId, chapter:start.chapter, startVerse:verseNumbers[0], endVerse:verseNumbers.at(-1), verseNumbers,
    translations:{english:translationId,russian:translationId}}
}

export function hasScriptureEdits(project: Project, scope: ScriptureTranslationScope, channel: 'english' | 'russian') {
  const channels = channel === 'russian' ? ['russian','media'] : ['english']
  return scope.itemIds.some(id => channels.some(output => {
    const passage = project.items[id].passagesByChannel[output]
    return passage && (passage.displayText !== undefined || passage.spans?.length || passage.displaySpans?.length)
  }))
}

/** Replace only the requested output (and its stage copy), retaining exact page
 * boundaries, discontiguous verses, headings, cues, styling and the other language. */
export function replaceScriptureTranslation(project: Project, scope: ScriptureTranslationScope, options: {
  channel: 'english' | 'russian'; translationId: string; translationName: string;
  passage: any; sourceUrl: string
}) {
  const {channel, passage, translationId, translationName, sourceUrl} = options
  if (passage.translationId !== translationId) throw new Error('The Bible source returned a different translation. Nothing was changed.')
  const next = JSON.parse(JSON.stringify(project))
  const channels = channel === 'russian' ? ['russian','media'] : ['english']
  for (const id of scope.itemIds) {
    const item = next.items[id]
    for (const output of channels) {
      const previous = item.passagesByChannel[output]
      if (!previous) continue
      const verses = previous.verses.map((verse: any) => passage.verses.find((value: any) => value.number === verse.number))
      if (verses.some((verse: any) => !verse || typeof verse.text !== 'string' || !verse.text.trim())) {
        throw new Error('The Bible source did not return every selected verse. Nothing was changed.')
      }
      const {contentSha256: _hash, spans: _spans, displayText: _text, displaySpans: _displaySpans, ...source} = passage
      item.passagesByChannel[output] = {...source, reference:previous.reference, verses}
    }
    const editions = `${item.passagesByChannel.english?.translationId} / ${item.passagesByChannel.russian?.translationId}`
    item.title = item.title.replace(/ · [^·]+ \/ [^·]+$/, ` · ${editions}`)
    const label = channel === 'english' ? 'English' : 'Russian'
    const sourceLine = `${label} source: ${sourceUrl}`
    const pattern = new RegExp(`^${label} source:.*$`, 'm')
    item.operatorNotes = pattern.test(item.operatorNotes || '') ? item.operatorNotes.replace(pattern, sourceLine)
      : [item.operatorNotes,sourceLine].filter(Boolean).join('\n')
    item.updatedAt = new Date().toISOString()
  }
  if (scope.titleId) {
    const title = next.items[scope.titleId]
    for (const output of channels) {
      const language = next.channels[output]?.language === 'und' && output === 'media'
        ? next.channels.russian?.language : next.channels[output]?.language
      const name = readingLabels.localizedEdition(translationName, language)
      if (title.textByChannel?.[output]) {
        const [reference, , ...rest] = title.textByChannel[output].split('\n')
        title.textByChannel[output] = [reference,name,...rest].join('\n')
      }
      const edition = title.objectsByChannel?.[output]?.find((object: any) => object.id === 'reading-edition')
      if (edition) { edition.text = name; edition.spans = [] }
    }
    const first = next.items[scope.itemIds[0]]
    const suffix = ` · ${first.passagesByChannel.english?.translationId} / ${first.passagesByChannel.russian?.translationId}`
    title.title = title.title.replace(/ · [^·]+ \/ [^·]+$/, suffix)
    const owner = readingOwner(next, title.id)
    if (owner) next.items[owner].title = next.items[owner].title.replace(/ · [^·]+ \/ [^·]+$/, suffix)
  }
  return core.normalizeServiceProject(next)
}

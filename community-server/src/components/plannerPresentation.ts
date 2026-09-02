import core from '../../packages/service-core/index.js'

type RecordValue = Record<string, any>

// Conservative 16:9 reading pages: never squeeze an entire passage into a cue.
// Both languages use the same verse boundaries, sized for the longer output.
export const SCRIPTURE_PAGE_MAX_VERSES = 2
export const SCRIPTURE_PAGE_MAX_LINES = 6
const SCRIPTURE_LINE_CHARACTERS = 44

export function scriptureLineCount(text: string) {
  return text.split('\n').reduce((total, paragraph) => {
    let lines = 1
    let used = 0
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (used && used + 1 + word.length > SCRIPTURE_LINE_CHARACTERS) { lines++; used = 0 }
      used += (used ? 1 : 0) + word.length
      while (used > SCRIPTURE_LINE_CHARACTERS) { lines++; used -= SCRIPTURE_LINE_CHARACTERS }
    }
    return total + lines
  }, 0)
}

export function scripturePages(item: RecordValue): number[][] {
  const passages = Object.values(item.passagesByChannel) as RecordValue[]
  const verseNumbers = passages[0].verses.map((verse: RecordValue) => verse.number)
  if (passages.some(passage => JSON.stringify(passage.verses.map((verse: RecordValue) => verse.number)) !== JSON.stringify(verseNumbers))) {
    throw new Error('Scripture outputs must cover the same verses before splitting into slides.')
  }
  const pages: number[][] = []
  let current: number[] = []
  for (const number of verseNumbers) {
    const candidate = [...current, number]
    const fits = candidate.length <= SCRIPTURE_PAGE_MAX_VERSES && passages.every(passage => (
      passage.verses.filter((verse: RecordValue) => candidate.includes(verse.number))
        .reduce((count: number, verse: RecordValue) => count + scriptureLineCount(`${verse.number} ${verse.text}`), 0)
      <= SCRIPTURE_PAGE_MAX_LINES
    ))
    if (current.length && !fits) { pages.push(current); current = [] }
    current.push(number)
  }
  if (current.length) pages.push(current)
  return pages
}

function pageReference(reference: string, item: RecordValue, numbers: number[]) {
  const book = reference.replace(/\s+\d+:.*$/, '')
  return `${book} ${item.range.start.chapter}:${numbers[0]}${numbers.length > 1 ? `–${numbers.at(-1)}` : ''}`
}

/** Materialize pages as standard Bible items, not browser-only previews.
 * Existing SyncShow versions therefore receive exactly the same slide breaks.
 * No source lyrics, verse text, attribution, media, or library records change.
 * This is an unsaved draft change until the manager saves a new revision. */
export function preparePlannerPresentation(project: RecordValue) {
  const next = JSON.parse(JSON.stringify(project))
  let changed = false
  let readingsSplit = 0
  for (const item of Object.values(next.items) as RecordValue[]) {
    if (item.kind === 'song') {
      for (const variant of Object.values(item.variants) as RecordValue[]) {
        if (variant.mode !== 'hidden' && !variant.titleCardMode) {
          variant.titleCardMode = 'simple'
          changed = true
        }
      }
    }
    if (item.kind !== 'bible') continue
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
        return [channelId, { ...rest, reference: pageReference(passage.reference, item, numbers),
          verses: passage.verses.filter((verse: RecordValue) => numbers.includes(verse.number)) }]
      }))
      const firstPassage = Object.values(passagesByChannel)[0] as RecordValue
      next.items[id] = { ...item, id, title: firstPassage.reference,
        range: { ...item.range, start: { ...item.range.start, verse: numbers[0] }, end: { ...item.range.end, verse: numbers.at(-1) } },
        passagesByChannel, presetId: 'scripture-large' }
    })
    next.items[item.id] = { id: item.id, kind: 'group', groupKind: 'section', title: item.title,
      createdAt: item.createdAt, updatedAt: item.updatedAt, operatorNotes: item.operatorNotes,
      ...(item.plannedDurationSeconds !== undefined ? { plannedDurationSeconds: item.plannedDurationSeconds } : {}), childIds }
    // Keep the original planned duration on the reading group, not each page.
    childIds.forEach(id => { delete next.items[id].plannedDurationSeconds })
    changed = true
    readingsSplit++
  }
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

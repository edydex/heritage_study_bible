import { splitParagraphText } from '../utils/verseLayout'

export const originalLanguages = {
  id: 'ORIGINAL', abbr: 'Original', name: 'Original languages', language: 'Original languages',
  description: 'Greek New Testament · Nestle 1904. Romans word links with BSB.',
  license: 'Public domain / CC0', parallelOnly: true,
}

let linksPromise
export function loadRomansWordLinks() {
  if (!linksPromise) {
    linksPromise = fetch(`${import.meta.env.BASE_URL}data/original-languages/romans-bsb-links.json`)
      .then(response => {
        if (!response.ok) throw new Error('Word links could not be loaded.')
        return response.json()
      }).then(data => {
        if (data?.schemaVersion !== 1 || data.sourceId !== 'N1904' || data.targetId !== 'BSB' || data.book !== 'Romans') throw new Error('Unrecognized word-link source.')
        return data
      }).catch(error => { linksPromise = null; throw error })
  }
  return linksPromise
}

export function visibleVerseText(text) {
  return splitParagraphText(text).segments.map(segment => segment.replace(/\s*\|\|\s*/g, '\n').replace(/<\/?b>/g, '')).join('\n')
}

export function verseWordLinks(data, chapter, verse, sourceText, targetText) {
  const entry = data?.verses?.[`${chapter}:${verse}`]
  const source = visibleVerseText(sourceText), target = visibleVerseText(targetText)
  if (!entry || entry.sourceText !== source || entry.targetText !== target || !Array.isArray(entry.groups)) return null
  const ranges = (range, length) => Array.isArray(range) && range.length === 2 && range.every(Number.isInteger)
    && range[0] >= 0 && range[1] > range[0] && range[1] <= length
  if (entry.groups.some(group => !Number.isInteger(group.id) || group.id < 0
    || !ranges(group.source, source.length) || !ranges(group.target, target.length))) return null
  return {
    source: entry.groups.map(group => ({
      id: `${chapter}:${verse}:${group.id}`, pattern: group.id % 6,
      startOffset: group.source[0], endOffset: group.source[1],
      label: `${source.slice(...group.source)} ↔ ${target.slice(...group.target)}`,
    })),
    target: entry.groups.map(group => ({
      id: `${chapter}:${verse}:${group.id}`, pattern: group.id % 6,
      startOffset: group.target[0], endOffset: group.target[1],
      label: `${source.slice(...group.source)} ↔ ${target.slice(...group.target)}`,
    })),
  }
}

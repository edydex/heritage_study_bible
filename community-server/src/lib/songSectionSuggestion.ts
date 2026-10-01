import { songDocumentBody, songSectionMarker } from './songSourceSyntax'

type Section = { id: string; pages: string[][] }
export type SongSectionSuggestion = { text: string; repeats: number; lines: number }
export class SongSectionSuggestionError extends Error {
  constructor(public key: string, public variables: Record<string, string | number>) {
    super(key.replace(/\{(\w+)\}/g, (_, name) => String(variables[name])));
  }
}

const lyricLines = (text: string) => text.split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean)
const hasHeading = (text: string) => text.split(/\r\n|\r|\n/).some(line => /^\s*\^[^\^]/.test(line)
  || songSectionMarker(line.replace(/\s*\(?[xх×]\s*\d+\)?\s*$/iu, '')))
function englishHeading(id: string) {
  if (/^\d+(?:-[a-zа-я])?$/iu.test(id)) return `Verse ${id.replace('-', ' ')}`
  return ({ chorus: 'Chorus', 'refrain-section': 'Refrain', 'pre-chorus': 'Pre-chorus', bridge: 'Bridge', intro: 'Intro', outro: 'Outro', tag: 'Tag' } as Record<string, string>)[id] || `^${id}`
}

/** Structural proposal only: never translates, paraphrases, or writes form state. */
export function suggestEnglishSongSections(russian: string, english: string): SongSectionSuggestion {
  if (!hasHeading(russian)) throw new Error('Add verse or chorus labels to Russian lyrics first.')
  if (hasHeading(english)) throw new Error('English already has section labels. Review those sections directly.')
  const body = songDocumentBody(russian)
  const sections: Section[] = body.split(/(?=^\^[^\^])/m).filter(part => part.trim()).map(part => {
    const [heading, ...lines] = part.trim().split('\n')
    return { id: heading.slice(1), pages: lines.join('\n').split(/\n---\n/).map(lyricLines) }
  })
  const definitions = new Map<string, Section>()
  for (const section of sections) {
    if (definitions.has(section.id) && JSON.stringify(definitions.get(section.id)!.pages) !== JSON.stringify(section.pages)) {
      throw new Error('Russian uses the same section label for different words. Give those sections distinct labels first.')
    }
    definitions.set(section.id, section)
  }
  const count = (values: Section[]) => values.reduce((sum, section) => sum + section.pages.flat().length, 0)
  const uniqueCount = count([...definitions.values()]), fullCount = count(sections)
  const input = lyricLines(english).filter(line => !/^[-–—]{3,}$/.test(line) && !/^\^{2}/.test(line))
  if (!input.length) throw new Error('Paste the English lyrics first.')
  if (input.length !== uniqueCount && input.length !== fullCount) {
    throw new SongSectionSuggestionError(uniqueCount !== fullCount
      ? 'English has {actual} lines; Russian needs {unique} before repeats or {full} including repeats. Adjust the line breaks or label the English sections manually.'
      : 'English has {actual} lines; Russian needs {unique}. Adjust the line breaks or label the English sections manually.',
    { actual: input.length, unique: uniqueCount, full: fullCount })
  }
  const expanded = input.length === fullCount && fullCount !== uniqueCount
  let cursor = 0, repeats = 0
  const proposed = new Map<string, string>()
  const output = sections.map(section => {
    const previous = proposed.get(section.id)
    let text = previous
    if (!previous || expanded) {
      text = section.pages.map(page => { const rows = input.slice(cursor, cursor + page.length); cursor += page.length; return rows.join('\n') }).join('\n\n')
      if (previous && text !== previous) throw new Error('A repeated English section has different words. Label it separately instead of treating it as a repeat.')
    }
    if (previous) { repeats++; return englishHeading(section.id) }
    proposed.set(section.id, text!)
    return `${englishHeading(section.id)}\n${text}`
  }).join('\n\n')
  return { text: output, repeats, lines: input.length }
}

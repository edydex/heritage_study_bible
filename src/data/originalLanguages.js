import { splitParagraphText } from '../utils/verseLayout'

export const originalLanguages = {
  id: 'ORIGINAL', abbr: 'Original', name: 'Original languages', language: 'Original languages',
  description: 'Hebrew/Aramaic · WLC/OSHB; Greek · Nestle 1904. Source lemma concordances, BSB word links and partial LSV phrase links.',
  license: 'Public domain / CC0; OSHB metadata CC BY 4.0', parallelOnly: true,
}

const translationLinks = new Map()
export const greekWordLinkTranslations = ['BSB', 'LSV', 'KJV']
export function loadGreekWordLinks(book, targetId = 'BSB') {
  if (!greekWordLinkTranslations.includes(targetId)) return Promise.reject(new Error('Word mappings are not installed for this translation.'))
  const key = `${targetId}:${book}`
  if (!translationLinks.has(key)) {
    const filename = encodeURIComponent(book.toLowerCase().replaceAll(' ', '-'))
    const request = fetch(`${import.meta.env.BASE_URL}data/original-languages/${targetId.toLowerCase()}-word-links/${filename}.json`)
      .then(response => { if (!response.ok) throw new Error('Word mappings could not load.'); return response.json() })
      .then(data => {
        if (data.schemaVersion !== 1 || data.sourceId !== 'N1904' || data.targetId !== targetId || data.book !== book
          || data.provenance?.greekSha256 !== '3beee6abb6302f691110fe0fc949fc195593b999cf2d0e463c9b573c1bb67150') throw new Error('Word mapping source does not match.')
        return data
      }).catch(error => { translationLinks.delete(key); throw error })
    translationLinks.set(key, request)
  }
  return translationLinks.get(key)
}

export function visibleVerseText(text) {
  return splitParagraphText(text).segments.map(segment => segment.replace(/\s*\|\|\s*/g, '\n').replace(/<\/?b>/g, '')).join('\n')
}

export function verseWordLinks(data, chapter, verse, sourceText, targetText) {
  const entry = data?.verses?.[`${chapter}:${verse}`]
  const source = visibleVerseText(sourceText), target = visibleVerseText(targetText)
  if (!entry || entry.sourceText !== source || entry.targetText !== target || !Array.isArray(entry.groups)) return null
  // The one-verse compatibility helper cannot represent shifted references.
  // Chapter-level consumers use the exact source-anchor graph instead.
  if ((entry.sourceReference && (entry.sourceReference.chapter !== chapter || entry.sourceReference.verse !== verse))
    || entry.groups.some(group => group.sourceAnchors?.some(anchor => anchor.chapter !== chapter || anchor.verse !== verse))) return null
  const ranges = (range, length) => Array.isArray(range) && range.length === 2 && range.every(Number.isInteger)
    && range[0] >= 0 && range[1] > range[0] && range[1] <= length
  if (entry.groups.some(group => !Number.isInteger(group.id) || group.id < 0
    || !ranges(group.source, source.length) || !ranges(group.target, target.length)
    || (group.sourceRanges && (!Array.isArray(group.sourceRanges) || !group.sourceRanges.length
      || group.sourceRanges.some(range => !ranges(range, source.length))))
    || (group.targetRanges && (!Array.isArray(group.targetRanges) || !group.targetRanges.length
      || group.targetRanges.some(range => !ranges(range, target.length)))))) return null
  const groups = entry.groups.map(group => ({ ...group, sources: group.sourceRanges || [group.source], targets: group.targetRanges || [group.target] }))
  const parent = groups.map((_, i) => i)
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  const overlap = (a, b) => a[0] < b[1] && a[1] > b[0]
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
    if (groups[i].sources.some(a => groups[j].sources.some(b => overlap(a, b)))
      || groups[i].targets.some(a => groups[j].targets.some(b => overlap(a, b)))) parent[find(j)] = find(i)
  }
  const components = new Map()
  groups.forEach((group, i) => { const key = find(i); if (!components.has(key)) components.set(key, []); components.get(key).push(group) })
  const unique = values => [...new Map(values.map(range => [range.join(':'), range])).values()].sort((a, b) => a[0] - b[0])
  const result = { source: [], target: [] }
  for (const component of components.values()) {
    const sourceRanges = unique(component.flatMap(group => group.sources)), targetRanges = unique(component.flatMap(group => group.targets))
    const id = `${chapter}:${verse}:${Math.min(...component.map(group => group.id))}`
    const pattern = [...source.slice(0, sourceRanges[0][0]).matchAll(/\S+/g)].length % 6
    const sourceRange = [sourceRanges[0][0], Math.max(...sourceRanges.map(range => range[1]))]
    const label = `${sourceRanges.map(range => source.slice(...range)).join(' … ')} ↔ ${targetRanges.map(range => target.slice(...range)).join(' … ')}`
    const common = { id, pattern, sourceRange, sourceRanges, label }
    for (const range of sourceRanges) result.source.push({ ...common, startOffset: range[0], endOffset: range[1] })
    for (const range of targetRanges) result.target.push({ ...common, startOffset: range[0], endOffset: range[1] })
  }
  return result
}

// Translation comparisons join the exact words of this source verse, rather
// than a Strong's number: repeated words in a verse must remain distinct.
export function parallelVerseWordLinks(primaryData, secondaryData, chapter, verse, sourceText, primaryText, secondaryText) {
  const source = visibleVerseText(sourceText)
  const identity = () => [...source.matchAll(/[\p{L}\p{M}]+(?:[’'][\p{L}\p{M}]+)*/gu)].map((match, id) => ({
    id, source: [match.index, match.index + match[0].length], target: [match.index, match.index + match[0].length],
  }))
  const checked = (data, text) => {
    if (!data) return visibleVerseText(text) === source ? identity() : null
    return verseWordLinks(data, chapter, verse, sourceText, text) ? data.verses[`${chapter}:${verse}`].groups.flatMap(group =>
      (group.sourceRanges || [group.source]).flatMap(source => (group.targetRanges || [group.target]).map(target => ({ ...group, source, target })))) : null
  }
  const primary = checked(primaryData, primaryText), secondary = checked(secondaryData, secondaryText)
  if (!primary || !secondary) return null
  const nodes = [...primary.map(group => ({ side: 'primary', group })), ...secondary.map(group => ({ side: 'secondary', group }))]
  const parent = nodes.map((_, i) => i)
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  const overlaps = (a, b) => a[0] < b[1] && a[1] > b[0]
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (overlaps(nodes[i].group.source, nodes[j].group.source)
      || (nodes[i].side === nodes[j].side && overlaps(nodes[i].group.target, nodes[j].group.target))) parent[find(j)] = find(i)
  }
  const components = new Map()
  nodes.forEach((node, i) => { const key = find(i); if (!components.has(key)) components.set(key, []); components.get(key).push(node) })
  const result = { primary: [], secondary: [] }
  const texts = { primary: visibleVerseText(primaryText), secondary: visibleVerseText(secondaryText) }
  const names = { primary: primaryData?.targetId || 'Original', secondary: secondaryData?.targetId || 'Original' }
  const uniqueRanges = ranges => [...new Map(ranges.map(range => [range.join(':'), range])).values()].sort((a, b) => a[0] - b[0])
  for (const component of components.values()) {
    if (!component.some(node => node.side === 'primary') || !component.some(node => node.side === 'secondary')) continue
    const ranges = uniqueRanges(component.map(node => node.group.source))
    const sourceRange = [Math.min(...ranges.map(range => range[0])), Math.max(...ranges.map(range => range[1]))]
    const id = `${chapter}:${verse}:source-${ranges.map(range => range.join('-')).join('_')}`
    const phrases = side => uniqueRanges(component.filter(node => node.side === side).map(node => node.group.target)).map(range => texts[side].slice(...range)).join(' … ')
    const label = `${ranges.map(range => source.slice(...range)).join(' … ')} ↔ ${names.primary}: ${phrases('primary')} ↔ ${names.secondary}: ${phrases('secondary')}`
    // Source position also determines the tint; the same source word must have
    // the same color regardless of English word order or selected translation.
    const pattern = [...source.slice(0, sourceRange[0]).matchAll(/\S+/g)].length % 6
    for (const side of ['primary', 'secondary']) {
      for (const range of uniqueRanges(component.filter(node => node.side === side).map(node => node.group.target))) {
        result[side].push({ id, pattern, startOffset: range[0], endOffset: range[1], sourceRange, sourceRanges: ranges, label })
      }
    }
  }
  return result
}

export const hebrewOriginalBooks = {
  "Genesis": "genesis.json",
  "Exodus": "exodus.json",
  "Leviticus": "leviticus.json",
  "Numbers": "numbers.json",
  "Deuteronomy": "deuteronomy.json",
  "Joshua": "joshua.json",
  "Judges": "judges.json",
  "Ruth": "ruth.json",
  "1 Samuel": "1-samuel.json",
  "2 Samuel": "2-samuel.json",
  "1 Kings": "1-kings.json",
  "2 Kings": "2-kings.json",
  "1 Chronicles": "1-chronicles.json",
  "2 Chronicles": "2-chronicles.json",
  "Ezra": "ezra.json",
  "Nehemiah": "nehemiah.json",
  "Esther": "esther.json",
  "Job": "job.json",
  "Psalms": "psalms.json",
  "Proverbs": "proverbs.json",
  "Ecclesiastes": "ecclesiastes.json",
  "Song of Solomon": "song-of-solomon.json",
  "Isaiah": "isaiah.json",
  "Jeremiah": "jeremiah.json",
  "Lamentations": "lamentations.json",
  "Ezekiel": "ezekiel.json",
  "Daniel": "daniel.json",
  "Hosea": "hosea.json",
  "Joel": "joel.json",
  "Amos": "amos.json",
  "Obadiah": "obadiah.json",
  "Jonah": "jonah.json",
  "Micah": "micah.json",
  "Nahum": "nahum.json",
  "Habakkuk": "habakkuk.json",
  "Zephaniah": "zephaniah.json",
  "Haggai": "haggai.json",
  "Zechariah": "zechariah.json",
  "Malachi": "malachi.json"
}

export function originalSourceForBook(book) {
  return hebrewOriginalBooks[book] ? {
    id: 'WLC-OSHB', label: 'Hebrew / Aramaic · WLC / OSHB',
    title: 'Westminster Leningrad Codex · Open Scriptures Hebrew Bible',
    url: 'https://github.com/openscriptures/morphhb/tree/3d15126fb1ef74867fc1434be1942e837932691f/wlc',
    direction: 'rtl',
  } : { id: 'N1904', label: 'Greek · Nestle 1904', title: 'Nestle 1904 · Biblical Humanities',
    url: 'https://github.com/biblicalhumanities/Nestle1904/tree/713f28a3b7d4d66132f5aa809fa223fe79762e5d/morph', direction: 'ltr' }
}
export function originalVerseLanguage(verse) {
  return verse?.languages?.map(code => code === 'arc' ? 'Aramaic' : 'Hebrew').join(' / ') || 'Hebrew / Aramaic'
}

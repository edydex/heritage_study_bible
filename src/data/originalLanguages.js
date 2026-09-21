import { splitParagraphText } from '../utils/verseLayout'

export const originalLanguages = {
  id: 'ORIGINAL', abbr: 'Original', name: 'Original languages', language: 'Original languages',
  description: 'Hebrew/Aramaic · WLC/OSHB; Greek · Nestle 1904. Romans word links with BSB.',
  license: 'Public domain / CC0; OSHB metadata CC BY 4.0', parallelOnly: true,
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

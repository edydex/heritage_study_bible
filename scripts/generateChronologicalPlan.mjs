import fs from 'node:fs'
import path from 'node:path'
import { bibleBooks } from '../src/data/bible-books.js'

const totalDays = 365
const generatorVersion = 2

const sourceNotes = [
  {
    id: 'biblical_superscriptions',
    title: 'Internal biblical superscriptions and date notices',
    use: 'Explicit book openings, psalm titles, and dated prophetic headings such as Isaiah 1:1, Micah 1:1, and Psalm 90.',
    rightsNote: 'Primary biblical reference data; translation text remains separately licensed.',
  },
  {
    id: 'townsend_ot_nt',
    title: 'George Townsend chronological Old and New Testament arrangements',
    years: '1826-1837',
    use: 'Whole-Bible chronological backbone and the principle of inserting Psalms, Prophets, and Epistles near their historical setting.',
    url: 'https://books.google.com/books/about/The_Holy_Bible.html?id=luuSd4gNlegC',
    rightsNote: 'Public-domain-era source; used as a historical guide, not copied as a day-by-day reading schedule.',
  },
  {
    id: 'merrill_kings_prophets',
    title: 'Stephen Merrill, A Harmony of the Kings and Prophets',
    year: 1832,
    use: 'Kings, Chronicles, and Prophets alignment during the monarchy.',
    url: 'https://search.worldcat.org/title/A-Harmony-of-the-Kings-and-Prophets/oclc/1000381978',
    rightsNote: 'Public-domain-era source; used as a historical guide.',
  },
  {
    id: 'robinson_gospel_harmony',
    title: 'Edward Robinson, A Harmony of the Four Gospels in English',
    year: 1847,
    use: 'Gospel chronology and parallel-account ordering.',
    url: 'https://openlibrary.org/books/OL14010087M/A_harmony_of_the_four_Gospels_in_English',
    rightsNote: 'Public-domain-era source; used as a historical guide.',
  },
  {
    id: 'conybeare_howson_paul',
    title: 'Conybeare and Howson, The Life and Epistles of St. Paul',
    year: 1852,
    use: 'Acts and Pauline epistle placement.',
    url: 'https://openlibrary.org/books/OL20423759M/The_life_and_epistles_of_St._Paul',
    rightsNote: 'Public-domain-era source; used as a historical guide.',
  },
  {
    id: 'web_word_counts',
    title: 'World English Bible text bundled with this app',
    use: 'Approximate word and character counts for generating balanced daily readings.',
    url: 'https://worldenglish.bible/',
    rightsNote: 'The app already stores WEB as a public-domain translation module; the plan stores references plus derived counts only.',
  },
]

const sourceTitleById = new Map(sourceNotes.map(source => [source.id, source.title]))
const sourceLinkById = new Map(sourceNotes.map(source => [source.id, {
  id: source.id,
  title: source.title,
  url: source.url || '',
}]))

function note(id, title, text, sources = []) {
  return {
    type: 'note',
    id,
    title,
    text,
    sources,
  }
}

const chronologicalSections = [
  {
    title: 'Primeval History and Patriarchal Wisdom',
    period: 'creation_to_patriarchs',
    confidence: 'medium',
    sources: ['townsend_ot_nt'],
    passages: [
      'Genesis 1-11',
      note(
        'job-patriarchal-placement',
        'Why Job is here',
        'Job is not dated inside the book, so this is a traditional early placement rather than a hard chronological claim. Public-domain chronological arrangements such as Townsend commonly place Job with the patriarchal age because its setting reads earlier than Israel under Moses or the monarchy.',
        ['townsend_ot_nt']
      ),
      'Job 1-42',
      'Genesis 12-50',
    ],
  },
  {
    title: 'Exodus, Wilderness, and Covenant',
    period: 'exodus_wilderness',
    confidence: 'high',
    sources: ['townsend_ot_nt'],
    passages: [
      'Exodus 1-40',
      'Leviticus 1-27',
      'Numbers 1-36',
      'Psalms 90',
      'Deuteronomy 1-34',
      note(
        'exodus-wilderness-psalms',
        'Why these Psalms follow Moses',
        'Psalm 90 is explicitly titled as a prayer of Moses. Psalms 78, 105, 106, 114, 135, and 136 are not all Mosaic compositions; they are later worshipful retellings of the Exodus and wilderness story, so they are grouped after the Mosaic narrative as theological reflection on that period.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 78',
      'Psalms 105-106',
      'Psalms 114',
      'Psalms 135-136',
    ],
  },
  {
    title: 'Conquest, Judges, and Ruth',
    period: 'conquest_judges',
    confidence: 'high',
    sources: ['townsend_ot_nt'],
    passages: [
      'Joshua 1-24',
      'Judges 1-21',
      'Ruth 1-4',
      '1 Chronicles 1-9',
    ],
  },
  {
    title: 'Samuel, Saul, and David in Exile',
    period: 'united_monarchy_sauls_reign',
    confidence: 'medium',
    sources: ['townsend_ot_nt'],
    passages: [
      '1 Samuel 1-31',
      '1 Chronicles 10',
      'Psalms 7',
      'Psalms 11',
      'Psalms 34',
      'Psalms 52',
      'Psalms 54',
      'Psalms 56-57',
      'Psalms 59',
      'Psalms 63',
      'Psalms 142',
    ],
  },
  {
    title: 'David the King',
    period: 'united_monarchy_david',
    confidence: 'medium',
    sources: ['townsend_ot_nt'],
    passages: [
      '2 Samuel 1-24',
      '1 Chronicles 11-29',
      'Psalms 2',
      'Psalms 3-6',
      'Psalms 8',
      'Psalms 9-10',
      'Psalms 12-18',
      'Psalms 19',
      'Psalms 20-32',
      'Psalms 35-41',
      'Psalms 51',
      'Psalms 53',
      'Psalms 55',
      'Psalms 58',
      'Psalms 60-62',
      'Psalms 64-71',
      'Psalms 86',
      'Psalms 101',
      'Psalms 103',
      'Psalms 108-110',
      'Psalms 122',
      'Psalms 124',
      'Psalms 131',
      'Psalms 133',
      'Psalms 138-141',
      'Psalms 143-145',
    ],
  },
  {
    title: 'Solomon and Wisdom',
    period: 'united_monarchy_solomon',
    confidence: 'medium',
    sources: ['townsend_ot_nt'],
    passages: [
      '1 Kings 1-11',
      '2 Chronicles 1-9',
      'Song of Solomon 1-8',
      'Proverbs 1-31',
      'Ecclesiastes 1-12',
      'Psalms 72',
      'Psalms 127',
    ],
  },
  {
    title: 'Divided Kingdom and Early Prophets',
    period: 'divided_kingdom_early',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'merrill_kings_prophets'],
    passages: [
      '1 Kings 12-16',
      '2 Chronicles 10-16',
      '1 Kings 17-22',
      '2 Chronicles 17-20',
      '2 Kings 1-8',
      '2 Chronicles 21-22',
      note(
        'obadiah-joel-early-prophets',
        'Why Obadiah and Joel are here',
        'Obadiah and Joel do not give the same kind of dated royal headings that Isaiah or Hosea give, so this placement is an informed early-prophet arrangement rather than a hard date. Townsend and Merrill both represent the older public-domain practice of interleaving these short prophets with the divided-kingdom history instead of leaving them at the end of the Old Testament.',
        ['townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Obadiah 1',
      'Joel 1-3',
      '2 Kings 9-13',
      '2 Chronicles 23-24',
      note(
        'jonah-jeroboam-ii',
        'Why Jonah appears during Israel\'s monarchy',
        'Jonah is not placed here only because of its canonical location among the Twelve. 2 Kings 14:25 names Jonah son of Amittai during the reign of Jeroboam II, so the plan places Jonah near that northern-kingdom setting and follows the same broad alignment used in older chronological arrangements.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Jonah 1-4',
      note(
        'amos-hosea-eighth-century',
        'Why Amos and Hosea follow Jonah',
        'Amos 1:1 names Uzziah of Judah and Jeroboam II of Israel, and Hosea 1:1 stretches from Uzziah through Hezekiah while also naming Jeroboam. That puts both prophets in the same eighth-century northern-kingdom crisis that Kings and Chronicles are narrating here.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Amos 1-9',
      'Hosea 1-14',
    ],
  },
  {
    title: 'Assyrian Crisis and Judah in Decline',
    period: 'divided_kingdom_late',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'merrill_kings_prophets'],
    passages: [
      '2 Kings 14-15',
      '2 Chronicles 25-27',
      note(
        'isaiah-uzziah-transition',
        'Why Isaiah begins here',
        'Isaiah 1:1 places Isaiah\'s ministry during the reigns of Uzziah, Jotham, Ahaz, and Hezekiah. That is why Isaiah begins after the Uzziah/Jotham-era material in Kings and Chronicles rather than later in canonical order.',
        ['biblical_superscriptions', 'merrill_kings_prophets']
      ),
      'Isaiah 1-12',
      note(
        'micah-isaiah-overlap',
        'Why Micah follows Isaiah',
        'Micah 1:1 names Jotham, Ahaz, and Hezekiah, overlapping Isaiah\'s superscription. This places Micah in the same broad prophetic generation as Isaiah, so the plan keeps their early monarchy-era material together.',
        ['biblical_superscriptions', 'merrill_kings_prophets']
      ),
      'Micah 1-7',
      'Isaiah 13-39',
      '2 Kings 16-20',
      '2 Chronicles 28-32',
      note(
        'minor-prophets-assyrian-babylonian-crisis',
        'Why Nahum, Zephaniah, and Habakkuk are here',
        'These books sit around Judah\'s late monarchy and the Assyrian-to-Babylonian crisis rather than inside a neat chapter-by-chapter narrative slot. Zephaniah 1:1 dates him to Josiah, while Nahum and Habakkuk are placed here by the older chronological sources because their oracles fit the collapse of Assyrian power and the rise of Babylon.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Nahum 1-3',
      'Zephaniah 1-3',
      'Habakkuk 1-3',
    ],
  },
  {
    title: 'Jeremiah, Fall of Jerusalem, and Exilic Psalms',
    period: 'judah_fall_exile',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'merrill_kings_prophets'],
    passages: [
      note(
        'jeremiah-fall-of-jerusalem',
        'Why Jeremiah begins before Jerusalem falls',
        'Jeremiah 1:1-3 dates his ministry from Josiah through the fall of Jerusalem. The plan therefore starts Jeremiah before the final Kings/Chronicles collapse, then returns to those historical chapters and finishes Jeremiah and Lamentations after the city falls.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Jeremiah 1-38',
      '2 Kings 21-25',
      '2 Chronicles 33-36',
      'Jeremiah 39-52',
      'Lamentations 1-5',
      note(
        'isaiah-comfort-exile',
        'Why Isaiah 40-66 is read after the fall',
        'Isaiah is a single canonical book, but chapters 40-66 speak heavily into exile, comfort, restoration, and return. Chronological arrangements commonly keep Isaiah 1-39 with the Assyrian crisis and read the later comfort section alongside the exile-and-return movement.',
        ['townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Isaiah 40-66',
      note(
        'ambiguous-psalm-block',
        'Why these Psalms are grouped here',
        'Psalm chronology is ambiguous. This block holds the less certain Psalms together for now; once the dateable Psalms are aligned, we can sprinkle the ambiguous ones into harder-to-read sections to make those stretches easier to get through.',
        ['townsend_ot_nt']
      ),
      'Psalms 1',
      'Psalms 33',
      'Psalms 42-50',
      'Psalms 73-77',
      'Psalms 79-85',
      'Psalms 87-89',
      'Psalms 91-100',
      'Psalms 102',
      'Psalms 104',
      'Psalms 107',
      'Psalms 111-113',
      'Psalms 115-121',
      'Psalms 123',
      'Psalms 125-126',
      'Psalms 128-130',
      'Psalms 132',
      'Psalms 134',
      'Psalms 137',
      'Psalms 146-150',
    ],
  },
  {
    title: 'Exile and Return',
    period: 'exile_return',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'merrill_kings_prophets'],
    passages: [
      note(
        'ezekiel-daniel-exile',
        'Why Ezekiel and Daniel open the exile section',
        'Ezekiel 1:1-3 explicitly sets the book among the exiles by the Chebar canal, and Daniel opens in the Babylonian court after Jerusalem is besieged. That is why these books are grouped with the exile rather than read only in canonical order.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Ezekiel 1-48',
      'Daniel 1-12',
      'Ezra 1-6',
      note(
        'haggai-zechariah-temple-rebuild',
        'Why Haggai and Zechariah interrupt Ezra',
        'Ezra 5:1 names Haggai and Zechariah as prophets who encouraged the returned exiles during the temple rebuilding, and both prophetic books are dated to the reign of Darius. So the plan pauses Ezra after the first return and reads those prophets at the temple-rebuilding moment.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Haggai 1-2',
      'Zechariah 1-14',
      'Esther 1-10',
      'Ezra 7-10',
      'Nehemiah 1-13',
      note(
        'malachi-post-exilic-close',
        'Why Malachi closes the Old Testament',
        'Malachi is not dated by a named king, but its temple, priesthood, and covenant concerns fit the restored post-exilic community. Older chronological plans commonly place it after Ezra and Nehemiah as the final prophetic word before the New Testament gap.',
        ['townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Malachi 1-4',
    ],
  },
  {
    title: 'Life and Ministry of Jesus',
    period: 'gospels',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'robinson_gospel_harmony'],
    passages: [
      'Luke 1-2',
      'Matthew 1-2',
      'Mark 1',
      'Matthew 3-4',
      'Luke 3-4',
      'John 1-4',
      'Matthew 5-7',
      'Luke 5-6',
      'Mark 2-3',
      'Matthew 8-10',
      'Luke 7-9',
      'Mark 4-6',
      'Matthew 11-13',
      'John 5-6',
      'Mark 7-9',
      'Matthew 14-18',
      'Luke 10-13',
      'John 7-10',
      'Luke 14-18',
      'Mark 10',
      'Matthew 19-20',
      'John 11-12',
      'Mark 11-13',
      'Matthew 21-25',
      'Luke 19-21',
      'Matthew 26-28',
      'Mark 14-16',
      'Luke 22-24',
      'John 13-21',
    ],
  },
  {
    title: 'Acts, Epistles, and Revelation',
    period: 'apostolic_church',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'conybeare_howson_paul'],
    passages: [
      'Acts 1-8',
      note(
        'james-early-church',
        'Why James is placed early in Acts',
        'James does not give a travel itinerary like some Pauline letters, so this is a traditional early-church placement rather than a precise timestamp. It is read after the first Jerusalem-centered chapters of Acts because older chronological arrangements often treat it as an early letter to dispersed Jewish Christians.',
        ['townsend_ot_nt']
      ),
      'James 1-5',
      'Acts 9-12',
      note(
        'galatians-acts-mission',
        'Why Galatians is near Paul\'s early missions',
        'Galatians is one of the less-settled Pauline placements, but this plan follows the early/South-Galatian style of arrangement represented in older Acts-and-epistles chronologies. That is why it appears near Acts 13-15 rather than much later in Paul\'s ministry.',
        ['conybeare_howson_paul', 'townsend_ot_nt']
      ),
      'Galatians 1-6',
      'Acts 13-15',
      'Acts 16-18',
      note(
        'thessalonians-corinth',
        'Why the Thessalonian letters follow Acts 16-18',
        'Acts 16-18 narrates Paul\'s Macedonian mission, Thessalonica, Athens, and Corinth. Conybeare and Howson place 1 and 2 Thessalonians in this missionary period, so the plan reads them after that part of Acts.',
        ['conybeare_howson_paul', 'townsend_ot_nt']
      ),
      '1 Thessalonians 1-5',
      '2 Thessalonians 1-3',
      'Acts 19',
      note(
        'corinthians-romans-acts-19-20',
        'Why Corinthians and Romans are here',
        'Acts 19-20 gives the Ephesus, Macedonia, and Greece setting for this part of Paul\'s work. Older Pauline chronologies place 1 Corinthians near the Ephesian ministry, then 2 Corinthians and Romans as Paul moves through Macedonia and Greece before the Jerusalem journey.',
        ['conybeare_howson_paul', 'townsend_ot_nt']
      ),
      '1 Corinthians 1-16',
      'Acts 20',
      '2 Corinthians 1-13',
      'Romans 1-16',
      'Acts 21-28',
      note(
        'prison-epistles-after-acts',
        'Why the prison letters follow Acts 28',
        'Acts ends with Paul under Roman custody. Ephesians, Philippians, Colossians, and Philemon are traditionally grouped as captivity or prison letters, so this plan reads them after Acts reaches Paul\'s imprisonment.',
        ['conybeare_howson_paul', 'townsend_ot_nt']
      ),
      'Ephesians 1-6',
      'Philippians 1-4',
      'Colossians 1-4',
      'Philemon 1',
      note(
        'late-epistles-and-revelation',
        'Why these letters close the New Testament',
        'After Acts, the chronology becomes less directly narrated. This closing block follows public-domain chronological arrangements for the later pastoral and general epistles, then ends with Revelation as the final apocalyptic book of the canon.',
        ['townsend_ot_nt', 'conybeare_howson_paul']
      ),
      '1 Timothy 1-6',
      'Titus 1-3',
      '1 Peter 1-5',
      'Hebrews 1-13',
      '2 Timothy 1-4',
      '2 Peter 1-3',
      'Jude 1',
      '1 John 1-5',
      '2 John 1',
      '3 John 1',
      'Revelation 1-22',
    ],
  },
]

const chapterByBook = new Map(bibleBooks.map(book => [book.name, book.chapters]))
const bookOrder = new Map(bibleBooks.map((book, index) => [book.name, index + 1]))

function bookToSlug(bookName) {
  return String(bookName || '').toLowerCase().replace(/\s+/g, '-')
}

function loadWebChapterMetrics() {
  const metrics = new Map()
  const root = path.join(process.cwd(), 'public/data/translations/WEB')

  for (const book of bibleBooks) {
    const filePath = path.join(root, `${bookToSlug(book.name)}.json`)
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)
    for (const chapter of data.chapters || []) {
      const text = (chapter.verses || []).map(verse => verse.text || '').join(' ')
      const words = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g) || []
      metrics.set(`${book.name} ${chapter.number}`, {
        wordCount: words.length,
        characterCount: text.replace(/\s+/g, ' ').trim().length,
      })
    }
  }

  return metrics
}

function parseChapterReference(reference) {
  const match = String(reference || '').trim().match(/^(.+?)\s+(\d+)(?:-(\d+))?$/)
  if (!match) throw new Error(`Unsupported chapter reference: ${reference}`)

  const book = match[1]
  const start = Number(match[2])
  const end = Number(match[3] || match[2])
  const maxChapter = chapterByBook.get(book)

  if (!maxChapter) throw new Error(`Unknown book in reference: ${reference}`)
  if (start < 1 || end > maxChapter || start > end) {
    throw new Error(`Chapter range outside ${book}: ${reference}`)
  }

  return { book, start, end }
}

function expandChronology(chapterMetrics) {
  const items = []
  const seen = new Map()

  chronologicalSections.forEach((section, sectionIndex) => {
    section.passages.forEach(entry => {
      if (entry?.type === 'note') {
        items.push({
          ...entry,
          section: section.title,
          period: section.period,
          confidence: section.confidence,
          wordCount: 0,
          characterCount: 0,
          sequence: items.length + 1,
          sectionIndex,
        })
        return
      }

      const reference = entry
      const parsed = parseChapterReference(reference)
      for (let chapter = parsed.start; chapter <= parsed.end; chapter += 1) {
        const key = `${parsed.book} ${chapter}`
        const previous = seen.get(key)
        if (previous) {
          throw new Error(`Duplicate chapter ${key}: ${previous} and ${section.title}`)
        }

        seen.set(key, section.title)
        items.push({
          type: 'chapter',
          book: parsed.book,
          chapter,
          reference: key,
          canonicalOrder: bookOrder.get(parsed.book),
          section: section.title,
          period: section.period,
          confidence: section.confidence,
          sources: section.sources,
          wordCount: chapterMetrics.get(key)?.wordCount || 0,
          characterCount: chapterMetrics.get(key)?.characterCount || 0,
          sequence: items.length + 1,
          sectionIndex,
        })
      }
    })
  })

  const missing = []
  for (const book of bibleBooks) {
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
      const key = `${book.name} ${chapter}`
      if (!seen.has(key)) missing.push(key)
    }
  }

  if (missing.length) {
    throw new Error(`Missing chapters: ${missing.join(', ')}`)
  }

  const chapterCount = items.filter(item => item.type === 'chapter').length
  if (chapterCount !== 1189) {
    throw new Error(`Expected 1189 chapters, found ${chapterCount}`)
  }

  return items
}

function monthLabel(day) {
  const months = [
    ['January', 31],
    ['February', 28],
    ['March', 31],
    ['April', 30],
    ['May', 31],
    ['June', 30],
    ['July', 31],
    ['August', 31],
    ['September', 30],
    ['October', 31],
    ['November', 30],
    ['December', 31],
  ]

  let cursor = day
  for (const [label, length] of months) {
    if (cursor <= length) return label
    cursor -= length
  }
  return 'December'
}

function toPassages(dayChapters) {
  const segments = []
  for (const item of dayChapters.filter(row => row.type === 'chapter')) {
    const last = segments[segments.length - 1]
    if (!last || last.book !== item.book || item.chapter !== last.end + 1) {
      segments.push({ book: item.book, start: item.chapter, end: item.chapter })
    } else {
      last.end = item.chapter
    }
  }

  return segments.map(segment => {
    if (segment.start === segment.end) return `${segment.book} ${segment.start}`
    return `${segment.book} ${segment.start}-${segment.end}`
  })
}

function toReadingItems(dayItems) {
  const items = []
  let pendingChapters = []

  const flushChapters = () => {
    if (!pendingChapters.length) return
    toPassages(pendingChapters).forEach(passage => {
      items.push({ type: 'passage', passage })
    })
    pendingChapters = []
  }

  for (const item of dayItems) {
    if (item.type === 'note') {
      flushChapters()
      items.push({
        type: 'note',
        id: item.id,
        title: item.title,
        text: item.text,
        sources: item.sources || [],
        sourceLabels: (item.sources || []).map(source => sourceTitleById.get(source) || source),
        sourceLinks: (item.sources || []).map(source => sourceLinkById.get(source)).filter(Boolean),
      })
      continue
    }
    pendingChapters.push(item)
  }

  flushChapters()
  return items
}

function findCharacterPartition(chapters, average, tolerance) {
  const lower = average * (1 - tolerance)
  const upper = average * (1 + tolerance)
  const nextByDay = Array.from({ length: totalDays + 2 }, () => new Map())
  const chapterCountsFrom = Array.from({ length: chapters.length + 1 }, () => 0)
  for (let index = chapters.length - 1; index >= 0; index -= 1) {
    chapterCountsFrom[index] = chapterCountsFrom[index + 1] + (chapters[index].type === 'chapter' ? 1 : 0)
  }
  nextByDay[totalDays + 1].set(chapters.length, chapters.length)

  for (let day = totalDays; day >= 1; day -= 1) {
    const daysLeftAfterToday = totalDays - day

    for (let start = chapters.length - 1; start >= 0; start -= 1) {
      if (chapterCountsFrom[start] < totalDays - day + 1) continue

      let characterCount = 0
      for (let end = start; end < chapters.length; end += 1) {
        characterCount += chapters[end].characterCount

        const nextStart = end + 1
        if (chapterCountsFrom[nextStart] < daysLeftAfterToday) break
        if (characterCount > upper) break
        if (characterCount < lower) continue
        if (!nextByDay[day + 1].has(nextStart)) continue

        nextByDay[day].set(start, nextStart)
        break
      }
    }
  }

  if (!nextByDay[1].has(0)) return null

  const partition = []
  let cursor = 0
  for (let day = 1; day <= totalDays; day += 1) {
    const next = nextByDay[day].get(cursor)
    partition.push(chapters.slice(cursor, next))
    cursor = next
  }

  return {
    partition,
    lower,
    upper,
  }
}

function partitionChaptersByCharacters(chapters, totalCharacters) {
  const average = totalCharacters / totalDays
  const targetTolerance = 0.2

  for (let percentage = 20; percentage <= 50; percentage += 1) {
    const tolerance = percentage / 100
    const result = findCharacterPartition(chapters, average, tolerance)
    if (!result) continue

    return {
      partition: result.partition,
      characterBounds: {
        average: Math.round(average),
        lower: Math.ceil(result.lower),
        upper: Math.floor(result.upper),
        targetTolerance,
        actualTolerance: tolerance,
        targetMet: tolerance === targetTolerance,
      },
    }
  }

  throw new Error('Could not partition readings by character count within a 50% whole-chapter tolerance')
}

function generateReadings(chapters, totalCharacters) {
  const { partition, characterBounds } = partitionChaptersByCharacters(chapters, totalCharacters)
  const readings = []

  partition.forEach((dayChapters, index) => {
    const day = index + 1
    const chapterItems = dayChapters.filter(item => item.type === 'chapter')
    const dayWords = chapterItems.reduce((sum, item) => sum + item.wordCount, 0)
    const dayCharacters = chapterItems.reduce((sum, item) => sum + item.characterCount, 0)
    const sections = [...new Set(chapterItems.map(item => item.section))]
    const periods = [...new Set(chapterItems.map(item => item.period))]
    const sources = [...new Set(dayChapters.flatMap(item => item.sources || []))]
    const confidence = chapterItems.some(item => item.confidence === 'low')
      ? 'low'
      : chapterItems.some(item => item.confidence === 'medium')
        ? 'medium'
        : 'high'
    const orderedItems = toReadingItems(dayChapters)

    readings.push({
      day,
      month: monthLabel(day),
      passages: orderedItems.filter(item => item.type === 'passage').map(item => item.passage),
      items: orderedItems,
      sections,
      periods,
      sources,
      confidence,
      wordCount: dayWords,
      characterCount: dayCharacters,
    })
  })

  return { readings, characterBounds }
}

function summarizeReadings(readings, field) {
  const counts = readings.map(reading => reading[field])
  return {
    min: Math.min(...counts),
    max: Math.max(...counts),
    average: Math.round(counts.reduce((sum, value) => sum + value, 0) / readings.length),
  }
}

const chapterMetrics = loadWebChapterMetrics()
const chronologyItems = expandChronology(chapterMetrics)
const chapterItems = chronologyItems.filter(item => item.type === 'chapter')
const totalChapters = chapterItems.length
const totalWords = chapterItems.reduce((sum, chapter) => sum + chapter.wordCount, 0)
const totalCharacters = chapterItems.reduce((sum, chapter) => sum + chapter.characterCount, 0)
const { readings, characterBounds } = generateReadings(chronologyItems, totalCharacters)

const output = {
  id: 'chronological-bible',
  title: 'Chronological Bible in 365 Days',
  description: 'A full-Bible plan arranged by broad biblical chronology, with Psalms, Prophets, Gospels, Acts, and Epistles placed near their historical settings where possible.',
  attribution: 'Original generated plan for Heritage Study Bible. Built from public-domain-era chronology sources and bundled WEB character counts; not copied from a modern 365-day schedule.',
  licenseNote: 'The plan data is an original reference compilation generated by this project. Bible translation text remains separately licensed by translation module.',
  generatorVersion,
  methodology: [
    'Build an ordered chapter sequence from independent chronology sections.',
    'Validate that every Protestant-canon Bible chapter appears exactly once.',
    'Keep dateable Psalms near their likely historical settings, while holding broadly undated Psalms together for a later attribution and reading-rhythm pass.',
    'Use bundled World English Bible character counts to balance daily readings; the generated metadata records whether the 20 percent target is feasible at whole-chapter granularity.',
    'Keep the app-facing plan at whole-chapter granularity because the current reader tracks plan progress by chapter.',
  ],
  sourceNotes,
  totalDays,
  totalChapters,
  totalWords,
  totalCharacters,
  characterBounds,
  characterCountSummary: summarizeReadings(readings, 'characterCount'),
  wordCountSummary: summarizeReadings(readings, 'wordCount'),
  readings,
}

const outPath = path.join(process.cwd(), 'public/data/reading-plans/chronological-bible.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)

console.log(`Wrote ${outPath}`)
console.log(`Days: ${output.totalDays}, chapters: ${output.totalChapters}, characters: ${output.totalCharacters}`)
console.log(`Daily characters: ${output.characterCountSummary.min}-${output.characterCountSummary.max}, active bounds ${output.characterBounds.lower}-${output.characterBounds.upper}`)
console.log(`Character tolerance target met: ${output.characterBounds.targetMet}`)
console.log(`Sample day 1: ${output.readings[0].passages.join(', ')}`)
console.log(`Sample day 365: ${output.readings[364].passages.join(', ')}`)

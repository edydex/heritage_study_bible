import { bibleBooks } from '../data/bible-books.js'

/**
 * Parse a Bible reference string like "Ps 23", "Psalm 23:1", "1 Cor 13", "Genesis 1 1", etc.
 * Returns { book, chapter, verse } or null if input doesn't look like a reference.
 */

// Extra common aliases beyond what's in bible-books.js
const extraAliases = {
  // Genesis
  'genesis': 'Genesis', 'gen': 'Genesis', 'ge': 'Genesis', 'gn': 'Genesis',
  // Exodus
  'exodus': 'Exodus', 'exod': 'Exodus', 'exo': 'Exodus', 'ex': 'Exodus',
  // Leviticus
  'leviticus': 'Leviticus', 'lev': 'Leviticus', 'le': 'Leviticus', 'lv': 'Leviticus',
  // Numbers
  'numbers': 'Numbers', 'num': 'Numbers', 'nu': 'Numbers', 'nm': 'Numbers', 'nb': 'Numbers',
  // Deuteronomy
  'deuteronomy': 'Deuteronomy', 'deut': 'Deuteronomy', 'de': 'Deuteronomy', 'dt': 'Deuteronomy',
  // Joshua
  'joshua': 'Joshua', 'josh': 'Joshua', 'jos': 'Joshua', 'jsh': 'Joshua',
  // Judges
  'judges': 'Judges', 'judg': 'Judges', 'jdg': 'Judges', 'jdgs': 'Judges',
  // Ruth
  'ruth': 'Ruth', 'ru': 'Ruth', 'rth': 'Ruth',
  // 1 Samuel
  '1 samuel': '1 Samuel', '1samuel': '1 Samuel', '1 sam': '1 Samuel', '1sam': '1 Samuel', '1 sa': '1 Samuel', '1sa': '1 Samuel',
  // 2 Samuel
  '2 samuel': '2 Samuel', '2samuel': '2 Samuel', '2 sam': '2 Samuel', '2sam': '2 Samuel', '2 sa': '2 Samuel', '2sa': '2 Samuel',
  // 1 Kings
  '1 kings': '1 Kings', '1kings': '1 Kings', '1 kgs': '1 Kings', '1kgs': '1 Kings', '1 ki': '1 Kings', '1ki': '1 Kings',
  // 2 Kings
  '2 kings': '2 Kings', '2kings': '2 Kings', '2 kgs': '2 Kings', '2kgs': '2 Kings', '2 ki': '2 Kings', '2ki': '2 Kings',
  // 1 Chronicles
  '1 chronicles': '1 Chronicles', '1chronicles': '1 Chronicles', '1 chron': '1 Chronicles', '1chron': '1 Chronicles', '1 chr': '1 Chronicles', '1chr': '1 Chronicles', '1 ch': '1 Chronicles',
  // 2 Chronicles
  '2 chronicles': '2 Chronicles', '2chronicles': '2 Chronicles', '2 chron': '2 Chronicles', '2chron': '2 Chronicles', '2 chr': '2 Chronicles', '2chr': '2 Chronicles', '2 ch': '2 Chronicles',
  // Ezra
  'ezra': 'Ezra', 'ezr': 'Ezra',
  // Nehemiah
  'nehemiah': 'Nehemiah', 'neh': 'Nehemiah', 'ne': 'Nehemiah',
  // Esther
  'esther': 'Esther', 'esth': 'Esther', 'est': 'Esther', 'es': 'Esther',
  // Job
  'job': 'Job', 'jb': 'Job',
  // Psalms
  'psalms': 'Psalms', 'psalm': 'Psalms', 'ps': 'Psalms', 'psa': 'Psalms', 'psm': 'Psalms', 'pss': 'Psalms',
  // Proverbs
  'proverbs': 'Proverbs', 'prov': 'Proverbs', 'pro': 'Proverbs', 'prv': 'Proverbs', 'pr': 'Proverbs',
  // Ecclesiastes
  'ecclesiastes': 'Ecclesiastes', 'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'ec': 'Ecclesiastes', 'qoh': 'Ecclesiastes',
  // Song of Solomon
  'song of solomon': 'Song of Solomon', 'song of songs': 'Song of Solomon', 'song': 'Song of Solomon', 'sos': 'Song of Solomon', 'canticles': 'Song of Solomon',
  // Isaiah
  'isaiah': 'Isaiah', 'isa': 'Isaiah', 'is': 'Isaiah',
  // Jeremiah
  'jeremiah': 'Jeremiah', 'jer': 'Jeremiah', 'je': 'Jeremiah', 'jr': 'Jeremiah',
  // Lamentations
  'lamentations': 'Lamentations', 'lam': 'Lamentations', 'la': 'Lamentations',
  // Ezekiel
  'ezekiel': 'Ezekiel', 'ezek': 'Ezekiel', 'eze': 'Ezekiel', 'ez': 'Ezekiel',
  // Daniel
  'daniel': 'Daniel', 'dan': 'Daniel', 'da': 'Daniel', 'dn': 'Daniel',
  // Hosea
  'hosea': 'Hosea', 'hos': 'Hosea', 'ho': 'Hosea',
  // Joel
  'joel': 'Joel', 'jl': 'Joel',
  // Amos
  'amos': 'Amos', 'am': 'Amos',
  // Obadiah
  'obadiah': 'Obadiah', 'obad': 'Obadiah', 'ob': 'Obadiah', 'oba': 'Obadiah',
  // Jonah
  'jonah': 'Jonah', 'jon': 'Jonah', 'jnh': 'Jonah',
  // Micah
  'micah': 'Micah', 'mic': 'Micah', 'mi': 'Micah',
  // Nahum
  'nahum': 'Nahum', 'nah': 'Nahum', 'na': 'Nahum',
  // Habakkuk
  'habakkuk': 'Habakkuk', 'hab': 'Habakkuk',
  // Zephaniah
  'zephaniah': 'Zephaniah', 'zeph': 'Zephaniah', 'zep': 'Zephaniah',
  // Haggai
  'haggai': 'Haggai', 'hag': 'Haggai', 'hg': 'Haggai',
  // Zechariah
  'zechariah': 'Zechariah', 'zech': 'Zechariah', 'zec': 'Zechariah',
  // Malachi
  'malachi': 'Malachi', 'mal': 'Malachi', 'ml': 'Malachi',
  // Matthew
  'matthew': 'Matthew', 'matt': 'Matthew', 'mat': 'Matthew', 'mt': 'Matthew',
  // Mark
  'mark': 'Mark', 'mrk': 'Mark', 'mk': 'Mark', 'mr': 'Mark',
  // Luke
  'luke': 'Luke', 'lk': 'Luke', 'lu': 'Luke',
  // John
  'john': 'John', 'jhn': 'John', 'jn': 'John',
  // Acts
  'acts': 'Acts', 'act': 'Acts', 'ac': 'Acts',
  // Romans
  'romans': 'Romans', 'rom': 'Romans', 'ro': 'Romans', 'rm': 'Romans',
  // 1 Corinthians
  '1 corinthians': '1 Corinthians', '1corinthians': '1 Corinthians', '1 cor': '1 Corinthians', '1cor': '1 Corinthians', '1 co': '1 Corinthians', '1co': '1 Corinthians',
  // 2 Corinthians
  '2 corinthians': '2 Corinthians', '2corinthians': '2 Corinthians', '2 cor': '2 Corinthians', '2cor': '2 Corinthians', '2 co': '2 Corinthians', '2co': '2 Corinthians',
  // Galatians
  'galatians': 'Galatians', 'gal': 'Galatians', 'ga': 'Galatians',
  // Ephesians
  'ephesians': 'Ephesians', 'eph': 'Ephesians', 'ep': 'Ephesians',
  // Philippians
  'philippians': 'Philippians', 'phil': 'Philippians', 'php': 'Philippians', 'pp': 'Philippians',
  // Colossians
  'colossians': 'Colossians', 'col': 'Colossians',
  // 1 Thessalonians
  '1 thessalonians': '1 Thessalonians', '1thessalonians': '1 Thessalonians', '1 thess': '1 Thessalonians', '1thess': '1 Thessalonians', '1 th': '1 Thessalonians', '1th': '1 Thessalonians',
  // 2 Thessalonians
  '2 thessalonians': '2 Thessalonians', '2thessalonians': '2 Thessalonians', '2 thess': '2 Thessalonians', '2thess': '2 Thessalonians', '2 th': '2 Thessalonians', '2th': '2 Thessalonians',
  // 1 Timothy
  '1 timothy': '1 Timothy', '1timothy': '1 Timothy', '1 tim': '1 Timothy', '1tim': '1 Timothy', '1 ti': '1 Timothy', '1ti': '1 Timothy',
  // 2 Timothy
  '2 timothy': '2 Timothy', '2timothy': '2 Timothy', '2 tim': '2 Timothy', '2tim': '2 Timothy', '2 ti': '2 Timothy', '2ti': '2 Timothy',
  // Titus
  'titus': 'Titus', 'tit': 'Titus',
  // Philemon
  'philemon': 'Philemon', 'phlm': 'Philemon', 'phm': 'Philemon',
  // Hebrews
  'hebrews': 'Hebrews', 'heb': 'Hebrews', 'he': 'Hebrews',
  // James
  'james': 'James', 'jas': 'James', 'jm': 'James',
  // 1 Peter
  '1 peter': '1 Peter', '1peter': '1 Peter', '1 pet': '1 Peter', '1pet': '1 Peter', '1 pe': '1 Peter', '1pe': '1 Peter', '1pt': '1 Peter',
  // 2 Peter
  '2 peter': '2 Peter', '2peter': '2 Peter', '2 pet': '2 Peter', '2pet': '2 Peter', '2 pe': '2 Peter', '2pe': '2 Peter', '2pt': '2 Peter',
  // 1 John
  '1 john': '1 John', '1john': '1 John', '1 jn': '1 John', '1jn': '1 John', '1 jhn': '1 John',
  // 2 John
  '2 john': '2 John', '2john': '2 John', '2 jn': '2 John', '2jn': '2 John', '2 jhn': '2 John',
  // 3 John
  '3 john': '3 John', '3john': '3 John', '3 jn': '3 John', '3jn': '3 John', '3 jhn': '3 John',
  // Jude
  'jude': 'Jude', 'jd': 'Jude',
  // Revelation
  'revelation': 'Revelation', 'rev': 'Revelation', 're': 'Revelation', 'rv': 'Revelation', 'apocalypse': 'Revelation',
}

// Build the combined alias map (also add the abbreviations from bibleBooks)
const allAliases = { ...extraAliases }
bibleBooks.forEach(b => {
  allAliases[b.name.toLowerCase()] = b.name
  allAliases[b.abbr.toLowerCase()] = b.name
})

// Pre-sort aliases by length (longest first) for greedy matching
const sortedAliasKeys = Object.keys(allAliases).sort((a, b) => b.length - a.length)

export function parseBibleReference(input) {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  for (const alias of sortedAliasKeys) {
    if (!trimmed.startsWith(alias)) continue

    const rest = trimmed.slice(alias.length)

    // After the alias, must be: end of string, whitespace, digit, colon, or period
    if (rest && !/^[\s\d:.]/.test(rest)) continue

    const bookName = allAliases[alias]
    const refPart = rest.trim()

    // Look up book metadata for validation
    const bookMeta = bibleBooks.find(b => b.name === bookName)
    if (!bookMeta) continue

    if (!refPart) {
      // Just a book name → chapter 1
      return { book: bookName, chapter: 1, verse: null }
    }

    // Parse chapter and optional verse
    // Supports: "23", "23:1", "23 1", "23.1"
    const match = refPart.match(/^(\d+)(?:[\s:.](\d+))?/)
    if (!match) continue

    const chapter = parseInt(match[1], 10)
    const verse = match[2] ? parseInt(match[2], 10) : null

    // Validate chapter is within range
    if (chapter < 1 || chapter > bookMeta.chapters) continue

    return { book: bookName, chapter, verse }
  }

  return null
}

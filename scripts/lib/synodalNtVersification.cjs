const { createHash } = require('node:crypto')

const NT_BOOKS = Object.freeze([
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
])
const ntNames = new Set(NT_BOOKS)
const fail = message => { throw new Error(`Synodal NT: ${message}`) }
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const positive = value => Number.isSafeInteger(value) && value > 0
const digest = value => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
function keys(value, required, label) {
  if (!record(value) || Object.keys(value).sort().join('|') !== [...required].sort().join('|')) fail(`Malformed ${label}`)
}

// Inspect NT entries only. OT data is neither interpreted nor copied.
function collect(data, needsText) {
  if (!record(data) || !Array.isArray(data.books)) fail('Missing Bible books')
  const books = new Map()
  for (const book of data.books) {
    if (!ntNames.has(book?.name)) continue
    if (books.has(book.name)) fail(`Duplicate NT book ${book.name}`)
    if (!Array.isArray(book.chapters) || !book.chapters.length) fail(`Missing chapters ${book.name}`)
    const chapters = new Map()
    for (const chapter of book.chapters) {
      if (!positive(chapter?.number) || chapters.has(chapter.number) || !Array.isArray(chapter.verses) || !chapter.verses.length) fail(`Malformed/duplicate NT chapter ${book.name}`)
      const verses = new Map()
      for (const verse of chapter.verses) {
        if (!positive(verse?.number) || verses.has(verse.number)) fail(`Malformed/duplicate NT verse ${book.name}|${chapter.number}`)
        if (needsText && (typeof verse.text !== 'string' || !verse.text.trim())) fail(`Missing native text ${book.name}|${chapter.number}|${verse.number}`)
        verses.set(verse.number, needsText ? verse.text : null)
      }
      chapters.set(chapter.number, verses)
    }
    books.set(book.name, chapters)
  }
  if (books.size !== NT_BOOKS.length) fail('Missing NT book')
  const rows = new Map()
  for (const book of NT_BOOKS) {
    for (const [chapter, verses] of [...books.get(book)].sort((a, b) => a[0] - b[0])) {
      for (const [verse, text] of [...verses].sort((a, b) => a[0] - b[0])) rows.set(`${book}|${chapter}|${verse}`, text)
    }
  }
  return rows
}

function synodalNtDigests({ nativeData, canonicalTemplateData }) {
  return {
    nativeNtReferenceTextSha256: digest([...collect(nativeData, true)]),
    canonicalNtReferenceSetSha256: digest([...collect(canonicalTemplateData, false).keys()]),
  }
}

/** Resolve a reviewed NT-only source-piece policy without mutating any input or writing files. */
function resolveSynodalNtVersification({ nativeData, canonicalTemplateData, policy }) {
  keys(policy, ['schemaVersion', 'scope', 'translation', 'defaultMapping', 'sourceDigests', 'overrides', 'explicitAbsentReferences', 'expectedCounts', 'provenance'], 'policy')
  if (policy.schemaVersion !== 1 || policy.scope !== 'NT' || policy.translation !== 'SYNO-W' || policy.defaultMapping !== 'identity') fail('Unsupported policy')
  keys(policy.sourceDigests, ['nativeNtReferenceTextSha256', 'canonicalNtReferenceSetSha256'], 'source digests')
  const native = collect(nativeData, true), canonical = collect(canonicalTemplateData, false)
  const actualDigests = { nativeNtReferenceTextSha256: digest([...native]), canonicalNtReferenceSetSha256: digest([...canonical.keys()]) }
  for (const [name, value] of Object.entries(actualDigests)) {
    if (policy.sourceDigests[name] !== value) fail(`Source digest mismatch: ${name}`)
  }
  if (!Array.isArray(policy.overrides) || !Array.isArray(policy.explicitAbsentReferences) || !record(policy.provenance)) fail('Malformed declarations')
  const countKeys = ['nativeVerseCount', 'canonicalSlotCount', 'materializedVerseCount', 'overrideCount', 'absentSlotCount', 'nativeCharacterCount', 'nativeNonWhitespaceTokenCount']
  keys(policy.expectedCounts, countKeys, 'expected counts')
  if (!Object.values(policy.expectedCounts).every(value => Number.isSafeInteger(value) && value >= 0)) fail('Malformed expected count')
  const overrides = new Map(), absent = new Set()
  for (const reference of policy.explicitAbsentReferences) {
    if (typeof reference !== 'string' || !canonical.has(reference) || absent.has(reference)) fail('Unknown/duplicate absent reference')
    absent.add(reference)
  }
  for (const override of policy.overrides) {
    keys(override, ['canonicalReference', 'sourcePieces'], 'override')
    const reference = override.canonicalReference
    if (!canonical.has(reference) || overrides.has(reference) || absent.has(reference)) fail('Unknown/duplicate/conflicting override')
    if (!Array.isArray(override.sourcePieces) || !override.sourcePieces.length) fail('Empty source-piece override')
    const pieces = override.sourcePieces.map(piece => {
      keys(piece, ['nativeReference', 'startOffset', 'endOffset'], 'source piece')
      const text = native.get(piece.nativeReference), a = piece.startOffset, b = piece.endOffset
      if (text === undefined) fail(`Unknown native source ${piece.nativeReference}`)
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b <= a || b > text.length) fail('Invalid source-piece offsets')
      if ((a > 0 && /\S/u.test(text[a - 1]) && /\S/u.test(text[a])) || (b < text.length && /\S/u.test(text[b - 1]) && /\S/u.test(text[b]))) fail('Source-piece boundary inside a word')
      return { nativeReference: piece.nativeReference, startOffset: a, endOffset: b }
    })
    if (pieces.length === 1 && pieces[0].nativeReference === reference && pieces[0].startOffset === 0 && pieces[0].endOffset === native.get(reference)?.length) fail('Redundant identity override')
    overrides.set(reference, pieces)
  }

  const targetTexts = {}, sourcePieces = {}, canonicalToNative = {}, nativeToCanonical = {}, nativeToCanonicalPieces = {}
  for (const reference of native.keys()) { nativeToCanonical[reference] = []; nativeToCanonicalPieces[reference] = [] }
  for (const reference of canonical.keys()) {
    let pieces
    if (absent.has(reference)) pieces = []
    else if (overrides.has(reference)) pieces = overrides.get(reference)
    else if (native.has(reference)) pieces = [{ nativeReference: reference, startOffset: 0, endOffset: native.get(reference).length }]
    else fail(`Unexplained missing canonical source ${reference}`)
    sourcePieces[reference] = pieces.map(piece => ({ ...piece }))
    canonicalToNative[reference] = [...new Set(pieces.map(piece => piece.nativeReference))]
    if (!pieces.length) continue // An explicit absence cannot fall back to native text.
    const text = pieces.map(piece => native.get(piece.nativeReference).slice(piece.startOffset, piece.endOffset).trim()).join(' ')
    if (!text) fail(`Empty materialized verse ${reference}`)
    targetTexts[reference] = text
    for (const piece of pieces) {
      const { nativeReference, startOffset, endOffset } = piece
      if (!nativeToCanonical[nativeReference].includes(reference)) nativeToCanonical[nativeReference].push(reference)
      nativeToCanonicalPieces[nativeReference].push({ canonicalReference: reference, startOffset, endOffset })
    }
  }

  let nativeCharacterCount = 0, nativeNonWhitespaceTokenCount = 0
  for (const [reference, text] of native) {
    const pieces = [...nativeToCanonicalPieces[reference]].sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset)
    let cursor = 0
    for (const piece of pieces) {
      if (piece.startOffset !== cursor) fail(`Unconsumed or overlapping native characters ${reference}`)
      cursor = piece.endOffset
    }
    if (cursor !== text.length) fail(`Unconsumed native source ${reference}`)
    for (const match of text.matchAll(/\S+/gu)) {
      if (pieces.filter(piece => piece.startOffset <= match.index && match.index + match[0].length <= piece.endOffset).length !== 1) fail(`Native token not owned exactly once ${reference}`)
      nativeNonWhitespaceTokenCount++
    }
    nativeCharacterCount += text.length
  }
  const report = {
    nativeVerseCount: native.size, canonicalSlotCount: canonical.size,
    materializedVerseCount: Object.keys(targetTexts).length, overrideCount: overrides.size,
    absentSlotCount: absent.size, nativeCharacterCount, nativeNonWhitespaceTokenCount,
  }
  for (const key of countKeys) if (report[key] !== policy.expectedCounts[key]) fail(`Reviewed count mismatch: ${key}`)
  const books = NT_BOOKS.map(name => ({ name, chapters: [...new Set([...canonical.keys()].filter(ref => ref.startsWith(`${name}|`)).map(ref => Number(ref.split('|')[1])))]
    .map(number => ({ number, verses: [...canonical.keys()].filter(ref => ref.startsWith(`${name}|${number}|`) && Object.hasOwn(targetTexts, ref))
      .map(ref => ({ number: Number(ref.split('|')[2]), text: targetTexts[ref] })) })) }))
  return { books, targetTexts, sourcePieces, canonicalToNative, nativeToCanonical, nativeToCanonicalPieces,
    report: { ...report, sourceDigests: actualDigests, explicitlyAbsentReferences: [...absent], allNativeCharactersAndTokensOwnedExactlyOnce: true, fallbackIdentityRefsCount: 0 } }
}

module.exports = { NT_BOOKS, synodalNtDigests, resolveSynodalNtVersification }

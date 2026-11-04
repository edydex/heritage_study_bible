import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { NT_BOOKS, synodalNtDigests, resolveSynodalNtVersification } from '../scripts/lib/synodalNtVersification.cjs'

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const hash = value => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
const native = read('../public/data/translations/SYNO-W-native.json')
const template = read('../public/data/translations/LSV.json')
const policy = read('../scripts/bible-sources/SYNO-W-nt-versification.json')
const nt = new Set(NT_BOOKS)
const flatten = data => Object.fromEntries(data.books.filter(book => nt.has(book.name)).flatMap(book => book.chapters.flatMap(chapter => chapter.verses.map(verse => [
  `${book.name}|${chapter.number}|${verse.number}`, verse.text,
]))))
const source = flatten(native), before = [hash(native), hash(template), hash(policy)]
const resolve = (p = policy, n = native, t = template) => resolveSynodalNtVersification({ nativeData: n, canonicalTemplateData: t, policy: p })
const result = resolve()
const change = fn => { const p = structuredClone(policy); fn(p); return p }
const override = (p, ref) => p.overrides.find(item => item.canonicalReference === ref)

test('the real reviewed NT resolves 7959 slots and materializes 7958 verses with the exact conservation counts', () => {
  assert.deepEqual(result.report, {
    nativeVerseCount: 7955, canonicalSlotCount: 7959, materializedVerseCount: 7958,
    overrideCount: 10, absentSlotCount: 1, nativeCharacterCount: 765773,
    nativeNonWhitespaceTokenCount: 129876, sourceDigests: policy.sourceDigests,
    explicitlyAbsentReferences: ['Revelation|12|18'],
    allNativeCharactersAndTokensOwnedExactlyOnce: true, fallbackIdentityRefsCount: 0,
  })
  assert.equal(Object.keys(result.sourcePieces).length, 7959)
  assert.equal(Object.keys(result.targetTexts).length, 7958)
  assert.equal(result.books.length, 27)
  assert.equal(result.books.flatMap(book => book.chapters.flatMap(chapter => chapter.verses)).length, 7958)
  assert.deepEqual([hash(native), hash(template), hash(policy)], before)
})

test('all 7955 native strings reconstruct from disjoint true pieces and every native token has exactly one owner', () => {
  let characters = 0, tokens = 0
  for (const [reference, text] of Object.entries(source)) {
    const pieces = [...result.nativeToCanonicalPieces[reference]].sort((a, b) => a.startOffset - b.startOffset)
    let cursor = 0
    for (const piece of pieces) {
      assert.equal(piece.startOffset, cursor, reference)
      assert.ok(piece.endOffset > cursor, reference)
      cursor = piece.endOffset
      assert.ok(result.canonicalToNative[piece.canonicalReference].includes(reference))
      assert.ok(result.sourcePieces[piece.canonicalReference].some(p => p.nativeReference === reference && p.startOffset === piece.startOffset && p.endOffset === piece.endOffset))
    }
    assert.equal(cursor, text.length, reference)
    assert.equal(pieces.map(p => text.slice(p.startOffset, p.endOffset)).join(''), text, reference)
    for (const word of text.matchAll(/\S+/gu)) {
      assert.equal(pieces.filter(p => p.startOffset <= word.index && word.index + word[0].length <= p.endOffset).length, 1, reference)
      tokens++
    }
    characters += text.length
  }
  assert.equal(characters, 765773)
  assert.equal(tokens, 129876)
})

test('all unlisted references use exact native identity and only the ten reviewed overrides exist', () => {
  const expected = ['Acts|19|40', 'Acts|19|41', 'Romans|16|25', 'Romans|16|26', 'Romans|16|27',
    '2 Corinthians|11|32', '2 Corinthians|11|33', '2 Corinthians|13|12', '2 Corinthians|13|13', '2 Corinthians|13|14']
  assert.deepEqual(policy.overrides.map(x => x.canonicalReference), expected)
  const special = new Set([...expected, 'Revelation|12|18'])
  for (const [ref, pieces] of Object.entries(result.sourcePieces)) {
    if (special.has(ref)) continue
    assert.deepEqual(pieces, [{ nativeReference: ref, startOffset: 0, endOffset: source[ref].length }], ref)
    assert.equal(result.targetTexts[ref], source[ref], ref)
  }
})

test('the three clause cuts retain exact offsets and distinct risk/dismissal, watch/escape and greeting clauses', () => {
  for (const [first, second, cut, suffix] of [
    ['Acts|19|40', 'Acts|19|41', 156, 'Сказав это, он распустил собрание.'],
    ['2 Corinthians|11|32', '2 Corinthians|11|33', 83, 'и я в корзине был спущен из окна по стене и избежал его рук.'],
    ['2 Corinthians|13|12', '2 Corinthians|13|13', 43, 'Приветствуют вас все святые.'],
  ]) {
    assert.equal(source[first].slice(cut), suffix)
    assert.equal(result.targetTexts[first], source[first].slice(0, cut).trim())
    assert.equal(result.targetTexts[second], suffix)
    assert.deepEqual(result.sourcePieces[first], [{ nativeReference: first, startOffset: 0, endOffset: cut }])
    assert.deepEqual(result.sourcePieces[second], [{ nativeReference: first, startOffset: cut, endOffset: source[first].length }])
    assert.deepEqual(result.nativeToCanonical[first], [first, second])
  }
})

test('Romans doxology relocates whole fragments without merging Tertius or any of the original greetings', () => {
  for (let verse = 1; verse <= 24; verse++) assert.equal(result.targetTexts[`Romans|16|${verse}`], source[`Romans|16|${verse}`])
  for (let verse = 24; verse <= 26; verse++) {
    const from = `Romans|14|${verse}`, to = `Romans|16|${verse + 1}`
    assert.equal(result.targetTexts[to], source[from])
    assert.deepEqual(result.nativeToCanonical[from], [to])
    assert.deepEqual(result.canonicalToNative[to], [from])
    assert.doesNotMatch(result.targetTexts[to], /Тертий|Гаий|Ераст|Кварт/)
  }
  assert.match(result.targetTexts['Romans|16|22'], /Тертий/)
  assert.match(result.targetTexts['Romans|16|23'], /Гаий.*Ераст.*Кварт/)
  assert.equal(result.targetTexts['2 Corinthians|13|14'], source['2 Corinthians|13|13'])
  assert.deepEqual(result.nativeToCanonical['2 Corinthians|13|13'], ['2 Corinthians|13|14'])
})

test('Revelation 12:18 is absent without fallback or a synthetic dash, while native 13:1 remains whole', () => {
  assert.deepEqual(result.sourcePieces['Revelation|12|18'], [])
  assert.deepEqual(result.canonicalToNative['Revelation|12|18'], [])
  assert.equal(Object.hasOwn(result.targetTexts, 'Revelation|12|18'), false)
  assert.equal(result.books.find(b => b.name === 'Revelation').chapters.find(c => c.number === 12).verses.some(v => v.number === 18), false)
  assert.equal(result.targetTexts['Revelation|13|1'], source['Revelation|13|1'])
  assert.match(result.targetTexts['Revelation|13|1'], /^И стал я на песке морском, и увидел/)
})

test('the retained pre-repair NT has exactly the reviewed 89 text changes; a materialized rendition must match every result', () => {
  const installed = flatten(read('../public/data/translations/SYNO-W.json'))
  if (hash(Object.entries(installed)) === policy.provenance.priorWesternNtReferenceTextSha256) {
    const changed = Object.keys(result.sourcePieces).filter(ref => installed[ref] !== result.targetTexts[ref])
    assert.equal(changed.length, 89)
    assert.deepEqual(changed, policy.provenance.reviewedChangedCanonicalReferences)
  } else {
    // After the separately authorized converter materialization, require exact
    // repaired text; an unknown third rendition cannot silently pass.
    assert.deepEqual(installed, result.targetTexts)
  }
})

test('NT source pins ignore OT and template wording, while inputs remain untouched', () => {
  const n = structuredClone(native), t = structuredClone(template)
  for (const data of [n, t]) for (const book of data.books) if (!nt.has(book.name)) book.chapters = null
  const first = t.books.find(book => nt.has(book.name)).chapters[0].verses[0]
  first.text = 'Template wording is not Russian alignment evidence.'
  assert.deepEqual(synodalNtDigests({ nativeData: n, canonicalTemplateData: t }), policy.sourceDigests)
  assert.deepEqual(resolve(policy, n, t), result)
  assert.deepEqual([hash(native), hash(template), hash(policy)], before)
})

test('malformed, missing, foreign, conflicting and duplicate declarations fail rather than inventing fallback', () => {
  for (const [label, alter, pattern] of [
    ['unknown policy field', p => { p.proportionalFallback = true }, /Malformed policy/],
    ['wrong source digest', p => { p.sourceDigests.nativeNtReferenceTextSha256 = '0'.repeat(64) }, /digest mismatch/],
    ['missing clause declaration', p => { p.overrides = p.overrides.filter(x => x.canonicalReference !== 'Acts|19|41') }, /Unexplained missing/],
    ['duplicate target', p => { p.overrides.push(structuredClone(p.overrides[0])) }, /duplicate\/conflicting override/],
    ['unknown canonical target', p => { p.overrides[0].canonicalReference = 'Acts|19|42' }, /Unknown\/duplicate/],
    ['OT native source', p => { p.overrides[0].sourcePieces[0].nativeReference = 'Genesis|1|1' }, /Unknown native/],
    ['empty override', p => { p.overrides[0].sourcePieces = [] }, /Empty source-piece/],
    ['invalid offset', p => { p.overrides[0].sourcePieces[0].startOffset = -1 }, /Invalid source-piece/],
    ['fractional offset', p => { p.overrides[0].sourcePieces[0].startOffset = 0.5 }, /Invalid source-piece/],
    ['cut inside a word', p => { p.overrides[0].sourcePieces[0].endOffset = 160 }, /inside a word/],
    ['character gap despite intact words', p => { override(p, 'Acts|19|40').sourcePieces[0].endOffset = 155 }, /Unconsumed or overlapping/],
    ['overlapping separator', p => { override(p, 'Acts|19|41').sourcePieces[0].startOffset = 155 }, /Unconsumed or overlapping/],
    ['accidental whole verse copy', p => { override(p, 'Acts|19|41').sourcePieces[0].startOffset = 0 }, /Unconsumed or overlapping/],
    ['duplicate absent target', p => { p.explicitAbsentReferences.push('Revelation|12|18') }, /duplicate absent/],
    ['unknown absent target', p => { p.explicitAbsentReferences = ['Revelation|12|99'] }, /Unknown\/duplicate absent/],
    ['absent conflicts with pieces', p => { p.explicitAbsentReferences.push('Acts|19|40') }, /conflicting override/],
    ['reviewed count mismatch', p => { p.expectedCounts.nativeCharacterCount-- }, /Reviewed count mismatch/],
  ]) assert.throws(() => resolve(change(alter)), pattern, label)
})

test('native changes, unknown template slots, duplicate input identities and unexplained new native words fail', () => {
  const changed = structuredClone(native)
  changed.books.find(b => b.name === 'Romans').chapters[0].verses[0].text += ' changed'
  assert.throws(() => resolve(policy, changed), /digest mismatch/)
  const canonical = structuredClone(template)
  canonical.books.find(b => b.name === 'Romans').chapters[0].verses.push({ number: 999, text: 'new' })
  assert.throws(() => resolve(policy, native, canonical), /digest mismatch/)
  const emptyChapter = structuredClone(template)
  emptyChapter.books.find(b => b.name === 'Romans').chapters.push({ number: 999, verses: [] })
  assert.throws(() => resolve(policy, native, emptyChapter), /Malformed\/duplicate NT chapter/)
  const missingBook = structuredClone(native)
  missingBook.books = missingBook.books.filter(b => b.name !== 'Romans')
  assert.throws(() => resolve(policy, missingBook), /Missing NT book/)
  const duplicate = structuredClone(native)
  duplicate.books.find(b => b.name === 'Romans').chapters[0].verses.push({ number: 1, text: 'duplicate' })
  assert.throws(() => resolve(policy, duplicate), /duplicate NT verse/)
  const extra = structuredClone(native)
  extra.books.find(b => b.name === 'Romans').chapters[0].verses.push({ number: 999, text: 'unowned source' })
  const repinned = structuredClone(policy)
  repinned.sourceDigests = synodalNtDigests({ nativeData: extra, canonicalTemplateData: template })
  assert.throws(() => resolve(repinned, extra), /Unconsumed native source/)
  const missing = structuredClone(native)
  missing.books.find(b => b.name === 'Romans').chapters[0].verses.splice(0, 1)
  repinned.sourceDigests = synodalNtDigests({ nativeData: missing, canonicalTemplateData: template })
  assert.throws(() => resolve(repinned, missing), /Unexplained missing canonical source/)
})

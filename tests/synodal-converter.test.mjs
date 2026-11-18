import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { NT_BOOKS } from '../scripts/lib/synodalNtVersification.cjs'
import { buildReviewedSynodalRemap, assertSynodalRepairPreservesOt, convertVPLText,
  buildVerseCountMap, parseSynodalMappingRules } from '../scripts/convert-translations.cjs'

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const nativeData = read('../public/data/translations/SYNO-W-native.json')
const canonicalTemplateData = read('../public/data/translations/LSV.json')
const installedData = read('../public/data/translations/SYNO-W.json')
const installedMaps = {
  nativeToCanonical: read('../public/data/versification/SYNO-W.native-to-canonical.json').map,
  canonicalToNative: read('../public/data/versification/SYNO-W.canonical-to-native.json').map,
}
const mappingRules = parseSynodalMappingRules(fileURLToPath(new URL('../scripts/bible-sources/Synodal.properties', import.meta.url)),
  buildVerseCountMap(nativeData), buildVerseCountMap(canonicalTemplateData))
const result = buildReviewedSynodalRemap({ nativeData, canonicalTemplateData, mappingRules,
  policy: read('../scripts/bible-sources/SYNO-W-nt-versification.json') })
const nt = new Set(NT_BOOKS)
const otBooks = data => data.books.filter(book => !nt.has(book.name))
const otMap = map => Object.fromEntries(Object.entries(map).filter(([ref]) => !nt.has(ref.split('|')[0])))
const args = { nativeData, retainedNativeData: nativeData, repairedData: result.synoWestern, installedData,
  maps: result, installedMaps }

test('the retained VPL regenerates the exact complete native Russian source before any repair', () => {
  const text = readFileSync(new URL('../scripts/bible-sources/russyn_vpl.txt', import.meta.url), 'utf8')
  assert.deepEqual(convertVPLText(text, 'SYNO-NATIVE', 'Russian Synodal (Native)', { strictCanonicalOnly: true }), nativeData)
})

test('the actual converter preserves all 39 OT books and both OT maps while replacing only reviewed NT boundaries', () => {
  assert.equal(otBooks(result.synoWestern).length, 39)
  assert.deepEqual(otBooks(result.synoWestern), otBooks(installedData))
  for (const direction of Object.keys(installedMaps)) assert.deepEqual(otMap(result[direction]), otMap(installedMaps[direction]))
  assert.doesNotThrow(() => assertSynodalRepairPreservesOt(args))
  assert.equal(result.report.nativeVerseCount, 31169)
  assert.equal(result.report.canonicalVerseCount, 31104)
  assert.equal(result.report.materializedVerseCount, 31103)
  assert.equal(result.report.fallbackIdentityRefsCount, 11)
  assert.equal(result.report.newTestament.fallbackIdentityRefsCount, 0)
  assert.equal(result.report.explicitlyAbsentCanonicalRefsCount, 1)
  assert.equal(result.hasBlockingErrors, false)
  assert.deepEqual(result.canonicalToNative['Romans|16|25'], ['Romans|14|24'])
  assert.deepEqual(result.canonicalToNativePieces['Acts|19|41'], [
    { nativeReference: 'Acts|19|40', startOffset: 156, endOffset: 190 },
  ])
  assert.deepEqual(result.canonicalToNative['Revelation|12|18'], [])
})

test('native, OT text and either OT map changes stop the selective repair before output is written', () => {
  const native = structuredClone(nativeData)
  native.books[0].chapters[0].verses[0].text += ' changed'
  assert.throws(() => assertSynodalRepairPreservesOt({ ...args, nativeData: native }), /native source changed/)
  const repaired = structuredClone(result.synoWestern)
  repaired.books[0].chapters[0].verses[0].text += ' changed'
  assert.throws(() => assertSynodalRepairPreservesOt({ ...args, repairedData: repaired }), /change OT text/)
  for (const direction of Object.keys(installedMaps)) {
    const maps = structuredClone(result)
    maps[direction]['Genesis|1|1'] = ['Genesis|1|2']
    assert.throws(() => assertSynodalRepairPreservesOt({ ...args, maps }), /change the OT .* map/)
  }
})

test('converting twice yields identical text and source-piece identities without mutating its inputs', () => {
  const before = JSON.stringify({ nativeData, canonicalTemplateData, mappingRules })
  const again = buildReviewedSynodalRemap({ nativeData, canonicalTemplateData, mappingRules,
    policy: read('../scripts/bible-sources/SYNO-W-nt-versification.json') })
  assert.deepEqual(again.synoWestern, result.synoWestern)
  assert.deepEqual(again.nativeToCanonical, result.nativeToCanonical)
  assert.deepEqual(again.canonicalToNativePieces, result.canonicalToNativePieces)
  assert.equal(JSON.stringify({ nativeData, canonicalTemplateData, mappingRules }), before)
})

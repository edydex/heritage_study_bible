import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { chapterWordAnchors } from './parallelWordAnchors'
import { greekLemmaIds, interactiveWordRanges } from './wordStudy'
import greek from '../../public/data/original-languages/greek-nt-n1904.json'
import concordance from '../../public/data/original-languages/greek-concordance.json'
import synodal from '../../public/data/translations/SYNO-W.json'
import russian from '../../public/data/original-languages/syno-w-word-links/romans.json'
import morphology from '../../public/data/original-languages/greek-morphology-pilot.json'

afterEach(() => vi.unstubAllGlobals())
const read = file => JSON.parse(readFileSync('public/data/' + file, 'utf8'))
const sourceBook = greek.books.find(book => book.name === 'Romans')
const russianBook = synodal.books.find(book => book.name === 'Romans')
const strongs = word => greekLemmaIds(concordance, word).flatMap(id => concordance.lemmas[id].strongs)
function compare(target = 'ORIGINAL', chapter = 1, mapping = russian) {
  const opposite = target === 'ORIGINAL' ? null : read('original-languages/' + target.toLowerCase() + '-word-links/romans.json')
  const oppositeBook = target === 'ORIGINAL' ? sourceBook : read('translations/' + target + '/romans.json')
  const graph = chapterWordAnchors({ primaryData: mapping, secondaryData: opposite, sourceBook,
    primaryBook: russianBook, secondaryBook: oppositeBook, chapter })
  expect(graph.invalidReferences).toEqual([])
  const words = verse => {
    const ref = `${chapter}:${verse}`, text = russianBook.chapters.find(c => c.number === chapter).verses.find(v => v.number === verse).text
    return interactiveWordRanges(text, graph.primary.get(ref), { translationId: 'SYNO-W', book: 'Romans', chapter, verse,
      lookupLinks: graph.lookupPrimary.get(ref), unpairedNotes: graph.primaryNotes.get(ref) })
  }
  return { graph, words, oppositeBook }
}

it.each(['BSB', 'LSV', 'KJV'])('Russian and %s share the same actual Greek occurrence, color and texture', target => {
  const { graph, words, oppositeBook } = compare(target)
  const paul = words(1).find(word => word.word === 'Павел')
  const english = interactiveWordRanges(oppositeBook.chapters[0].verses[0].text, graph.secondary.get('1:1'),
    { translationId: target, book: 'Romans', chapter: 1, verse: 1 }).find(word => /^paul$/i.test(word.word))
  expect(paul.paired).toBe(true)
  expect(strongs(paul)).toEqual(['3972'])
  for (const key of ['id', 'color', 'texture', 'pattern']) expect(paul[key]).toEqual(english[key])
})

it('Russian truth wording retains the actual righteousness head and a real pronoun head keeps its preposition alternative', () => {
  const { words } = compare()
  expect(strongs(words(17).find(word => word.word === 'правда'))).toEqual(['1343'])
  const them = words(19).find(word => word.word === 'них')
  expect(strongs(them)).toEqual(['846', '1722'])
  expect(them.studyHeadAnchors).toHaveLength(1)
  expect(them.studyHeadAnchors[0].text).toMatch(/^αὐτοῖς/)
})

it('a moved Russian word retains its preceding Greek occurrence and has no invented local identity', () => {
  const { words } = compare()
  const moved = words(30).find(word => word.word === 'злоречивы')
  expect(moved.studySourceAnchors).toMatchObject([{ chapter: 1, verse: 29, text: 'ψιθυριστάς,' }])
  expect(strongs(moved)).toEqual(['5588'])
})

it('unpaired witness words and an explicitly unreviewed chapter fixture have no invented Greek lemma', () => {
  const extra = compare().words(16).find(word => word.word === 'Христова')
  expect(extra.paired).toBe(false)
  expect(strongs(extra)).toEqual([])
  // Keep the missing-review contract independent of growing real coverage.
  const missingChapter = { ...russian, verses: Object.fromEntries(Object.entries(russian.verses).filter(([ref]) => !ref.startsWith('7:'))) }
  const unreviewed = compare('ORIGINAL', 7, missingChapter).words(24)
  expect(unreviewed.every(word => !word.paired && strongs(word).length === 0)).toBe(true)
})

it('mapped Russian opens actual Greek grammar while Russian surface wording alone supplies none', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => morphology })))
  const { loadGreekMorphology } = await import('./greekMorphology')
  const slave = compare().words(1).find(word => word.word === 'раб')
  const forms = await loadGreekMorphology(slave)
  expect(forms).toHaveLength(1)
  expect(forms[0]).toMatchObject({ chapter: 1, verse: 1, lemma: 'δοῦλος (II)', funcMorph: 'N-NSM' })
  expect(await loadGreekMorphology({ translationId: 'SYNO-W', book: 'Romans', chapter: 1, verse: 1, word: 'раб' })).toEqual([])
})

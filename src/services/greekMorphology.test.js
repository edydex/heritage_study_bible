import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import pilot from '../../public/data/original-languages/greek-morphology-pilot.json'
import greek from '../../public/data/original-languages/greek-nt-n1904.json'
import { chapterWordAnchors } from './parallelWordAnchors'
import { interactiveWordRanges } from './wordStudy'
import { decodeGreekMorphology } from './greekMorphology'

const read = path => JSON.parse(readFileSync(resolve(path), 'utf8'))
const original = name => greek.books.find(book => book.name === name)
const pilotEntry = (book, ref) => pilot.books.find(value => value.name === book).verses[ref]
const originalWord = (book, ref, form) => {
  const [chapter, verse] = ref.split(':').map(Number), entry = pilotEntry(book, ref)
  const startOffset = entry.text.indexOf(form)
  return { book, chapter, verse, translationId: 'ORIGINAL', startOffset, endOffset: startOffset + form.length, word: form }
}
const feature = (decoded, key) => decoded.features.find(value => value.key === key)
beforeEach(() => { vi.resetModules(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => pilot }))) })

it('preserves every one of the 8,675 exact pilot occurrences and both original tags', () => {
  let count = 0, differences = 0
  expect(pilot.books.map(book => book.name)).toEqual(['Romans', 'Colossians'])
  expect(pilot.sourceSha256).toBe(greek.sources[0].sha256)
  for (const book of pilot.books) {
    const source = original(book.name)
    expect(Object.keys(book.verses)).toHaveLength(source.chapters.reduce((total, chapter) => total + chapter.verses.length, 0))
    for (const [ref, entry] of Object.entries(book.verses)) {
      const [chapter, verse] = ref.split(':').map(Number)
      const text = source.chapters.find(value => value.number === chapter).verses.find(value => value.number === verse).text
      expect(entry.text).toBe(text)
      const tokens = [...text.matchAll(/\S+/gu)]
      expect(entry.words).toHaveLength(tokens.length)
      entry.words.forEach(([start, end, lemma, functional, form], index) => {
        expect([start, end]).toEqual([tokens[index].index, tokens[index].index + tokens[index][0].length])
        expect(pilot.lemmas[lemma].lemma).toBeTruthy()
        expect(pilot.codes[functional]).toBeTruthy(); expect(pilot.codes[form]).toBeTruthy()
        count++; differences += functional !== form ? 1 : 0
      })
    }
  }
  expect(count).toBe(8675); expect(differences).toBe(71)
})

it('fully decodes all 491 published pilot codes in English and Russian without losing suffixes', () => {
  expect(pilot.codes).toHaveLength(491)
  for (const code of pilot.codes) for (const language of ['en', 'ru']) {
    const result = decodeGreekMorphology(code, language)
    expect(result.code).toBe(code); expect(result.recognized, code).toBe(true)
    expect(result.unknownParts, code).toEqual([])
    expect(result.partOfSpeech.label).toBeTruthy(); expect(result.partOfSpeech.explanation).toBeTruthy()
    for (const field of result.features) {
      expect(field.label).toBeTruthy(); expect(field.value).toBeTruthy(); expect(field.explanation).toBeTruthy()
      if (language === 'ru') expect(field.label).toMatch(/[А-Яа-яЁё]/)
    }
  }
  expect(feature(decodeGreekMorphology('V-2RAI-3P-ATT'), 'verbExtra')).toMatchObject({ code: 'ATT', value: 'Attic form' })
  expect(feature(decodeGreekMorphology('A-NSM-C'), 'suffix')).toMatchObject({ code: 'C', value: 'Comparative' })
})

it('distinguishes deponent voice N from D, and the aorist from future at the exact rescue occurrences', async () => {
  const { loadGreekMorphology } = await import('./greekMorphology')
  const [past] = await loadGreekMorphology(originalWord('Colossians', '1:13', 'ἐρύσατο'))
  const [future] = await loadGreekMorphology(originalWord('Romans', '7:24', 'ῥύσεται'))
  expect(past).toMatchObject({ lemma: 'ῥύομαι', funcMorph: 'V-ANI-3S', formMorph: 'V-ADI-3S', tagsDiffer: true })
  expect(future).toMatchObject({ lemma: 'ῥύομαι', funcMorph: 'V-FDI-3S', formMorph: 'V-FDI-3S', tagsDiffer: false })
  const functional = decodeGreekMorphology(past.funcMorph), formal = decodeGreekMorphology(past.formMorph)
  expect(feature(functional, 'voice')).toMatchObject({ code: 'N', value: 'Middle or passive deponent' })
  expect(feature(formal, 'voice')).toMatchObject({ code: 'D', value: 'Middle deponent' })
  expect(functional.ambiguous).toBe(true); expect(formal.ambiguous).toBe(false)
  expect(feature(functional, 'tense').explanation).toContain('Aorist alone does not mean once for all')
  expect(feature(decodeGreekMorphology(future.funcMorph, 'ru'), 'tense').value).toBe('Будущее время')
  expect(past.source.documents.map(doc => doc.url)).toContain(`https://github.com/biblicalhumanities/Nestle1904/blob/${pilot.revision}/morph/parsing.txt`)
  expect(past.source.analysisNote).toContain('same printed token, not different textual readings')
})

it('keeps pronoun ownership, participle agreement and indeclinable unknowns distinct', () => {
  const possessive = decodeGreekMorphology('S-1PASF')
  expect(feature(possessive, 'possessorPerson').code).toBe('1')
  expect(feature(possessive, 'possessorNumber').code).toBe('P')
  expect(feature(possessive, 'number').code).toBe('S')
  expect(feature(possessive, 'case').code).toBe('A')
  expect(feature(possessive, 'gender').code).toBe('F')
  expect(feature(decodeGreekMorphology('V-RPP-GSN'), 'case').value).toBe('Genitive')
  expect(feature(decodeGreekMorphology('N-PRI'), 'case')).toBeUndefined()
  expect(feature(decodeGreekMorphology('N-PRI'), 'formType').value).toBe('Indeclinable proper noun')
  expect(feature(decodeGreekMorphology('P-1NS'), 'gender')).toBeUndefined()
})

it('retains unknown codes explicitly rather than silently assigning a familiar grammatical value', () => {
  for (const code of ['V-AZI-3S', 'N-XSF', 'V-AAI-99', 'V-AAI-3S-UNKNOWN', 'UNKNOWN', '']) {
    const result = decodeGreekMorphology(code, 'ru')
    expect(result.recognized).toBe(false); expect(result.code).toBe(code)
    expect(result.unknownParts.length).toBeGreaterThan(0); expect(result.notes[0]).toContain('Неизвестные части')
  }
  expect(feature(decodeGreekMorphology('V-AZI-3S'), 'voice')).toBeUndefined()
})

for (const target of ['LSV', 'BSB', 'KJV']) for (const [name, slug, chapter, verse, expectedCode] of [
  ['Colossians', 'colossians', 1, 13, 'V-ANI-3S'], ['Romans', 'romans', 7, 24, 'V-FDI-3S'],
]) it(`loads ${target} ${name} ${chapter}:${verse} grammar through its actual checked word links`, async () => {
  const source = original(name)
  const alignment = read(`public/data/original-languages/${target.toLowerCase()}-word-links/${slug}.json`)
  const targetBook = read(`public/data/translations/${target}/${slug}.json`)
  const anchors = chapterWordAnchors({ primaryData: alignment, secondaryData: null, primaryBook: targetBook, secondaryBook: source, sourceBook: source, chapter })
  expect(anchors.invalidReferences).toEqual([])
  const ref = `${chapter}:${verse}`
  const words = interactiveWordRanges(alignment.verses[ref].targetText, anchors.primary.get(ref), { book: name, chapter, verse, translationId: target })
  const rescue = words.find(word => word.studySourceAnchors?.some(anchor => /ἐρύσατο|ῥύσεται/.test(anchor.text)))
  expect(rescue, `Actual ${target} rescue counterpart`).toBeTruthy()
  const { loadGreekMorphology } = await import('./greekMorphology')
  const result = await loadGreekMorphology(rescue, 'ῥύομαι')
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ book: name, chapter, verse, funcMorph: expectedCode, lemma: 'ῥύομαι' })
})

it('uses a moved original reference and precise study anchors rather than the English verse or broad color group', async () => {
  const source = original('Romans'), alignment = read('public/data/original-languages/lsv-word-links/romans.json')
  const anchors = chapterWordAnchors({ primaryData: alignment, secondaryData: null, primaryBook: read('public/data/translations/LSV/romans.json'), secondaryBook: source, sourceBook: source, chapter: 7 })
  const word = interactiveWordRanges(alignment.verses['7:9'].targetText, anchors.primary.get('7:9'), { book: 'Romans', chapter: 7, verse: 9, translationId: 'LSV' }).find(value => value.word === 'died')
  expect(word.studySourceAnchors).toMatchObject([{ chapter: 7, verse: 10 }])
  const { loadGreekMorphology } = await import('./greekMorphology')
  const result = await loadGreekMorphology({ ...word, sourceRange: [0, 1], sourceAnchors: [{ chapter: 7, verse: 9, startOffset: 0, endOffset: 2, text: 'INVALID' }] })
  expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ chapter: 7, verse: 10, text: 'ἀπέθανον,' })
  expect(await loadGreekMorphology(word, 'ῥύομαι')).toEqual([])
})

it('refuses changed Greek text, clipped words, invalid references, Russian surface inference and out-of-pilot books', async () => {
  const { loadGreekMorphology } = await import('./greekMorphology')
  const word = originalWord('Colossians', '1:13', 'ἐρύσατο')
  expect(await loadGreekMorphology({ ...word, word: 'ἔσωσεν' })).toEqual([])
  expect(await loadGreekMorphology({ ...word, endOffset: word.startOffset + 1, word: 'ἐ' })).toEqual([])
  expect(await loadGreekMorphology({ ...word, startOffset: -1 })).toEqual([])
  expect(await loadGreekMorphology({ ...word, verse: 999 })).toEqual([])
  expect(await loadGreekMorphology({ ...word, translationId: 'SYNO-W', word: 'избавил' })).toEqual([])
  expect(await loadGreekMorphology({ ...word, book: '2 Corinthians' })).toEqual([])
  expect(await loadGreekMorphology({ book: 'Romans', chapter: 7, verse: 24, translationId: 'BSB', word: 'rescue' })).toEqual([])
  expect(await loadGreekMorphology({ ...word, translationId: 'LSV', sourceAnchors: [{ chapter: 1, verse: 13, startOffset: word.startOffset, endOffset: word.endOffset, text: 'ἔσωσεν' }] })).toEqual([])
})

it('retries after a failed fetch and rejects unrecognized or incomplete source data', async () => {
  fetch.mockResolvedValueOnce({ ok: false })
  const { loadGreekMorphology } = await import('./greekMorphology')
  const word = originalWord('Romans', '7:24', 'ῥύσεται')
  await expect(loadGreekMorphology(word)).rejects.toThrow('could not load')
  expect(await loadGreekMorphology(word)).toHaveLength(1)
  expect(fetch).toHaveBeenCalledTimes(2)
  vi.resetModules()
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...pilot, codes: [...pilot.codes.slice(0, -1), 'V-AZI-3S'] }) })
  const fresh = await import('./greekMorphology')
  await expect(fresh.loadGreekMorphology(word)).rejects.toThrow('unknown source code')
})

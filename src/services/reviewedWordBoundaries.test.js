import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { chapterWordAnchors } from './parallelWordAnchors'
import { greekLemmaIds, interactiveWordRanges } from './wordStudy'
import greek from '../../public/data/original-languages/greek-nt-n1904.json'
import concordance from '../../public/data/original-languages/greek-concordance.json'

const read = path => JSON.parse(readFileSync(resolve(path), 'utf8'))
const mapping = (target, slug) => read(`public/data/original-languages/${target.toLowerCase()}-word-links/${slug}.json`)
const translation = (target, slug) => read(`public/data/translations/${target}/${slug}.json`)
const sourceBook = name => greek.books.find(book => book.name === name)

for (const target of ['BSB', 'LSV', 'KJV']) it(`${target} links the final Corinthian greeting and benediction to their actual Greek references`, () => {
  const data = mapping(target, '2-corinthians'), original = sourceBook('2 Corinthians')
  const links = chapterWordAnchors({ primaryData: data, secondaryData: null, primaryBook: translation(target, '2-corinthians'), secondaryBook: original, sourceBook: original, chapter: 13 })
  expect(links.invalidReferences).toEqual([])
  const graceText = data.verses['13:14'].targetText
  const grace = links.primary.get('13:14').find(link => graceText.slice(link.startOffset, link.endOffset) === 'grace')
  const rawGraceText = original.chapters.find(chapter => chapter.number === 13).verses.find(verse => verse.number === 13).text
  const rawGrace = links.secondary.get('13:13').find(link => rawGraceText.slice(link.startOffset, link.endOffset) === 'χάρις')
  expect(grace.id).toBe(rawGrace.id)
  expect(grace.counterparts).toContainEqual({ translationId: 'ORIGINAL', chapter: 13, verse: 13 })
  const greetingText = data.verses['13:13'].targetText
  const greeting = links.primary.get('13:13').find(link => /saints|holy ones/.test(greetingText.slice(link.startOffset, link.endOffset)))
  expect(greeting.studySourceAnchors).toMatchObject([{ chapter: 13, verse: 12, text: 'ἅγιοι' }])
  expect(greeting.id).not.toBe(grace.id)
})

for (const target of ['BSB', 'LSV', 'KJV']) it(`${target} connects the separate Greek 3 John closing to its English 1:14 counterpart`, () => {
  const data = mapping(target, '3-john'), original = sourceBook('3 John')
  const links = chapterWordAnchors({ primaryData: data, secondaryData: null, primaryBook: translation(target, '3-john'), secondaryBook: original, sourceBook: original, chapter: 1 })
  expect(links.invalidReferences).toEqual([])
  const text = data.verses['1:14'].targetText
  const peace = links.primary.get('1:14').find(link => text.slice(link.startOffset, link.endOffset) === 'Peace')
  const rawText = original.chapters[0].verses.find(verse => verse.number === 15).text
  const rawPeace = links.secondary.get('1:15').find(link => rawText.slice(link.startOffset, link.endOffset) === 'Εἰρήνη')
  expect(peace.id).toBe(rawPeace.id)
  expect(peace.studySourceAnchors).toMatchObject([{ chapter: 1, verse: 15, text: 'Εἰρήνη' }])
  expect(links.primary.has('1:15')).toBe(false)
  if (target === 'KJV') expect(links.primaryNotes.get('1:14').some(note => /possessive/.test(note.reason))).toBe(true)
})

it('studies each Thessalonian verb at its own lemma despite their shared English may in the preceding verse', () => {
  const data = mapping('LSV', '2-thessalonians'), original = sourceBook('2 Thessalonians')
  const links = chapterWordAnchors({ primaryData: data, secondaryData: null, primaryBook: translation('LSV', '2-thessalonians'), secondaryBook: original, sourceBook: original, chapter: 2 })
  expect(links.invalidReferences).toEqual([])
  const words = interactiveWordRanges(data.verses['2:17'].targetText, links.primary.get('2:17'), { book: '2 Thessalonians', chapter: 2, verse: 17, translationId: 'LSV' })
  const comfort = words.find(word => word.word === 'comfort'), establish = words.find(word => word.word === 'establish')
  expect(comfort.id).toBe(establish.id)
  const strongs = word => greekLemmaIds(concordance, word).flatMap(id => concordance.lemmas[id].strongs).map(Number)
  expect(strongs(comfort)).toEqual([3870])
  expect(strongs(establish)).toEqual([4741])
  const may = interactiveWordRanges(data.verses['2:16'].targetText, links.primary.get('2:16'), { book: '2 Thessalonians', chapter: 2, verse: 16, translationId: 'LSV' }).find(word => word.word === 'may')
  expect(new Set(strongs(may))).toEqual(new Set([3870, 4741]))
  expect(may.notes.join(' ')).toMatch(/optative|auxiliary/i)
})

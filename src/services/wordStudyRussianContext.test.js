import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import original from '../../public/data/original-languages/greek-nt-n1904.json'
import synodal from '../../public/data/translations/SYNO-W.json'

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

function installFetch({ unreviewedRomansRefs = [] } = {}) {
  const fetch = vi.fn(async url => {
    const relative = String(url).replace(/^\//, '')
    return { ok: true, json: async () => {
      const data = JSON.parse(readFileSync('public/' + relative, 'utf8'))
      if (relative.endsWith('/syno-w-word-links/romans.json')) {
        for (const ref of unreviewedRomansRefs) delete data.verses[ref]
      }
      return data
    } }
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
function row(chapter, verse, word) {
  const text = original.books.find(b => b.name === 'Romans').chapters.find(c => c.number === chapter).verses.find(v => v.number === verse).text
  const start = text.indexOf(word)
  expect(start).toBeGreaterThanOrEqual(0)
  return { book: 'Romans', chapter, verse, text, count: 1, ranges: [[start, start + word.length]] }
}

it('highlights reviewed Synodal wording while keeping an explicitly unreviewed fixture occurrence unlinked', async () => {
  const fetch = installFetch({ unreviewedRomansRefs: ['7:24'] })
  const { loadOccurrenceTranslations, occurrenceKey } = await import('./wordStudy')
  const checked = row(1, 1, 'Παῦλος'), unreviewed = row(7, 24, 'ῥύσεται')
  const result = await loadOccurrenceTranslations([checked, unreviewed], 'N1904', 'SYNO-W')
  expect(result.failed).toBe(false)
  expect(result.results[occurrenceKey(checked)]).toMatchObject({ status: 'matched', phrases: ['Павел'], missingCount: 0 })
  const text = synodal.books.find(b => b.name === 'Romans').chapters.find(c => c.number === 7).verses.find(v => v.number === 24).text
  expect(result.results[occurrenceKey(unreviewed)]).toMatchObject({ text, status: 'unmapped', ranges: [], phrases: [], missingCount: 1 })
  expect(fetch.mock.calls.map(([url]) => url)).toContain('/data/original-languages/syno-w-word-links/romans.json')
})

it('the newly reviewed Romans 7 rescue occurrence has its actual Russian wording', async () => {
  installFetch()
  const { loadOccurrenceTranslations, occurrenceKey } = await import('./wordStudy')
  const greek = row(7, 24, 'ῥύσεται')
  const result = await loadOccurrenceTranslations([greek], 'N1904', 'SYNO-W')
  expect(result.failed).toBe(false)
  expect(result.results[occurrenceKey(greek)]).toMatchObject({ status: 'matched', phrases: ['избавит'], missingCount: 0 })
})

it('occurrence context follows the actual Russian counterpart in the next verse', async () => {
  installFetch()
  const { loadOccurrenceTranslations, occurrenceKey } = await import('./wordStudy')
  const greek = row(1, 29, 'ψιθυριστάς')
  const result = await loadOccurrenceTranslations([greek], 'N1904', 'SYNO-W')
  const match = result.results[occurrenceKey(greek)]
  expect(match).toMatchObject({ status: 'matched', missingCount: 0 })
  expect(match.contexts).toHaveLength(1)
  expect(match.contexts[0]).toMatchObject({ chapter: 1, verse: 30, phrases: ['злоречивы'] })
})

it('a failed Russian mapping request preserves Russian context and the original occurrence', async () => {
  installFetch()
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', vi.fn(url => String(url).includes('syno-w-word-links')
    ? Promise.resolve({ ok: false }) : realFetch(url)))
  const { loadOccurrenceTranslations, occurrenceKey } = await import('./wordStudy')
  const greek = row(1, 1, 'Παῦλος')
  const result = await loadOccurrenceTranslations([greek], 'N1904', 'SYNO-W')
  expect(result.failed).toBe(true)
  expect(result.results[occurrenceKey(greek)]).toMatchObject({ status: 'load-error', ranges: [], phrases: [] })
  expect(result.results[occurrenceKey(greek)].text).toContain('Павел')
})

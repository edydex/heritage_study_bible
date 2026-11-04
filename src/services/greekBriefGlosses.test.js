import { beforeEach, expect, it, vi } from 'vitest'
import data from '../../public/data/original-languages/greek-brief-glosses.json'
import concordance from '../../public/data/original-languages/greek-concordance.json'
import pilot from '../../public/data/original-languages/greek-morphology-pilot.json'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })))
})

it('loads the actual rescue lemma with canonical Unicode equivalence and explicit English provenance', async () => {
  const { loadGreekBriefGloss } = await import('./greekBriefGlosses')
  const result = await loadGreekBriefGloss('ῥύομαι', ['4506'])
  expect(result).toMatchObject({ language: 'en', glosses: ['to rescue'], source: {
    license: 'CC BY 4.0', sha256: '734a5b64a1152f67604bf09d32f15c0ba537151961752fcf168087b41b4d93ea',
  } })
  expect(result.source.attribution).toContain('Tyndale House')
  expect(result.source.attribution).toContain('STEPBible')
  expect(result.source.notice).toContain('without choosing a contextual sense')
  expect(await loadGreekBriefGloss('ῥύομαι', ['04506'])).toEqual(result)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('does not merge different lexical heads sharing Strong2730, strip homographs or fold accents and case', async () => {
  const { loadGreekBriefGloss } = await import('./greekBriefGlosses')
  expect(await loadGreekBriefGloss('κατοικέω', ['2730'])).toMatchObject({ glosses: ['to dwell'] })
  expect(await loadGreekBriefGloss('κατοικίζω', ['2730'])).toBeNull()
  // A lexicon-only number cannot substitute for the actual concordance identity.
  expect(await loadGreekBriefGloss('κατοικίζω', ['6052'])).toBeNull()
  for (const [lemma, strongs] of [['ρυομαι', ['4506']], ['Ῥύομαι', ['4506']], ['ῥύομαι', ['2730']], ['δοῦλος (II)', ['1401']]]) {
    expect(await loadGreekBriefGloss(lemma, strongs)).toBeNull()
  }
})

it('preserves all publisher glosses for the exact identity and does not select a verse sense', async () => {
  const { loadGreekBriefGloss } = await import('./greekBriefGlosses')
  const result = await loadGreekBriefGloss('πίστις', ['4102'])
  expect(result.glosses).toEqual(['faith', 'faith: faithfulness'])
  expect(result.language).toBe('en')
  result.glosses.push('not a publisher gloss')
  result.source.title = 'changed by caller'
  expect((await loadGreekBriefGloss('πίστις', ['4102'])).glosses).toEqual(['faith', 'faith: faithfulness'])
  expect((await loadGreekBriefGloss('πίστις', ['4102'])).source.title).toContain('STEPBible')
})

it('accepts the actual pilot Strong subset and returns only its attested exact-headword pairs', async () => {
  const { loadGreekBriefGloss } = await import('./greekBriefGlosses')
  const actual = concordance.lemmas.find(entry => entry.lemma.normalize('NFC') === 'ὅστις')
  const subset = pilot.lemmas.find(entry => entry.lemma.normalize('NFC') === 'ὅστις')
  expect(actual.strongs).toEqual(['3748', '3755'])
  expect(subset.strongs).toEqual(['3748'])
  expect(await loadGreekBriefGloss(subset.lemma, subset.strongs)).toMatchObject({ glosses: ['who/which'] })
  expect(await loadGreekBriefGloss(subset.lemma, ['3755'])).toBeNull()
  expect(await loadGreekBriefGloss(subset.lemma, ['3748', '4506'])).toBeNull()
  for (const lemma of pilot.lemmas) {
    const stored = data.entries.find(entry => entry.lemma.normalize('NFC') === lemma.lemma.normalize('NFC'))
    const requested = lemma.strongs.map(value => String(Number(value)))
    const expected = [...new Set(stored.matches.filter(row => requested.includes(row[0])).map(row => row[2]))]
    const result = await loadGreekBriefGloss(lemma.lemma, lemma.strongs)
    if (expected.length) expect(result.glosses).toEqual(expected)
    else expect(result).toBeNull()
  }
})

it('returns only exact installed concordance identities and caches one fetch for concurrent callers', async () => {
  const { loadGreekBriefGloss } = await import('./greekBriefGlosses')
  const results = await Promise.all(concordance.lemmas.map(({ lemma, strongs }) => loadGreekBriefGloss(lemma, strongs)))
  expect(results.filter(Boolean)).toHaveLength(4945)
  results.forEach((result, index) => {
    const entry = data.entries[index]
    expect(entry.lemma).toBe(concordance.lemmas[index].lemma)
    if (entry.status === 'available') expect(result.glosses).toEqual(entry.glosses)
    else expect(result).toBeNull()
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('data/original-languages/greek-brief-glosses.json'))
})

it('rejects invalid requests without fetching or using a Strong-only fallback', async () => {
  const { loadGreekBriefGloss } = await import('./greekBriefGlosses')
  for (const [lemma, strongs] of [[null, ['4506']], ['', ['4506']], ['ῥύομαι', []], ['ῥύομαι', ['G4506']], ['ῥύομαι', ['4506&1234']], ['ῥύομαι', [4506]], ['ῥύομαι', ['0']]]) {
    expect(await loadGreekBriefGloss(lemma, strongs)).toBeNull()
  }
  expect(fetch).not.toHaveBeenCalled()
})

it('retries a network failure independently of grammar loading', async () => {
  fetch.mockResolvedValueOnce({ ok: false })
  const { loadGreekBriefGloss } = await import('./greekBriefGlosses')
  await expect(loadGreekBriefGloss('ῥύομαι', ['4506'])).rejects.toThrow('could not load')
  expect(await loadGreekBriefGloss('ῥύομαι', ['4506'])).toMatchObject({ glosses: ['to rescue'] })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('rejects stale provenance, duplicate identities and invalid availability, then allows a fresh retry', async () => {
  for (const change of [
    value => { value.source.sha256 = 'unverified-source' },
    value => { value.language = 'ru' },
    value => { value.entries[1] = value.entries[0] },
    value => { value.entries.find(entry => entry.status === 'unavailable').glosses = ['guessed'] },
    value => { value.entries[0].matches = [] },
    value => { value.entries[0].matches[0][0] = '4506' },
  ]) {
    vi.resetModules()
    const invalid = structuredClone(data); change(invalid)
    fetch.mockResolvedValueOnce({ ok: true, json: async () => invalid })
    const { loadGreekBriefGloss } = await import('./greekBriefGlosses')
    await expect(loadGreekBriefGloss('ῥύομαι', ['4506'])).rejects.toThrow()
    expect(await loadGreekBriefGloss('ῥύομαι', ['4506'])).toMatchObject({ glosses: ['to rescue'] })
  }
})

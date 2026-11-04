// General English dictionary glosses, independent of a verse's translation
// links and morphology. NFC equivalence preserves accents and homographs.
const SOURCE_REVISION = '5de0a47f35f0fc13dfe1430d104e5db8a4285f9c'
const SOURCE_SHA = '734a5b64a1152f67604bf09d32f15c0ba537151961752fcf168087b41b4d93ea'
const INVENTORY_SHA = '8e59397d4e6bc15f42ed69fb08db54ad69773f9b80aa99eb51d39a040bfbadae'
const SOURCE_URL = `https://github.com/STEPBible/STEPBible-Data/blob/${SOURCE_REVISION}/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt`
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const unique = values => new Set(values).size === values.length
function strongIds(values) {
  if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string' || !/^[0-9]+$/.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value)))) return null
  return [...new Set(values.map(value => String(Number(value))))].sort((a, b) => Number(a) - Number(b))
}
function validateData(data) {
  const source = data?.source
  if (data?.schemaVersion !== 1 || data.sourceId !== 'STEP-TBESG' || data.language !== 'en'
    || source?.revision !== SOURCE_REVISION || source.sha256 !== SOURCE_SHA || source.url !== SOURCE_URL
    || source.license !== 'CC BY 4.0' || source.licenseUrl !== 'https://creativecommons.org/licenses/by/4.0/'
    || !nonempty(source.title) || !nonempty(source.attribution) || !nonempty(source.notice)
    || data.concordance?.sourceId !== 'N1904'
    || data.concordance.sourceSha256 !== '3beee6abb6302f691110fe0fc949fc195593b999cf2d0e463c9b573c1bb67150'
    || data.concordance.lemmaInventorySha256 !== INVENTORY_SHA || data.concordance.lemmaCount !== 5402
    || JSON.stringify(data.matchSchema) !== JSON.stringify(['baseStrong', 'publisherDStrong', 'englishGloss'])
    || !Array.isArray(data.entries) || data.entries.length !== 5402) throw new Error('Greek brief gloss source does not match.')
  const entries = new Map()
  let available = 0, unavailable = 0, multipleGlosses = 0
  for (const entry of data.entries) {
    const strongs = strongIds(entry.strongs)
    if (!nonempty(entry.lemma) || !strongs || JSON.stringify(strongs) !== JSON.stringify(entry.strongs)
      || !Array.isArray(entry.glosses) || !entry.glosses.every(nonempty) || !unique(entry.glosses)
      || !Array.isArray(entry.matches) || !entry.matches.every(row => Array.isArray(row) && row.length === 3
        && strongs.includes(row[0]) && typeof row[1] === 'string' && /^G[0-9]{4,5}[A-Za-z]?$/.test(row[1]) && nonempty(row[2]))
      || !unique(entry.matches.map(row => JSON.stringify(row)))
      || JSON.stringify([...new Set(entry.matches.map(row => row[2]))]) !== JSON.stringify(entry.glosses)) throw new Error('Greek brief gloss entry is invalid.')
    if (entry.status === 'available' && entry.glosses.length && entry.matches.length && entry.reason == null) {
      available++; if (entry.glosses.length > 1) multipleGlosses++
    } else if (entry.status === 'unavailable' && !entry.glosses.length && !entry.matches.length && nonempty(entry.reason)) unavailable++
    else throw new Error('Greek brief gloss availability is invalid.')
    const key = entry.lemma.normalize('NFC')
    if (entries.has(key)) throw new Error('Greek brief gloss identity is duplicated.')
    entries.set(key, entry)
  }
  if (available !== 4945 || unavailable !== 457 || multipleGlosses !== 60
    || data.counts?.available !== available || data.counts.unavailable !== unavailable || data.counts.multipleGlosses !== multipleGlosses) throw new Error('Greek brief gloss inventory differs.')
  return { entries, source }
}
let dataPromise
async function loadData() {
  if (!dataPromise) dataPromise = fetch(`${import.meta.env.BASE_URL}data/original-languages/greek-brief-glosses.json`)
    .then(response => { if (!response.ok) throw new Error('Greek brief glosses could not load.'); return response.json() })
    .then(validateData).catch(error => { dataPromise = undefined; throw error })
  return dataPromise
}

// Missing identity returns null. Fetch/validation failures reject and are
// retryable; callers handle them separately from the grammar pane.
export async function loadGreekBriefGloss(lemma, strongs) {
  const ids = strongIds(strongs)
  if (!nonempty(lemma) || !ids) return null
  const data = await loadData()
  const entry = data.entries.get(lemma.normalize('NFC'))
  if (entry?.status !== 'available' || !ids.every(id => entry.strongs.includes(id))) return null
  const glosses = [...new Set(entry.matches.filter(row => ids.includes(row[0])).map(row => row[2]))]
  return glosses.length ? { language: 'en', glosses, source: { ...data.source } } : null
}

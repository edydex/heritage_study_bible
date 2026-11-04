import { visibleVerseText } from '../data/originalLanguages'
import { assignWordLinkColors } from './wordLinkColors'

const referenceKey = ({ chapter, verse }) => `${chapter}:${verse}`
const parseReference = key => { const [chapter, verse] = key.split(':').map(Number); return { chapter, verse } }
const validReference = ref => Number.isInteger(ref?.chapter) && ref.chapter > 0 && Number.isInteger(ref?.verse) && ref.verse > 0
const validRange = (range, length) => Array.isArray(range) && range.length === 2 && range.every(Number.isInteger)
  && range[0] >= 0 && range[1] > range[0] && range[1] <= length
const overlaps = (a, b) => a[0] < b[1] && a[1] > b[0]
const mapBook = book => new Map((book?.chapters || []).flatMap(chapter => chapter.verses.map(verse =>
  [`${chapter.number}:${verse.number}`, visibleVerseText(verse.text)])))

// A reference belongs to the named original witness, not to a translated verse
// number. This distinction matters for shifted clauses and transposed verses.
export function checkedAnchorGroups(data, ref, sourceVerses, targetText) {
  const entry = data?.verses?.[ref]
  if (!entry || !Array.isArray(entry.groups) || entry.targetText !== visibleVerseText(targetText)) return null
  const defaultSource = entry.sourceReference || parseReference(ref)
  const rawSource = sourceVerses.get(referenceKey(defaultSource))
  if (!validReference(defaultSource) || (entry.sourceAbsent
    ? rawSource != null || entry.sourceText !== ''
    : entry.sourceText !== rawSource)) return null
  const result = []
  const absentSourceAnchors = new Map(), absentGroupIds = new Set()
  for (const group of entry.groups) {
    // A translated-only verse number may own words from another Greek verse.
    // It cannot fall back to ranges in its nonexistent local source.
    if (entry.sourceAbsent && (!Array.isArray(group.sourceAnchors) || !group.sourceAnchors.length
      || group.sourceAnchors.some(anchor => !validReference(anchor) || referenceKey(anchor) === referenceKey(defaultSource))
      || absentGroupIds.has(group.id))) return null
    const anchors = group.sourceAnchors || (group.sourceRanges || [group.source]).map(range => ({
      ...defaultSource, startOffset: range?.[0], endOffset: range?.[1],
    }))
    const targets = group.targetRanges || [group.target]
    if (!Number.isInteger(group.id) || !Array.isArray(anchors) || !anchors.length || !Array.isArray(targets) || !targets.length) return null
    if (targets.some(range => !validRange(range, targetText.length))) return null
    for (const anchor of anchors) {
      const text = sourceVerses.get(referenceKey(anchor))
      if (!validReference(anchor) || text == null || !validRange([anchor.startOffset, anchor.endOffset], text.length)
        || (anchor.text != null && anchor.text !== text.slice(anchor.startOffset, anchor.endOffset))) return null
      if (entry.sourceAbsent) {
        const key = referenceKey(anchor), range = [anchor.startOffset, anchor.endOffset]
        const owned = absentSourceAnchors.get(key) || []
        if (owned.some(previous => overlaps(previous, range))) return null
        owned.push(range)
        absentSourceAnchors.set(key, owned)
      }
    }
    if (entry.sourceAbsent) absentGroupIds.add(group.id)
    result.push({ anchors, targets, id: group.id, note: group.note })
  }
  return result
}

const entryReferences = (ref, entry) => new Set([
  referenceKey(entry.sourceReference || parseReference(ref)),
  ...entry.groups.flatMap(group => (group.sourceAnchors || []).map(referenceKey)),
])

// Occurrence results use the original witness's reference. The corresponding
// translated words may be in an adjacent (or transposed) translated verse.
export function occurrenceWordAnchors(row, alignment, targetBook, sourceBook) {
  const sourceVerses = mapBook(sourceBook), targetVerses = mapBook(targetBook)
  const rawRef = `${row.chapter}:${row.verse}`
  const contexts = [], matchedSources = new Set(), reasons = new Set()
  if (alignment?.book === row.book && sourceVerses.get(rawRef) === row.text) {
    for (const [ref, entry] of Object.entries(alignment.verses)) {
      if (!entryReferences(ref, entry).has(rawRef)) continue
      const text = targetVerses.get(ref)
      if (text == null) continue
      const groups = checkedAnchorGroups(alignment, ref, sourceVerses, text)
      if (!groups) continue
      const ranges = [], notes = new Set()
      for (const group of groups) {
        const indexes = row.ranges.flatMap((range, index) => group.anchors.some(anchor => referenceKey(anchor) === rawRef
          && overlaps(range, [anchor.startOffset, anchor.endOffset])) ? [index] : [])
        if (!indexes.length) continue
        indexes.forEach(index => matchedSources.add(index))
        ranges.push(...group.targets)
        if (group.note) notes.add(group.note)
      }
      for (const note of entry.review?.sourceNotes || []) {
        const refKey = validReference(note) ? referenceKey(note) : referenceKey(entry.sourceReference || parseReference(ref))
        if (refKey === rawRef && row.ranges.some(range => overlaps(range, [note.startOffset, note.endOffset]))) reasons.add(note.reason)
      }
      if (!ranges.length) continue
      if (entry.review?.note) notes.add(entry.review.note)
      const unique = [...new Map(ranges.map(range => [range.join(':'), range])).values()].sort((a, b) => a[0] - b[0])
      contexts.push({ ...parseReference(ref), text, ranges: unique, phrases: [...new Set(unique.map(range => text.slice(...range)))], notes: [...notes] })
    }
  }
  contexts.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
  const first = contexts.find(context => context.chapter === row.chapter && context.verse === row.verse) || contexts[0]
  return {
    text: first?.text || targetVerses.get(rawRef) || '', ranges: first?.ranges || [],
    phrases: [...new Set(contexts.flatMap(context => context.phrases))],
    missingCount: row.count - matchedSources.size, status: contexts.length ? 'matched' : targetVerses.has(rawRef) ? 'unmapped' : 'missing-verse',
    contexts, reasons: [...reasons],
  }
}

export function chapterWordAnchors({ primaryData, secondaryData, primaryBook, secondaryBook, sourceBook, chapter }) {
  const sourceVerses = mapBook(sourceBook)
  const targetVerses = { primary: mapBook(primaryBook), secondary: mapBook(secondaryBook) }
  const data = { primary: primaryData, secondary: secondaryData }
  const names = { primary: primaryData?.targetId || 'Original', secondary: secondaryData?.targetId || 'Original' }
  const result = { primary: new Map(), secondary: new Map(), lookupPrimary: new Map(), lookupSecondary: new Map(), primaryNotes: new Map(), secondaryNotes: new Map(), primarySourceReferences: new Map(), secondarySourceReferences: new Map(), invalidReferences: [] }
  const relevant = new Set([...sourceVerses.keys()].filter(ref => parseReference(ref).chapter === chapter))
  const eligible = { primary: new Set(), secondary: new Set() }
  // Include an adjacent translated reference when it owns words of the current
  // source chapter. No text is moved or relabeled to manufacture agreement.
  let changed = true
  while (changed) {
    changed = false
    for (const side of ['primary', 'secondary']) for (const [ref, entry] of Object.entries(data[side]?.verses || {})) {
      if (eligible[side].has(ref)) continue
      const refs = entryReferences(ref, entry)
      if (parseReference(ref).chapter !== chapter && ![...refs].some(key => relevant.has(key))) continue
      eligible[side].add(ref)
      for (const key of refs) if (!relevant.has(key)) { relevant.add(key); changed = true }
    }
  }
  const sourceWords = new Map()
  const wordAnchors = new Map()
  for (const ref of relevant) {
    const text = sourceVerses.get(ref)
    if (text == null) continue
    const words = [...text.matchAll(/\S+/g)].map((match, index) => ({
      ...parseReference(ref), startOffset: match.index, endOffset: match.index + match[0].length, text: match[0], index, key: `${ref}:${index}`,
    }))
    sourceWords.set(ref, words)
    for (const word of words) wordAnchors.set(word.key, word)
  }
  const nodes = []
  const addNote = (side, ref, note) => { if (!result[`${side}Notes`].has(ref)) result[`${side}Notes`].set(ref, []); result[`${side}Notes`].get(ref).push(note) }
  for (const side of ['primary', 'secondary']) {
    if (!data[side]) {
      for (const [ref, words] of sourceWords) for (const word of words) nodes.push({ side, ref, targets: [[word.startOffset, word.endOffset]], keys: [word.key] })
      continue
    }
    for (const ref of eligible[side]) {
      const entry = data[side].verses[ref]
      const targetText = targetVerses[side].get(ref) ?? (entry.targetAbsent ? '' : undefined)
      const groups = targetText == null ? null : checkedAnchorGroups(data[side], ref, sourceVerses, targetText)
      if (!groups) { result.invalidReferences.push(`${names[side]} ${ref}`); continue }
      const actualReferences = new Set(groups.flatMap(group => group.anchors.map(referenceKey)))
      for (const note of entry.review?.sourceNotes || []) actualReferences.add(validReference(note) ? referenceKey(note) : referenceKey(entry.sourceReference || parseReference(ref)))
      result[`${side}SourceReferences`].set(ref, [...actualReferences].map(parseReference))
      for (const group of groups) {
        const keys = [...new Set(group.anchors.flatMap(anchor => (sourceWords.get(referenceKey(anchor)) || [])
          .filter(word => overlaps([anchor.startOffset, anchor.endOffset], [word.startOffset, word.endOffset])).map(word => word.key)))]
        if (keys.length) nodes.push({ side, ref, targets: group.targets, keys, notes: [data[side].verses[ref].review?.note, group.note].filter(Boolean) })
      }
      for (const note of entry.review?.targetNotes || []) addNote(side, ref, note)
      const opposite = side === 'primary' ? 'secondary' : 'primary'
      if (!data[opposite]) for (const note of entry.review?.sourceNotes || []) {
        const sourceRef = validReference(note) ? referenceKey(note) : referenceKey(entry.sourceReference || parseReference(ref))
        addNote(opposite, sourceRef, note)
      }
    }
  }
  const parent = nodes.map((_, i) => i)
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  const sourceOwner = new Map(), targetOwner = new Map()
  nodes.forEach((node, i) => {
    for (const key of node.keys) { if (sourceOwner.has(key)) parent[find(i)] = find(sourceOwner.get(key)); else sourceOwner.set(key, i) }
    const text = targetVerses[node.side].get(node.ref) || ''
    for (const match of text.matchAll(/[\p{L}\p{M}]+(?:[’'][\p{L}\p{M}]+)*/gu)) {
      if (!node.targets.some(range => overlaps(range, [match.index, match.index + match[0].length]))) continue
      const key = `${node.side}:${node.ref}:${match.index}`
      if (targetOwner.has(key)) parent[find(i)] = find(targetOwner.get(key)); else targetOwner.set(key, i)
    }
  })
  const components = new Map()
  nodes.forEach((node, i) => { const key = find(i); if (!components.has(key)) components.set(key, []); components.get(key).push(node) })
  for (const component of components.values()) {
    if (!component.some(node => parseReference(node.ref).chapter === chapter)) continue
    const words = [...new Set(component.flatMap(node => node.keys))].map(key => wordAnchors.get(key))
      .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse || a.startOffset - b.startOffset)
    const sourceAnchors = words.map(({ key, index, ...anchor }) => anchor)
    const first = words[0], id = `${first.chapter}:${first.verse}:${first.index}`, pattern = first.index % 6
    const sourceRanges = sourceAnchors.filter(anchor => referenceKey(anchor) === referenceKey(first)).map(anchor => [anchor.startOffset, anchor.endOffset])
    const sourceRange = [sourceRanges[0][0], Math.max(...sourceRanges.map(range => range[1]))]
    const references = [...new Set(component.map(node => node.ref))]
    const crossReference = references.length > 1 || sourceAnchors.some(anchor => referenceKey(anchor) !== references[0])
    const uniqueTargets = side => [...new Map(component.filter(node => node.side === side).flatMap(node => node.targets.map(range => [`${node.ref}:${range}`, { ref: node.ref, range }]))).values()]
      .sort((a, b) => parseReference(a.ref).chapter - parseReference(b.ref).chapter || parseReference(a.ref).verse - parseReference(b.ref).verse || a.range[0] - b.range[0])
    const phrases = side => uniqueTargets(side).map(({ ref, range }) => `${crossReference ? `${ref} ` : ''}${targetVerses[side].get(ref).slice(...range)}`).join(' … ')
    const sourceLabel = `${crossReference ? `Greek ${[...new Set(sourceAnchors.map(referenceKey))].join(', ')}: ` : ''}${words.map(word => word.text).join(' ')}`
    const translatedSides = ['primary', 'secondary'].filter(side => data[side])
    const label = translatedSides.length === 1
      ? `${sourceLabel} ↔ ${crossReference ? `${names[translatedSides[0]]} ` : ''}${phrases(translatedSides[0])}`
      : `${sourceLabel} ↔ ${translatedSides.map(side => `${names[side]}: ${phrases(side)}`).join(' ↔ ')}`
    const paired = component.some(node => node.side === 'primary') && component.some(node => node.side === 'secondary')
    const notes = [...new Set(component.flatMap(node => node.notes || []))]
    const counterparts = [...new Map(component.map(node => [`${node.side}:${node.ref}`, {
      translationId: data[node.side]?.targetId || 'ORIGINAL', ...parseReference(node.ref),
    }])).values()]
    const common = { id, pattern, sourceRange, sourceRanges, sourceAnchors, label, notes, counterparts }
    for (const side of ['primary', 'secondary']) for (const { ref, range } of uniqueTargets(side)) {
      // Another translation may express several source words as one phrase.
      // Its shared color must not replace this word's more precise lemma link.
      const studyKeys = [...new Set(component.filter(node => node.side === side && node.ref === ref
        && node.targets.some(target => overlaps(target, range))).flatMap(node => node.keys))]
      const studySourceAnchors = studyKeys.map(key => wordAnchors.get(key))
        .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse || a.startOffset - b.startOffset)
        .map(({ key, index, ...anchor }) => anchor)
      const link = { ...common, studySourceAnchors, startOffset: range[0], endOffset: range[1] }
      const lookup = result[side === 'primary' ? 'lookupPrimary' : 'lookupSecondary']
      if (!lookup.has(ref)) lookup.set(ref, [])
      lookup.get(ref).push(link)
      if (!paired) continue
      if (!result[side].has(ref)) result[side].set(ref, [])
      result[side].get(ref).push(link)
    }
  }
  return assignWordLinkColors(result)
}

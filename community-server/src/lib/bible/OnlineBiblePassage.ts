import { parse, parseFragment } from 'parse5'
import { BibleImportError } from '../../../packages/bible-import/index.js'
import { CANONICAL_BIBLE_BOOKS, canonicalBibleChapterVerseMaximum, resolveBookId, type CanonicalBibleRange } from '../syncshow/BibleRange'
import { onlineBibleSource } from './OnlineBibleSources'

type HtmlNode = { nodeName: string; tagName?: string; value?: string; attrs?: {name: string; value: string}[]; childNodes?: HtmlNode[] }
type FetchLike = typeof globalThis.fetch
type Verse = { number: number; text: string }
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const attr = (node: HtmlNode, name: string) => node.attrs?.find(a => a.name === name)?.value
const hasClass = (node: HtmlNode, name: string) => (attr(node, 'class') || '').split(/\s+/).includes(name)
const children = (node: HtmlNode) => node.childNodes || []
function findAll(node: HtmlNode, predicate: (n: HtmlNode) => boolean): HtmlNode[] {
  return [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => findAll(child, predicate))]
}
const invalid = () => new BibleImportError('INVALID_BIBLE_SOURCE', 'The online Bible source returned incomplete or unexpected text. No slides were added. Try again later.', 502)
const normalizeText = (text: string) => text.replace(/[\s\u00a0]+/g, ' ').trim()
function plainText(node: HtmlNode): string {
  if (['script','style','aside'].includes(node.tagName || '') || hasClass(node,'note') || hasClass(node,'vn') || attr(node,'rel') === 'popup') return ''
  const text = node.nodeName === '#text' ? node.value || '' : children(node).map(plainText).join('')
  const styled = /font-variant\s*:\s*small-caps|text-transform\s*:\s*uppercase/i.test(attr(node,'style') || '') ? text.toUpperCase() : text
  return styled + (['p','div','br'].includes(node.tagName || '') || hasClass(node,'ln') ? ' ' : '')
}
function verifyVerses(verses: Verse[], expected: number[]) {
  if (verses.length !== expected.length || verses.some((v,i) => v.number !== expected[i] || !v.text || v.text.length > 4000 || /(?:…|\.{3})\s*$/.test(v.text))) throw invalid()
  return verses
}

export function parseLsbPassage(html: string, range: CanonicalBibleRange, expected: number[], reference: string): Verse[] {
  const scripts = findAll(parse(html), n => n.tagName === 'script' && attr(n,'id') === '__NEXT_DATA__' && attr(n,'type') === 'application/json')
  if (scripts.length !== 1) throw invalid()
  let props: { found?: boolean; query?: string; html?: string }
  try {
    const data = JSON.parse(children(scripts[0]).map(n => n.value || '').join(''))
    if (data.page !== '/ref-tagger') throw invalid()
    props = data.props.pageProps
  } catch { throw invalid() }
  if (!props?.found || props.query !== reference || typeof props.html !== 'string') throw invalid()
  const book = CANONICAL_BIBLE_BOOKS.find(b => b.id === range.bookId)!
  const nodes = findAll(parseFragment(props.html), n => hasClass(n,'v') && Boolean(attr(n,'data-ref')))
  const verses = nodes.map(node => {
    const match = attr(node,'data-ref')!.match(/^(\d+)\.(\d+)\.(\d+)$/)
    if (!match || Number(match[1]) !== book.order || Number(match[2]) !== range.start.chapter) throw invalid()
    return { number: Number(match[3]), text: normalizeText(plainText(node)) }
  })
  return verifyVerses(verses, expected)
}

export function parseNasbPassage(html: string, range: CanonicalBibleRange, expected: number[]): Verse[] {
  const roots = findAll(parse(html), n => hasClass(n,'resourcetext'))
    .filter(n => findAll(n, child => attr(child,'rel') === 'milestone' && attr(child,'data-datatype') === 'bible+nasb95').length)
  if (roots.length !== 1) throw invalid()
  const verses: Verse[] = []
  let active: Verse | undefined
  let awaitingNumber = true
  function visit(node: HtmlNode) {
    if (['script','style','aside'].includes(node.tagName || '') || attr(node,'rel') === 'popup') return
    if (attr(node,'rel') === 'milestone') {
      const match = (attr(node,'data-reference') || '').match(/^(.+?)\s+(\d+):(\d+)$/)
      if (attr(node,'data-datatype') !== 'bible+nasb95' || !match || resolveBookId(match[1] === 'Psalm' ? 'Psalms' : match[1]) !== range.bookId || Number(match[2]) !== range.start.chapter) throw invalid()
      active = {number: Number(match[3]), text: ''}; awaitingNumber = true; verses.push(active); return
    }
    if (active && awaitingNumber && node.tagName === 'span'
      && normalizeText(plainText(node)) === String(active.number)) { awaitingNumber = false; return }
    if (awaitingNumber) {
      children(node).forEach(visit)
      if (active && !awaitingNumber && ['p','div','br'].includes(node.tagName || '')) active.text += ' '
      return
    }
    if (node.nodeName === '#text') { if (active) active.text += node.value || ''; return }
    // Inline small caps carry meaning (LORD); the source marks footnote links separately.
    if (/font-variant\s*:\s*small-caps|text-transform\s*:\s*uppercase/i.test(attr(node,'style') || '')) {
      if (active) active.text += plainText(node); return
    }
    children(node).forEach(visit)
    if (active && ['p','div','br'].includes(node.tagName || '')) active.text += ' '
  }
  visit(roots[0])
  for (const verse of verses) {
    verse.text = normalizeText(verse.text)
  }
  return verifyVerses(verses, expected)
}

async function fetchHtml(url: URL, fetchImpl: FetchLike, signal: AbortSignal) {
  let response: Response
  try {
    let target = url
    for (let attempt = 0; ; attempt++) {
      response = await fetchImpl(target, {redirect: 'manual', cache: 'no-store', signal, headers: {Accept: 'text/html'}})
      if (![301,302,303,307,308].includes(response.status)) break
      const location = response.headers.get('location')
      if (!location || attempt === 3) throw invalid()
      const next = new URL(location,target)
      if (next.origin !== url.origin || next.username || next.password) throw invalid()
      await response.body?.cancel()
      target = next
    }
  }
  catch { throw new BibleImportError('BIBLE_LOOKUP_UNAVAILABLE', 'The online Bible source could not be reached. Your existing slides are unchanged.', 503) }
  if (!response.ok) throw new BibleImportError('BIBLE_LOOKUP_UNAVAILABLE', 'The online Bible source is temporarily unavailable. Your existing slides are unchanged.', 503)
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES || !response.body) throw invalid()
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break
      size += value.byteLength
      if (size > MAX_RESPONSE_BYTES) throw invalid()
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    if (error instanceof BibleImportError) throw error
    throw new BibleImportError('BIBLE_LOOKUP_UNAVAILABLE', 'The online Bible response was interrupted. Your existing slides are unchanged.', 503)
  }
  finally { reader.releaseLock() }
  return Buffer.concat(chunks).toString('utf8')
}

export async function onlineBiblePassage(id: string, range: CanonicalBibleRange, verseNumbers?: number[], fetchImpl: FetchLike = globalThis.fetch) {
  const source = onlineBibleSource(id)
  if (!source) throw new BibleImportError('BIBLE_NOT_INSTALLED','Choose an available Bible edition.',404)
  const book = CANONICAL_BIBLE_BOOKS.find(b => b.id === range.bookId)
  const expected = verseNumbers || Array.from({length: range.end.verse! - range.start.verse! + 1},(_,i) => range.start.verse! + i)
  if (!book || !expected.length || expected.length > 200 || (book.chapters === 1 && expected.length === canonicalBibleChapterVerseMaximum(book.id,1))) {
    throw new BibleImportError('INVALID_BIBLE_RANGE','Online lookup is for selected passages. Choose fewer verses or use an installed edition for a complete book.')
  }
  const groups: number[][] = []
  for (const n of expected) {
    const last = groups.at(-1)
    if (last && last.at(-1)! + 1 === n) last.push(n); else groups.push([n])
  }
  const label = (numbers: number[]) => `${numbers[0]}${numbers.length > 1 ? `-${numbers.at(-1)}` : ''}`
  const reference = `${book.name} ${range.start.chapter}:${groups.map(label).join(',')}`
  const signal = AbortSignal.timeout(15_000)
  const lsbUrl = new URL('https://read.lsbible.org/ref-tagger'); lsbUrl.searchParams.set('ref',reference)
  let verses: Verse[]
  if (id === 'LSB') verses = parseLsbPassage(await fetchHtml(lsbUrl,fetchImpl,signal),range,expected,reference)
  else {
    verses = []
    // RefTagger silently truncates both ranges and long individual verses. Use its full reader pages.
    for (const group of groups) {
      const ref = `${book.name} ${range.start.chapter}:${label(group)}`
      const url = new URL(`https://biblia.com/bible/nasb95/${encodeURIComponent(ref)}`)
      verses.push(...parseNasbPassage(await fetchHtml(url,fetchImpl,signal),range,group))
    }
  }
  return {
    passage: { reference, translationId: id, attribution: id === 'LSB' ? '(LSB)' : '(NASB 1995)', verses },
    sourceUrl: id === 'LSB' ? lsbUrl.toString() : `https://biblia.com/bible/nasb95/${encodeURIComponent(reference)}`,
  }
}

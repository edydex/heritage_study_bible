import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sources = [
  ['fairest-lord-jesus', 'https://www.hymnstogod.org/Hymns-PD/F-Hymns/Fairest-Lord-Jesus.html'],
  ['i-surrender-all', 'https://www.hymnstogod.org/Hymns-PD/I-Hymns/I-Surrender-All.html'],
  ['nothing-but-the-blood', 'https://www.hymnstogod.org/Hymns-PD/N-Hymns/Nothing-But-The-Blood-Of-Jesus.html'],
  ['rock-of-ages', 'https://hymnstogod.org/Hymns-PD/R-Hymns/Rock-Of-Ages.html'],
  ['what-a-friend', 'https://www.hymnstogod.org/Hymns-PD/W-Hymns/What-A-Friend-We-Have-In-Jesus.html'],
]

const hymnarySources = [
  ['before-the-throne', 'https://hymnary.org/text/before_the_throne_of_god_above_i_have_a_'],
  ['come-thou-fount', 'https://hymnary.org/text/come_thou_fount_of_every_blessing'],
  ['give-me-jesus', 'https://hymnary.org/hymn/LUYH2013/423'],
  ['he-will-hold-me-fast', 'https://hymnary.org/hymn/CYBER/2678'],
  ['i-know-my-redeemer-lives', 'https://hymnary.org/hymn/VoP1873/683'],
  ['it-is-well', 'https://hymnary.org/text/when_peace_like_a_river_attendeth_my_way'],
  ['just-as-i-am', 'https://hymnary.org/hymn/HRGC1892/606a'],
  ['o-come-all-ye-faithful', 'https://hymnary.org/hymn/HAGA1895/170'],
  ['o-come-o-come-emmanuel', 'https://hymnary.org/hymn/HPAG1933/108'],
  ['o-my-soul-arise', 'https://hymnary.org/text/arise_my_soul_arise_shake_off_thy_guilty'],
  ['turn-your-eyes', 'https://hymnary.org/hymn/CYBER/6968'],
]

function decodeHtml(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '…',
    ldquo: '“',
    lsquo: '‘',
    lt: '<',
    mdash: '—',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
    rdquo: '”',
    rsquo: '’',
  }
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match
    const numeric = entity[1].toLowerCase() === 'x'
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10)
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : match
  })
}

function extractSections(html, url) {
  const lyrics = html.match(/<div\s+ID="Lyrics"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
  if (!lyrics) throw new Error(`${url} does not contain the expected Lyrics block.`)
  // Split on opening paragraph tags rather than requiring valid closing tags.
  // A few source pages omit a </p>, which would otherwise merge two verses.
  const paragraphs = lyrics.split(/<p[^>]*>/gi)
    .slice(1)
    .map(fragment => decodeHtml(fragment.split(/<\/p>/i)[0]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, ''))
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n'))
    .filter(Boolean)
  // The page begins with a repeated title and author. Remaining paragraphs are
  // the public-domain stanzas and, where present, a labeled refrain.
  const body = paragraphs.slice(2)
  if (!body.length) throw new Error(`${url} did not yield any stanzas.`)

  const sections = []
  let verse = 0
  for (let index = 0; index < body.length; index += 1) {
    const explicitLabel = body[index].match(/^(chorus|refrain):?$/i)?.[1]
    if (explicitLabel && body[index + 1]) {
      sections.push({
        label: explicitLabel[0].toUpperCase() + explicitLabel.slice(1),
        lines: body[index + 1].split('\n'),
      })
      index += 1
      continue
    }

    verse += 1
    sections.push({
      label: `Verse ${verse}`,
      lines: body[index].split('\n'),
    })
  }
  return sections
}

function plainMarkdown(value) {
  return decodeHtml(value)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s*\[Refrain\]\s*$/i, '')
    .replace(/\\([\\*_`[\]])/g, '$1')
    .trim()
}

function extractHymnarySections(markdown, url) {
  const contentStart = markdown.search(/\n1(?:\.|\s)\s*/)
  const endMarkers = [
    '| Text Information |',
    '\n## Text Information',
    '\n## Author:',
    '\nSource:',
    '\nsee more',
    '\n### Scripture References',
    '\n[](',
  ]
  const contentEnd = Math.min(...endMarkers
    .map(marker => markdown.indexOf(marker, contentStart))
    .filter(index => index > contentStart))
  if (contentStart < 0 || !Number.isFinite(contentEnd)) {
    throw new Error(`${url} does not contain the expected numbered full-text block.`)
  }

  const sections = []
  let current
  const addSection = (label, firstLine = '') => {
    current = { label, lines: [] }
    if (firstLine) current.lines.push(plainMarkdown(firstLine))
    sections.push(current)
  }

  markdown.slice(contentStart, contentEnd).split('\n').forEach(rawLine => {
    const line = plainMarkdown(rawLine)
    if (!line || line.startsWith('[](')) return
    const verse = line.match(/^(\d+)\.?\s+(.+)$/)
    if (verse) {
      addSection(`Verse ${verse[1]}`, verse[2])
      return
    }
    if (/^refrain:?$/i.test(line)) {
      addSection('Refrain')
      return
    }
    if (current) current.lines.push(line)
  })

  const cleaned = sections.filter(item => item.lines.length)
  if (!cleaned.length) throw new Error(`${url} did not yield any lyric sections.`)
  return cleaned
}

const imported = {}
for (const [id, url] of sources) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`)
  imported[id] = {
    textSourceUrl: url,
    retrievedAt: new Date().toISOString().slice(0, 10),
    sections: extractSections(await response.text(), url),
  }
}

for (const [id, url] of hymnarySources) {
  const response = await fetch(`https://r.jina.ai/${url}`, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status} through the text mirror.`)
  imported[id] = {
    textSourceUrl: url,
    retrievedAt: new Date().toISOString().slice(0, 10),
    sections: extractHymnarySections(await response.text(), url),
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destination = path.join(root, 'src/data/publicDomainHymns.generated.js')
const output = `// Generated by scripts/importPublicDomainHymns.mjs from pages marked Public Domain - USA.\n// Review the source list and generated diff before committing.\nexport const PUBLIC_DOMAIN_HYMN_TEXTS = ${JSON.stringify(imported, null, 2)}\n`
await fs.writeFile(destination, output)
console.log(`Imported ${Object.keys(imported).length} public-domain hymn texts into ${path.relative(root, destination)}.`)

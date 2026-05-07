#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const inputPath = process.argv[2]
const outputPath = process.argv[3] || path.join(__dirname, '..', 'public', 'data', 'books', 'martyrdom-of-polycarp.txt')

if (!inputPath) {
  console.error('Usage: node scripts/import-polycarp-wikisource.cjs <wikisource-html> [output-txt]')
  process.exit(1)
}

const html = fs.readFileSync(inputPath, 'utf8')

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#(x?[0-9A-Fa-f]+);/g, (_, n) => {
      const codePoint = n[0].toLowerCase() === 'x'
        ? Number.parseInt(n.slice(1), 16)
        : Number.parseInt(n, 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _
    })
    .replace(/&nbsp;|&#160;|&#32;|&#8199;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&AElig;/g, 'AE')
    .replace(/&aelig;/g, 'ae')
}

function stripTags(value) {
  let html = String(value || '')
    .replace(/<sup[^>]*class="reference"[^>]*>[\s\S]*?<\/sup>/gi, (sup) => {
      const plain = decodeEntities(sup.replace(/<[^>]+>/g, ''))
      const marker = plain.match(/\[(\d+)\]/) || plain.match(/\b(\d+)\b/)
      return marker ? `[${marker[1]}]` : ''
    })

  return decodeEntities(html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<span[^>]*class="pagenum[\s\S]*?<\/span><\/span><\/span>/gi, '')
    .replace(/<span[^>]*class="pagenum[\s\S]*?<\/span>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim())
}

function romanToNumber(value) {
  const numerals = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }
  let total = 0
  const roman = String(value || '').toLowerCase()
  for (let i = 0; i < roman.length; i += 1) {
    const current = numerals[roman[i]] || 0
    const next = numerals[roman[i + 1]] || 0
    total += current < next ? -current : current
  }
  return total
}

const bodyStart = html.indexOf('THE MARTYRDOM OF POLYCARP.')
const footnoteStart = html.indexOf('<style data-mw-deduplicate="TemplateStyles:r14922110"')

if (bodyStart < 0 || footnoteStart < 0 || footnoteStart <= bodyStart) {
  console.error('Could not locate Wikisource body/footnotes in source HTML.')
  process.exit(1)
}

const bodyHtml = html.slice(bodyStart, footnoteStart)
const paragraphHtml = [...bodyHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => match[1])

const blocks = [
  'The Martyrdom of Polycarp',
  'Introduction',
]

for (const paragraph of paragraphHtml) {
  if (/font-size:144%/.test(paragraph)) continue

  const chapterMatch = paragraph.match(/Chap\.\s*([ivxlcdm]+)\.?<\/span>\s*(?:—|&mdash;|-)?\s*<i>([\s\S]*?)<\/i>/i)
  if (chapterMatch) {
    blocks.push(`Chapter ${romanToNumber(chapterMatch[1])}. ${stripTags(chapterMatch[2])}`)
    continue
  }

  const text = stripTags(paragraph)
    .replace(/^THE /, 'The ')
    .replace(/^HE /, 'The ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\[(\d+)\]\s*([,.;:])/g, '[$1]$2')

  if (text) blocks.push(text)
}

const footnotes = []
const footnoteHtml = html.slice(footnoteStart)
for (const match of footnoteHtml.matchAll(/<li id="cite&#95;note-[^"]*?(\d+)"[\s\S]*?<span class="reference-text">([\s\S]*?)<\/span>[\s\S]*?<\/li>/gi)) {
  const text = stripTags(match[2]).replace(/\s+([,.;:!?])/g, '$1')
  if (text) footnotes.push(`[${match[1]}] ${text}`)
}

let output = blocks.join('\n\n')
if (footnotes.length) {
  output += `\n\nFootnotes\n\n${footnotes.join('\n\n')}`
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${output.trim()}\n`)
console.log(`Wrote ${outputPath}`)
console.log(`Paragraphs: ${paragraphHtml.length}`)
console.log(`Footnotes: ${footnotes.length}`)

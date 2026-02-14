import { parseBibleReference } from './parseBibleReference.js'

function normalizeRawText(rawText) {
  return String(rawText || '').replace(/\r\n?/g, '\n')
}

function romanToNumber(value) {
  if (!value) return null
  const roman = value.toUpperCase()
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0
  for (let i = 0; i < roman.length; i += 1) {
    const current = map[roman[i]]
    const next = map[roman[i + 1]]
    if (!current) return null
    if (next && current < next) total -= current
    else total += current
  }
  return total
}

export function extractBookFootnotes(rawText) {
  const lines = normalizeRawText(rawText).split('\n')
  const map = {}
  let currentId = null
  let currentLines = []

  const flush = () => {
    if (!currentId) return
    const text = currentLines.join(' ').replace(/\s+/g, ' ').trim()
    if (text) map[currentId] = text
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const marker = trimmed.match(/^\[(\d+)\]\s*(.*)$/)
    if (marker) {
      flush()
      currentId = marker[1]
      currentLines = marker[2] ? [marker[2]] : []
      continue
    }

    if (!currentId) continue
    if (!trimmed) {
      flush()
      currentId = null
      currentLines = []
      continue
    }
    currentLines.push(trimmed)
  }

  flush()
  return map
}

export function parseBibleRefFromFootnote(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  // Handles common Gutenberg forms like:
  // "Luke i. 33." / "1 Cor. xiii. 12." / "Ps. cxvi. 10."
  const match = normalized.match(/^([1-3]?\s*[A-Za-z][A-Za-z.\s'-]{0,64}?)\s+([ivxlcdm]+|\d+)\s*[\.:]\s*(\d+)\b/i)
  if (!match) return null

  const bookPart = match[1].replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
  const chapterToken = match[2]
  const verse = Number(match[3])

  const chapter = /^\d+$/.test(chapterToken)
    ? Number(chapterToken)
    : romanToNumber(chapterToken)

  if (!bookPart || !chapter || !verse) return null

  return parseBibleReference(`${bookPart} ${chapter}:${verse}`)
}

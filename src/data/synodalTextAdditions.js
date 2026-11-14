import additions from './synodalTextAdditions.json'

export const synodalAdditionNote = 'Проверенное разночтение: эти слова есть в Синодальном переводе и отсутствуют в греческом издании Нестле 1904.'

export function synodalAdditionRanges(translationId, book, chapter, verse, text) {
  if (translationId !== 'SYNO-W') return []
  const entry = additions[`${book} ${chapter}:${verse}`]
  return entry && entry.text === text ? entry.ranges : []
}

export function bracketSynodalAdditions(translationId, book, chapter, verse, text) {
  const ranges = synodalAdditionRanges(translationId, book, chapter, verse, text)
  if (!ranges.length) return text
  let cursor = 0
  let result = ''
  for (const [start, end] of ranges) {
    result += text.slice(cursor, start) + '[[' + text.slice(start, end) + ']]'
    cursor = end
  }
  return result + text.slice(cursor)
}

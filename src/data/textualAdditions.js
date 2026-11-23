import synodalAdditions from './synodalTextAdditions.json'
import ukrainianAdditions from './ukrkTextAdditions.json'
import { translationDisplayText } from '../utils/translationDisplay.js'

const additionsByTranslation = { 'SYNO-W': synodalAdditions, UKRK: ukrainianAdditions }

export const textualAdditionLabels = {
  'SYNO-W': { lang: 'ru', note: 'Проверенное разночтение: эти слова есть в Синодальном переводе и отсутствуют в греческом издании Нестле 1904.' },
  UKRK: { lang: 'uk', note: 'Ці слова є в перекладі Куліша й Пулюя. У грецькому виданні Нестле 1904 року вони відсутні.' },
}

export function textualAdditionRanges(translationId, book, chapter, verse, text) {
  const entry = additionsByTranslation[translationId]?.[`${book} ${chapter}:${verse}`]
  // The offsets refer to the unmodified edition wording.
  return entry && entry.text === text ? entry.ranges : []
}

export function bracketTextualAdditions(translationId, book, chapter, verse, text) {
  const ranges = textualAdditionRanges(translationId, book, chapter, verse, text)
  const display = translationDisplayText(translationId, text)
  if (!ranges.length) return display
  let cursor = 0
  let result = ''
  for (const [start, end] of ranges) {
    result += display.slice(cursor, start) + '[[' + display.slice(start, end) + ']]'
    cursor = end
  }
  return result + display.slice(cursor)
}

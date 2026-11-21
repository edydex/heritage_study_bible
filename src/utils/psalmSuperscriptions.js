import psalmSuperscriptions from '../data/psalm-superscriptions.json'
import localizedSuperscriptions from '../data/psalm-superscriptions-localized.json'

const WEB_LEADING_SUPERSCRIPTION_PATTERN = /^<b>.*?<\/b>\s*/

function isPsalms(bookName) {
  return bookName === 'Psalms'
}

export function getPsalmSuperscription(chapterNumber) {
  return psalmSuperscriptions[String(chapterNumber)]?.text || ''
}

export function hasPsalmSuperscription(bookName, chapterNumber) {
  return isPsalms(bookName) && Boolean(getPsalmSuperscription(chapterNumber))
}

export function isPsalmSuperscriptionReference(bookName, chapterNumber, verseNumber) {
  return Number(verseNumber) === 0 && hasPsalmSuperscription(bookName, chapterNumber)
}

function stripTranslationPrefix(text, chapterNumber, translationId) {
  let nextText = String(text || '')

  if (!translationId || translationId === 'WEB') {
    nextText = nextText.replace(WEB_LEADING_SUPERSCRIPTION_PATTERN, '')
  }

  const translationPrefix = psalmSuperscriptions[String(chapterNumber)]?.stripPrefixes?.[translationId]
  if (translationPrefix && nextText.startsWith(translationPrefix)) {
    nextText = nextText.slice(translationPrefix.length)
  }

  return nextText.trimStart()
}

function withLocalizedSuperscription(chapter, entry) {
  if (!entry || !chapter.verses?.length || chapter.verses.some(verse => verse.number === 0)) return chapter

  const removals = new Map((entry.remove || []).map(part => [part.number, part]))
  for (const part of removals.values()) {
    const verse = chapter.verses.find(row => row.number === part.number)
    if (!verse || (part.whole ? verse.text !== part.text : !verse.text.startsWith(part.text))) {
      return chapter
    }
  }

  const verses = chapter.verses.flatMap(verse => {
    const part = removals.get(verse.number)
    if (part?.whole) return []
    return [{
      ...verse,
      ...(part ? { text: verse.text.slice(part.text.length) } : {}),
      ...(entry.parallelOffset ? { parallelNumber: verse.number + entry.parallelOffset } : {}),
      ...(entry.combinedWithPrevious === verse.number
        ? { combinedWithPrevious: true, numberLabel: `${verse.number - 1}–${verse.number}` } : {}),
    }]
  })
  return {
    ...chapter,
    verses: [{ number: 0, text: entry.text, isSuperscription: true }, ...verses],
  }
}

export function psalmComparisonVerseNumber(book, chapter, verse, fromTranslation, toTranslation) {
  if (!isPsalms(book) || verse == null || verse === 0) return verse
  const fromOffset = localizedSuperscriptions[fromTranslation]?.[chapter]?.parallelOffset || 0
  const toOffset = localizedSuperscriptions[toTranslation]?.[chapter]?.parallelOffset || 0
  return verse + fromOffset - toOffset
}

export function withPsalmSuperscriptionVerse(chapter, bookName, translationId) {
  if (!chapter || !isPsalms(bookName) || translationId === 'ORIGINAL') return chapter

  const localized = localizedSuperscriptions[translationId]
  if (localized) return withLocalizedSuperscription(chapter, localized[chapter.number])

  const text = getPsalmSuperscription(chapter.number)
  if (!text) return chapter

  const verses = (chapter.verses || [])
    .filter(verse => verse.number !== 0)
    .map(verse => {
      if (verse.number !== 1) return verse
      return {
        ...verse,
        text: stripTranslationPrefix(verse.text, chapter.number, translationId),
      }
    })

  return {
    ...chapter,
    verses: [
      {
        number: 0,
        text,
        isSuperscription: true,
      },
      ...verses,
    ],
  }
}

export function getVerseTextWithPsalmSuperscription(bibleData, bookName, chapterNumber, verseNumber, translationId) {
  const chapter = bibleData?.books
    ?.find(book => book.name === bookName)
    ?.chapters?.find(row => row.number === chapterNumber)

  return withPsalmSuperscriptionVerse(chapter, bookName, translationId)
    ?.verses?.find(row => row.number === verseNumber)
    ?.text || ''
}

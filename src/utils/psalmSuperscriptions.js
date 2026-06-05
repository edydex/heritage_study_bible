import psalmSuperscriptions from '../data/psalm-superscriptions.json'

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

export function withPsalmSuperscriptionVerse(chapter, bookName, translationId) {
  if (!chapter || !isPsalms(bookName)) return chapter

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

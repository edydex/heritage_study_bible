import { localizeBookName } from './localizedBookNames.js'

export function isSameVerse(left, right) {
  if (!left || !right) return false
  return (left.book || '') === (right.book || '')
    && Number(left.chapter) === Number(right.chapter)
    && Number(left.verse) === Number(right.verse)
}

export function toggleVerseInSelection(verses, clickedVerse) {
  const current = Array.isArray(verses) ? verses : []
  if (!clickedVerse) return current

  if (current.some(item => isSameVerse(item, clickedVerse))) {
    return current.filter(item => !isSameVerse(item, clickedVerse))
  }

  return [...current, clickedVerse]
}

function buildContiguousRanges(verses) {
  if (!Array.isArray(verses) || verses.length === 0) return []
  const sorted = [...verses].sort((a, b) => a.verse - b.verse)
  const ranges = []
  let current = [sorted[0]]

  for (let index = 1; index < sorted.length; index += 1) {
    const item = sorted[index]
    const previous = current[current.length - 1]
    if (item.verse === previous.verse + 1) {
      current.push(item)
    } else {
      ranges.push(current)
      current = [item]
    }
  }
  ranges.push(current)
  return ranges
}

function getVerseTextFromData(data, book, chapter, verse) {
  return data?.books
    ?.find(item => item.name === book)
    ?.chapters?.find(item => item.number === chapter)
    ?.verses?.find(item => item.number === verse)
    ?.text || ''
}

export function formatVersesForCopy({
  verses,
  fallbackBookName,
  primaryTranslationId,
  primaryBibleData,
  secondaryTranslationId,
  secondaryBibleData,
  includeParallel = false,
  verseTextResolver = getVerseTextFromData,
}) {
  if (!Array.isArray(verses) || verses.length === 0) return ''

  const byChapter = new Map()
  verses.forEach(item => {
    const book = item.book || fallbackBookName
    const key = `${book}|||${item.chapter}`
    if (!byChapter.has(key)) byChapter.set(key, [])
    byChapter.get(key).push(item)
  })

  const sections = []
  for (const [key, group] of byChapter.entries()) {
    const [book, chapterRaw] = key.split('|||')
    const chapter = Number(chapterRaw)
    const ranges = buildContiguousRanges(group)

    for (const range of ranges) {
      const startVerse = range[0].verse
      const endVerse = range[range.length - 1].verse
      const primaryBookName = localizeBookName(book, primaryTranslationId)
      const primaryReference = startVerse === endVerse
        ? `${primaryBookName} ${chapter}:${startVerse}`
        : `${primaryBookName} ${chapter}:${startVerse}-${endVerse}`

      const primaryLines = range.map(item => {
        const itemBook = item.book || fallbackBookName
        const text = item.text || verseTextResolver(
          primaryBibleData,
          itemBook,
          item.chapter,
          item.verse,
          primaryTranslationId
        )
        return `(${item.verse}) ${text || '[Verse unavailable]'}`
      })
      sections.push(`${primaryReference} (${primaryTranslationId}) - ${primaryLines.join('\n')}`)

      if (includeParallel && secondaryTranslationId && secondaryBibleData) {
        const secondaryBookName = localizeBookName(book, secondaryTranslationId)
        const secondaryReference = startVerse === endVerse
          ? `${secondaryBookName} ${chapter}:${startVerse}`
          : `${secondaryBookName} ${chapter}:${startVerse}-${endVerse}`
        const secondaryLines = range.map(item => {
          const itemBook = item.book || fallbackBookName
          const text = verseTextResolver(
            secondaryBibleData,
            itemBook,
            item.chapter,
            item.verse,
            secondaryTranslationId
          )
          return `(${item.verse}) ${text || '[Verse unavailable]'}`
        })
        sections.push(`${secondaryReference} (${secondaryTranslationId}) - ${secondaryLines.join('\n')}`)
      }
    }
  }

  return sections.join('\n\n')
}

export async function writeTextToClipboard(text) {
  let clipboardError = null
  if (globalThis.navigator?.clipboard?.writeText) {
    try {
      await globalThis.navigator.clipboard.writeText(text)
      return
    } catch (error) {
      clipboardError = error
    }
  }

  if (!globalThis.document?.body) throw clipboardError || new Error('Clipboard is unavailable')
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  const copied = document.execCommand?.('copy')
  textarea.remove()
  if (!copied) throw clipboardError || new Error('Clipboard copy failed')
}

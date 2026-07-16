export function getVerseLayout(layout, bookName, chapterNumber, verseNumber) {
  return layout?.[`${bookName}.${chapterNumber}.${verseNumber}`] || null
}

export function splitParagraphText(text) {
  const raw = String(text ?? '')
  const startsParagraph = /^\s*¶\s*/.test(raw)
  const segments = raw
    .replace(/^\s*¶\s*/, '')
    .split(/\s+¶\s+/)

  return {
    startsParagraph,
    segments,
  }
}

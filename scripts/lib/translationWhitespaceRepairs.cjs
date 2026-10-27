/** Apply reviewed spacing corrections without changing the translation wording. */
function applyTranslationWhitespaceRepairs(data, manifest) {
  if (data.translation !== manifest.translation) {
    throw new Error(`Spacing repairs belong to ${manifest.translation}, not ${data.translation}`)
  }
  for (const repair of manifest.repairs) {
    const reference = `${repair.book} ${repair.chapter}:${repair.verse}`
    const verse = data.books.find(book => book.name === repair.book)
      ?.chapters.find(chapter => chapter.number === repair.chapter)
      ?.verses.find(item => item.number === repair.verse)
    if (!verse) throw new Error(`Spacing repair verse missing: ${reference}`)
    if (repair.sourceText.replace(/\s/g, '') !== repair.correctedText.replace(/\s/g, '')) {
      throw new Error(`Spacing repair changes wording: ${reference}`)
    }
    if (verse.text !== repair.sourceText && verse.text !== repair.correctedText) {
      throw new Error(`Spacing repair source changed: ${reference}`)
    }
    verse.text = repair.correctedText
  }
  return data
}

module.exports = { applyTranslationWhitespaceRepairs }

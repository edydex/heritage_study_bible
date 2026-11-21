export const UKRK_DISPLAY_ABBR = 'UKRK-R'

// These source forms use ї for /ji/ or have an omitted historical apostrophe.
// Retain them verbatim so this spelling pass never inserts new characters.
const retainedUkrainianForms = new Set([
  'ззїли', 'ззїсти', 'іззїв', 'ізїв', 'ізїли', 'ізїмо', 'обїсть', 'обїдає',
  'вїздив', 'здоровї', 'поломї', 'полумї', 'рамї', 'семї',
])

export function translationDisplayAbbr(translationId) {
  return translationId === 'UKRK' ? UKRK_DISPLAY_ABBR : translationId
}

export function translationDisplayText(translationId, text) {
  if (translationId !== 'UKRK' || !text || !/[їЇ]/.test(text)) return text

  // Zhelekhivka used ї for the vowel /i/ after a soft consonant.
  // A one-for-one substitution keeps source-backed text offsets intact.
  return text.replace(/[а-яєіїґ\u0301ʼ’']+/giu, word => {
    if (retainedUkrainianForms.has(word.toLowerCase().replace(/\u0301/g, ''))) return word
    return word.replace(/([бвгґджзклмнпрстфхцчшщ]\u0301?)([їЇ])/giu,
      (_, consonant, vowel) => consonant + (vowel === 'Ї' ? 'І' : 'і'))
  })
}

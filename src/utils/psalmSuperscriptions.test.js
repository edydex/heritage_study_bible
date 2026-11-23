import { describe, expect, it } from 'vitest'
import ukrainian from '../../public/data/translations/UKRK/psalms.json'
import russian from '../../public/data/translations/SYNO-W/psalms.json'
import {
  getVerseTextWithPsalmSuperscription,
  getPsalmSuperscription,
  hasPsalmSuperscription,
  isPsalmSuperscriptionReference,
  psalmComparisonVerseNumber,
  withPsalmSuperscriptionVerse,
} from './psalmSuperscriptions'

describe('psalm superscriptions', () => {
  it('loads superscription text for known psalms', () => {
    expect(getPsalmSuperscription(23)).toBe('A Psalm by David.')
  })

  it('detects psalm superscription references only for verse 0', () => {
    expect(hasPsalmSuperscription('Psalms', 23)).toBe(true)
    expect(hasPsalmSuperscription('John', 3)).toBe(false)
    expect(isPsalmSuperscriptionReference('Psalms', 23, 0)).toBe(true)
    expect(isPsalmSuperscriptionReference('Psalms', 23, 1)).toBe(false)
  })

  it('inserts verse 0 and strips duplicate prefixes from verse 1', () => {
    const chapter = {
      number: 23,
      verses: [
        {
          number: 1,
          text: '<b>A Psalm by David.</b> The LORD is my shepherd; I shall not want.',
        },
      ],
    }

    const result = withPsalmSuperscriptionVerse(chapter, 'Psalms', 'WEB')
    expect(result.verses[0]).toMatchObject({ number: 0, isSuperscription: true })
    expect(result.verses[1].text).toBe('The LORD is my shepherd; I shall not want.')
  })

  it('returns the original chapter for non-psalm books', () => {
    const chapter = { number: 3, verses: [{ number: 16, text: 'For God so loved the world.' }] }
    expect(withPsalmSuperscriptionVerse(chapter, 'John', 'WEB')).toBe(chapter)
  })

  it('moves native Ukrainian and Russian titles to Psalm 51:0 exactly once', () => {
    const titleUk = 'Проводиреві хора: Давидова псальма, як прийшов до його пророк Натан, після того, як зійшовся з Бет-Сабою.'
    const titleRu = 'Начальнику хора. Псалом Давида, когда приходил к нему пророк Нафан, после того, как Давид вошел к Вирсавии.'
    const uk = withPsalmSuperscriptionVerse(ukrainian.chapters[50], 'Psalms', 'UKRK')
    const ru = withPsalmSuperscriptionVerse(russian.chapters[50], 'Psalms', 'SYNO-W')

    expect(uk.verses[0]).toMatchObject({ number: 0, text: titleUk })
    expect(uk.verses[1].text).toMatch(/^Помилуй мене, Боже/)
    expect(`${titleUk} ${uk.verses[1].text}`).toBe(ukrainian.chapters[50].verses[0].text)
    expect(ru.verses[0]).toMatchObject({ number: 0, text: titleRu })
    expect(ru.verses.slice(1)).toEqual(russian.chapters[50].verses)
    expect(withPsalmSuperscriptionVerse(uk, 'Psalms', 'UKRK')).toBe(uk)
    expect(getVerseTextWithPsalmSuperscription({ books: [russian] }, 'Psalms', 51, 0, 'SYNO-W')).toBe(titleRu)
  })

  it('only extracts opening titles found in the exact localized source', () => {
    const noTitle = ukrainian.chapters[97]
    expect(withPsalmSuperscriptionVerse(noTitle, 'Psalms', 'UKRK')).toBe(noTitle)
    const changed = { number: 51, verses: [{ number: 1, text: 'Text from another edition.' }] }
    expect(withPsalmSuperscriptionVerse(changed, 'Psalms', 'UKRK')).toBe(changed)
    const mergedNativePsalm = russian.chapters[115]
    const displayed = withPsalmSuperscriptionVerse(mergedNativePsalm, 'Psalms', 'SYNO-W')
    expect(displayed.verses.find(verse => verse.number === 10)).toEqual(mergedNativePsalm.verses[9])
  })

  it('keeps stable body references where the title originally had its own rows', () => {
    const displayUk = withPsalmSuperscriptionVerse(ukrainian.chapters[59], 'Psalms', 'UKRK')
    const displayRu = withPsalmSuperscriptionVerse(russian.chapters[86], 'Psalms', 'SYNO-W')

    expect(displayUk.verses.map(row => row.number)).toEqual([0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(displayUk.verses[1]).toMatchObject({ number: 3, parallelNumber: 1, text: ukrainian.chapters[59].verses[2].text })
    expect(psalmComparisonVerseNumber('Psalms', 60, 3, 'UKRK', 'BSB')).toBe(1)
    expect(psalmComparisonVerseNumber('Psalms', 60, 1, 'BSB', 'UKRK')).toBe(3)
    expect(psalmComparisonVerseNumber('Psalms', 60, 0, 'UKRK', 'BSB')).toBe(0)
    expect(displayRu.verses[1]).toMatchObject({ number: 2, numberLabel: '1–2', text: russian.chapters[86].verses[1].text })
    expect(displayRu.verses.slice(2)).toEqual(russian.chapters[86].verses.slice(2))
  })
})

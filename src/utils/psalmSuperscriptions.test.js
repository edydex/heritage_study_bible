import { describe, expect, it } from 'vitest'
import {
  getPsalmSuperscription,
  hasPsalmSuperscription,
  isPsalmSuperscriptionReference,
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
})

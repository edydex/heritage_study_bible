import { describe, expect, it } from 'vitest'
import {
  bibleBooks,
  getBookByAbbr,
  getBookByName,
  getNewTestament,
  getOldTestament,
} from './bible-books'

describe('bibleBooks metadata', () => {
  it('contains all 66 canonical books', () => {
    expect(bibleBooks).toHaveLength(66)
  })

  it('splits books into 39 OT and 27 NT books', () => {
    expect(getOldTestament()).toHaveLength(39)
    expect(getNewTestament()).toHaveLength(27)
  })

  it('looks up books by name and abbreviation', () => {
    expect(getBookByName('1 Corinthians')?.chapters).toBe(16)
    expect(getBookByAbbr('Ps')?.name).toBe('Psalms')
  })
})

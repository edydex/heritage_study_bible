import { describe, expect, it } from 'vitest'
import { localizeBookName } from './localizedBookNames'

describe('localizeBookName', () => {
  it('returns Russian names for SYNO translations', () => {
    expect(localizeBookName('Genesis', 'SYNO-W')).toBe('Бытие')
    expect(localizeBookName('Psalms', 'SYNO')).toBe('Псалтирь')
  })

  it('returns Ukrainian names for UKRK', () => {
    expect(localizeBookName('John', 'UKRK')).toBe('Івана')
  })

  it('returns the English name for other translation codes', () => {
    expect(localizeBookName('Romans', 'WEB')).toBe('Romans')
    expect(localizeBookName('Romans', 'KJV')).toBe('Romans')
  })

  it('passes through unknown book names', () => {
    expect(localizeBookName('Unknown Book', 'SYNO-W')).toBe('Unknown Book')
  })
})

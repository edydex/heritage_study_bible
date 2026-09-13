import { describe, expect, it } from 'vitest'
import { buildHeritageAppUrl, getNativeRouteFromUrl } from './nativeDeepLinks.js'

describe('native Heritage deep links', () => {
  it('opens an explicit member-only Community song link without changing its content URL', () => {
    const webUrl = 'https://heritage.faith/#/community-song?access=member&server=church-content&url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F42'
    expect(getNativeRouteFromUrl(webUrl)).toBe(
      '/community-song?access=member&server=church-content&url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F42',
    )
    expect(buildHeritageAppUrl(webUrl)).toBe(
      'faith.heritage.app://community-song?access=member&server=church-content&url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F42',
    )
  })

  it('rejects legacy anonymous song routes and member routes carrying extra secrets', () => {
    expect(getNativeRouteFromUrl(
      'https://heritage.faith/#/community-song?url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F42',
    )).toBe('')
    expect(getNativeRouteFromUrl(
      'https://heritage.faith/#/community-song?access=member&server=church-content&url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F42&token=secret',
    )).toBe('')
  })

  it('still rejects unrelated Heritage routes as native app links', () => {
    expect(getNativeRouteFromUrl('https://heritage.faith/#/settings/about')).toBe('')
  })
})

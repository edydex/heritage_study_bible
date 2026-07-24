import { describe, expect, it } from 'vitest'
import { buildHeritageAppUrl, getNativeRouteFromUrl } from './nativeDeepLinks.js'

describe('native Heritage deep links', () => {
  it('opens an unlisted Community song link in the app without changing its content URL', () => {
    const webUrl = 'https://heritage.faith/#/community-song?url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F42'
    expect(getNativeRouteFromUrl(webUrl)).toBe(
      '/community-song?url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F42',
    )
    expect(buildHeritageAppUrl(webUrl)).toBe(
      'faith.heritage.app://community-song?url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F42',
    )
  })

  it('still rejects unrelated Heritage routes as native app links', () => {
    expect(getNativeRouteFromUrl('https://heritage.faith/#/settings/about')).toBe('')
  })
})

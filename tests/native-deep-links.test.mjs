import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHeritageAppUrl, getNativeRouteFromUrl } from '../src/utils/nativeDeepLinks.js'

test('Heritage HTTPS Community callbacks become native HashRouter routes', () => {
  const link = 'https://heritage.faith/#/community/callback?server=https%3A%2F%2Fwotbc.heritage.faith&token=one-time-token'

  assert.equal(
    getNativeRouteFromUrl(link),
    '/community/callback?server=https%3A%2F%2Fwotbc.heritage.faith&token=one-time-token',
  )
  assert.equal(
    buildHeritageAppUrl(link),
    'faith.heritage.app://community/callback?server=https%3A%2F%2Fwotbc.heritage.faith&token=one-time-token',
  )
})

test('custom-scheme Community callbacks route back into Heritage', () => {
  assert.equal(
    getNativeRouteFromUrl('faith.heritage.app://community/callback?server=https%3A%2F%2Fchurch.example&token=abc'),
    '/community/callback?server=https%3A%2F%2Fchurch.example&token=abc',
  )
})

test('existing reading-plan App Links remain supported', () => {
  assert.equal(
    getNativeRouteFromUrl('https://plannotes.heritage.faith/reading-plan-join?plan=chronological-bible&group=church'),
    '/reading-plan-join?plan=chronological-bible&group=church',
  )
})

test('unowned and unrelated URLs are ignored', () => {
  assert.equal(getNativeRouteFromUrl('https://heritage.faith/#/genesis/1'), '')
  assert.equal(getNativeRouteFromUrl('https://heritage.faith.evil.example/#/community/callback?token=abc'), '')
  assert.equal(getNativeRouteFromUrl('javascript:alert(1)'), '')
})

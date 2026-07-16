import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  scaleVolumeScrollDistance,
} from '../src/utils/advancedSettings.js'

test('advanced settings preserve the historical volume page step by default', () => {
  const settings = normalizeAdvancedSettings({})

  assert.equal(settings.volumeScrollDistancePercent, 100)
  assert.equal(scaleVolumeScrollDistance(612, settings.volumeScrollDistancePercent), 612)
})

test('advanced settings migrate older saved values without losing them', () => {
  const settings = normalizeAdvancedSettings({
    eInkLightBackground: true,
    volumeScrollAnimationMs: 90,
  })

  assert.deepEqual(settings, {
    eInkLightBackground: true,
    volumeScrollAnimationMs: 90,
    volumeScrollDistancePercent: DEFAULT_ADVANCED_SETTINGS.volumeScrollDistancePercent,
  })
})

test('volume scroll distance is clamped to the supported percentage range', () => {
  assert.equal(normalizeAdvancedSettings({ volumeScrollDistancePercent: 5 }).volumeScrollDistancePercent, 50)
  assert.equal(normalizeAdvancedSettings({ volumeScrollDistancePercent: 82.6 }).volumeScrollDistancePercent, 83)
  assert.equal(normalizeAdvancedSettings({ volumeScrollDistancePercent: 140 }).volumeScrollDistancePercent, 100)
  assert.equal(scaleVolumeScrollDistance(600, 75), 450)
})

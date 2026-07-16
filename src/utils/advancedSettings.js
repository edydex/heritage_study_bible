export const DEFAULT_VOLUME_SCROLL_ANIMATION_MS = 180
export const MAX_VOLUME_SCROLL_ANIMATION_MS = 600

export const DEFAULT_VOLUME_SCROLL_DISTANCE_PERCENT = 100
export const MIN_VOLUME_SCROLL_DISTANCE_PERCENT = 50
export const MAX_VOLUME_SCROLL_DISTANCE_PERCENT = 100

export const DEFAULT_ADVANCED_SETTINGS = Object.freeze({
  eInkLightBackground: false,
  volumeScrollAnimationMs: DEFAULT_VOLUME_SCROLL_ANIMATION_MS,
  volumeScrollDistancePercent: DEFAULT_VOLUME_SCROLL_DISTANCE_PERCENT,
})

export function clampVolumeScrollAnimationMs(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.max(0, Math.min(MAX_VOLUME_SCROLL_ANIMATION_MS, Math.round(parsed)))
}

export function clampVolumeScrollDistancePercent(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_VOLUME_SCROLL_DISTANCE_PERCENT
  return Math.max(
    MIN_VOLUME_SCROLL_DISTANCE_PERCENT,
    Math.min(MAX_VOLUME_SCROLL_DISTANCE_PERCENT, Math.round(parsed))
  )
}

export function normalizeAdvancedSettings(value) {
  if (!value || typeof value !== 'object') return { ...DEFAULT_ADVANCED_SETTINGS }

  return {
    eInkLightBackground: value.eInkLightBackground === true,
    volumeScrollAnimationMs: value.volumeScrollAnimationMs == null
      ? DEFAULT_ADVANCED_SETTINGS.volumeScrollAnimationMs
      : clampVolumeScrollAnimationMs(value.volumeScrollAnimationMs),
    volumeScrollDistancePercent: value.volumeScrollDistancePercent == null
      ? DEFAULT_ADVANCED_SETTINGS.volumeScrollDistancePercent
      : clampVolumeScrollDistancePercent(value.volumeScrollDistancePercent),
  }
}

export function scaleVolumeScrollDistance(distance, percent) {
  const baseDistance = Math.max(0, Number(distance) || 0)
  const normalizedPercent = clampVolumeScrollDistancePercent(percent)
  return Math.round(baseDistance * normalizedPercent / 100)
}

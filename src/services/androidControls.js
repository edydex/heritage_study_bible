import { Capacitor, registerPlugin } from '@capacitor/core'

const HeritageControls = registerPlugin('HeritageControls')

export function isNativeAndroid() {
  return Capacitor.getPlatform?.() === 'android'
}

export async function setNativeSideButtonScrollEnabled(enabled) {
  if (!isNativeAndroid()) return false
  try {
    await HeritageControls.setSideButtonScrollEnabled({ enabled: Boolean(enabled) })
    return true
  } catch (error) {
    console.warn('Heritage native controls are not available yet', error)
    return false
  }
}

export async function exitNativeApp() {
  if (!isNativeAndroid()) return false
  try {
    await HeritageControls.exitApp()
    return true
  } catch (error) {
    console.warn('Heritage native exit is not available yet', error)
    return false
  }
}

function parseNativeScrollDirection(event) {
  const candidates = [event?.detail, event?.data, event]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (candidate.direction === 'up' || candidate.direction === 'down') return candidate.direction

    if (typeof candidate === 'string') {
      try {
        const parsed = JSON.parse(candidate)
        if (parsed.direction === 'up' || parsed.direction === 'down') return parsed.direction
      } catch {
        // Some Capacitor dispatch paths pass JSON strings, others pass CustomEvent.detail.
      }
    }
  }

  return 'down'
}

export function addNativeScrollListener(callback) {
  const handler = event => {
    const detail = event?.detail || event?.data || {}
    callback(parseNativeScrollDirection(event), detail)
  }
  window.addEventListener('heritage:native-scroll', handler)
  return () => window.removeEventListener('heritage:native-scroll', handler)
}

export function addNativeBackListener(callback) {
  const handler = event => callback(event)
  window.addEventListener('heritage:native-back', handler)
  return () => window.removeEventListener('heritage:native-back', handler)
}

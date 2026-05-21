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

export function addNativeScrollListener(callback) {
  const handler = event => {
    const detail = event?.detail || {}
    callback(detail.direction === 'up' ? 'up' : 'down', detail)
  }
  window.addEventListener('heritage:native-scroll', handler)
  return () => window.removeEventListener('heritage:native-scroll', handler)
}

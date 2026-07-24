import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { getNativeRouteFromUrl } from '../utils/nativeDeepLinks.js'

let initialized = false

export function applyNativeDeepLink(value) {
  const route = getNativeRouteFromUrl(value)
  if (!route) return false

  const targetHash = `#${route}`
  if (window.location.hash !== targetHash) window.location.hash = targetHash
  return true
}

export async function initializeNativeDeepLinks() {
  if (!Capacitor.isNativePlatform?.() || initialized) return
  initialized = true

  try {
    await App.addListener('appUrlOpen', event => {
      applyNativeDeepLink(event?.url)
    })

    const launch = await App.getLaunchUrl()
    if (launch?.url) applyNativeDeepLink(launch.url)
  } catch (error) {
    initialized = false
    console.warn('Could not initialize app links', error)
  }
}

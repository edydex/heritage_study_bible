import { App as NativeApp } from '@capacitor/app'
import { getStoredJson, isNativePlatform, setStoredJson, STORAGE_KEYS } from './persistentStorage.js'
import { COMMUNITY_SESSION_CHANGE_EVENT } from './communitySessions.js'
import { SYNC_STATE_CHANGE_EVENT } from './syncEvents.js'

export const AUTOMATIC_SYNC_CHANGE_EVENT = 'heritage-automatic-sync-change'
export const AUTOMATIC_SYNC_STATUS_EVENT = 'heritage-automatic-sync-status'
export const AUTOMATIC_SYNC_INTERVAL_MS = 3 * 60_000
export const AUTOMATIC_SYNC_START_DELAY_MS = 10_000
let automaticStatus = { running: false, error: '' }

export const getAutomaticSyncStatus = () => automaticStatus
export async function getAutomaticSyncEnabled() {
  return (await getStoredJson(STORAGE_KEYS.automaticSync, false)) === true
}
export async function setAutomaticSyncEnabled(enabled) {
  await setStoredJson(STORAGE_KEYS.automaticSync, enabled === true)
  window.dispatchEvent(new Event(AUTOMATIC_SYNC_CHANGE_EVENT))
}

function status(value) {
  automaticStatus = value
  window.dispatchEvent(new Event(AUTOMATIC_SYNC_STATUS_EVENT))
}

// Start only after the reader has rendered and restored its local annotations.
// Foreground timers are deliberately used instead of a mobile background task.
export function startAutomaticSync({ sync = async () => (await import('./progressSync.js')).performManualSync() } = {}) {
  let stopped = false
  let enabled = false
  let active = !isNativePlatform()
  let running = false
  let signInRequired = false
  let failures = 0
  let timer = null
  let idle = null
  let preferenceVersion = 0
  let nativeListener = null
  let nativeStateChanged = false
  let due = Date.now() + AUTOMATIC_SYNC_START_DELAY_MS

  const eligible = () => !stopped && enabled && active && !document.hidden && navigator.onLine !== false && !signInRequired
  const clear = () => {
    window.clearTimeout(timer)
    if (idle != null) window.cancelIdleCallback?.(idle)
    timer = idle = null
  }
  const schedule = () => {
    clear()
    if (!eligible() || running) return
    timer = window.setTimeout(whenDue, Math.max(0, due - Date.now()))
  }
  async function attempt() {
    idle = null
    if (!eligible() || running) return
    const element = document.activeElement
    if (element?.matches('textarea, [contenteditable="true"], [role="textbox"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"])')) {
      due = Date.now() + AUTOMATIC_SYNC_START_DELAY_MS
      schedule()
      return
    }
    running = true
    status({ running: true, error: '' })
    try {
      await sync()
      failures = 0
      status({ running: false, error: '' })
    } catch (error) {
      failures += 1
      signInRequired = error?.status === 401
      status({ running: false, error: signInRequired
        ? 'Sign in to use automatic sync.'
        : 'Automatic sync could not finish. Your local data is safe; Heritage will try again.' })
    } finally {
      running = false
      due = Date.now() + Math.min(30 * 60_000, AUTOMATIC_SYNC_INTERVAL_MS * 2 ** Math.min(failures, 4))
      schedule()
    }
  }
  function whenDue() {
    timer = null
    if (!eligible()) return
    if (window.requestIdleCallback) idle = window.requestIdleCallback(() => { void attempt() }, { timeout: 3000 })
    else void attempt()
  }
  function foregroundChanged() {
    // Let navigation/rendering settle after returning to the app or reconnecting.
    if (eligible()) due = Math.max(due, Date.now() + AUTOMATIC_SYNC_START_DELAY_MS)
    schedule()
  }
  async function preferencesChanged() {
    const version = ++preferenceVersion
    const next = await getAutomaticSyncEnabled().catch(() => false)
    if (stopped || version !== preferenceVersion) return
    enabled = next
    signInRequired = false
    failures = 0
    due = Date.now() + AUTOMATIC_SYNC_START_DELAY_MS
    if (!enabled) status({ running, error: '' })
    schedule()
  }
  const storageChanged = event => {
    if (!event.key || event.key === STORAGE_KEYS.automaticSync) void preferencesChanged()
  }
  const sessionChanged = () => { signInRequired = false; foregroundChanged() }
  const syncChanged = event => {
    if (!event.detail?.lastSyncedAt) return
    failures = 0
    due = Date.now() + AUTOMATIC_SYNC_INTERVAL_MS
    schedule()
  }
  document.addEventListener('visibilitychange', foregroundChanged)
  window.addEventListener('online', foregroundChanged)
  window.addEventListener('offline', foregroundChanged)
  window.addEventListener('storage', storageChanged)
  window.addEventListener(AUTOMATIC_SYNC_CHANGE_EVENT, preferencesChanged)
  window.addEventListener(COMMUNITY_SESSION_CHANGE_EVENT, sessionChanged)
  window.addEventListener(SYNC_STATE_CHANGE_EVENT, syncChanged)
  if (isNativePlatform()) {
    void NativeApp.addListener('appStateChange', state => {
      nativeStateChanged = true
      active = state.isActive === true
      foregroundChanged()
    }).then(listener => {
      if (stopped) void listener.remove()
      else nativeListener = listener
    }).catch(() => {})
    void NativeApp.getState().then(state => {
      if (stopped || nativeStateChanged) return
      active = state.isActive === true
      foregroundChanged()
    }).catch(() => {})
  }
  void preferencesChanged()
  return () => {
    stopped = true
    clear()
    document.removeEventListener('visibilitychange', foregroundChanged)
    window.removeEventListener('online', foregroundChanged)
    window.removeEventListener('offline', foregroundChanged)
    window.removeEventListener('storage', storageChanged)
    window.removeEventListener(AUTOMATIC_SYNC_CHANGE_EVENT, preferencesChanged)
    window.removeEventListener(COMMUNITY_SESSION_CHANGE_EVENT, sessionChanged)
    window.removeEventListener(SYNC_STATE_CHANGE_EVENT, syncChanged)
    void nativeListener?.remove()
  }
}

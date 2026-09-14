import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ enabled: false, listener: null, remove: vi.fn() }))
vi.mock('@capacitor/core', async importOriginal => ({ ...(await importOriginal()), Capacitor: { isNativePlatform: () => native.enabled } }))
vi.mock('@capacitor/app', () => ({ App: {
  getState: vi.fn(async () => ({ isActive: true })),
  addListener: vi.fn(async (_name, callback) => { native.listener = callback; return { remove: native.remove } }),
} }))

import { AUTOMATIC_SYNC_INTERVAL_MS as INTERVAL, AUTOMATIC_SYNC_START_DELAY_MS as START, getAutomaticSyncEnabled, getAutomaticSyncStatus, setAutomaticSyncEnabled, startAutomaticSync } from './automaticSync.js'
import { COMMUNITY_SESSION_CHANGE_EVENT } from './communitySessions.js'

let stop
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  // Exercise the WebView timer fallback deterministically.
  vi.stubGlobal('requestIdleCallback', undefined)
  native.enabled = false
  native.listener = null
  native.remove.mockClear()
})
afterEach(() => { stop?.(); stop = null; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

async function start(sync) {
  await setAutomaticSyncEnabled(true)
  stop = startAutomaticSync({ sync })
  await vi.advanceTimersByTimeAsync(0)
}

describe('automatic personal sync', () => {
  it('is opt-in and persists independently of account sync state', async () => {
    expect(await getAutomaticSyncEnabled()).toBe(false)
    const sync = vi.fn()
    stop = startAutomaticSync({ sync })
    await vi.advanceTimersByTimeAsync(INTERVAL * 2)
    expect(sync).not.toHaveBeenCalled()
    await setAutomaticSyncEnabled(true)
    expect(await getAutomaticSyncEnabled()).toBe(true)
    await vi.advanceTimersByTimeAsync(START - 1)
    expect(sync).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(sync).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(sync).toHaveBeenCalledTimes(2)
    await setAutomaticSyncEnabled(false)
    await vi.advanceTimersByTimeAsync(INTERVAL * 2)
    expect(sync).toHaveBeenCalledTimes(2)
  })

  it('pauses while hidden or offline and settles before resuming without a catch-up burst', async () => {
    const sync = vi.fn()
    await start(sync)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(INTERVAL * 10)
    expect(sync).not.toHaveBeenCalled()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(sync).not.toHaveBeenCalled()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(START - 1)
    expect(sync).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('uses native app lifecycle and removes its listener', async () => {
    await setAutomaticSyncEnabled(true)
    native.enabled = true
    const sync = vi.fn()
    stop = startAutomaticSync({ sync })
    await vi.advanceTimersByTimeAsync(0)
    native.listener({ isActive: false })
    await vi.advanceTimersByTimeAsync(INTERVAL * 2)
    expect(sync).not.toHaveBeenCalled()
    native.listener({ isActive: true })
    await vi.advanceTimersByTimeAsync(START)
    expect(sync).toHaveBeenCalledTimes(1)
    stop(); stop = null
    expect(native.remove).toHaveBeenCalledOnce()
  })

  it('does not overlap slow requests, and stopping prevents future attempts', async () => {
    let finish
    const sync = vi.fn(() => new Promise(resolve => { finish = resolve }))
    await start(sync)
    await vi.advanceTimersByTimeAsync(INTERVAL * 4)
    expect(sync).toHaveBeenCalledOnce()
    expect(getAutomaticSyncStatus().running).toBe(true)
    stop(); stop = null
    finish()
    await vi.advanceTimersByTimeAsync(INTERVAL * 4)
    expect(sync).toHaveBeenCalledOnce()
  })

  it('backs off after failures and waits for sign-in after a revoked session', async () => {
    const sync = vi.fn().mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(Object.assign(new Error('revoked'), { status: 401 })).mockResolvedValue({})
    await start(sync)
    await vi.advanceTimersByTimeAsync(START)
    expect(getAutomaticSyncStatus().error).toMatch(/try again/)
    await vi.advanceTimersByTimeAsync(INTERVAL * 2 - 1)
    expect(sync).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(sync).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(INTERVAL * 20)
    expect(sync).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event(COMMUNITY_SESSION_CHANGE_EVENT))
    await vi.advanceTimersByTimeAsync(START)
    expect(sync).toHaveBeenCalledTimes(3)
  })

  it('defers while a note editor has focus', async () => {
    const input = document.createElement('textarea')
    document.body.append(input)
    input.focus()
    const sync = vi.fn()
    await start(sync)
    await vi.advanceTimersByTimeAsync(START * 3)
    expect(sync).not.toHaveBeenCalled()
    input.remove()
    await vi.advanceTimersByTimeAsync(START)
    expect(sync).toHaveBeenCalledOnce()
  })

  it('can start while the automatic-sync switch still has focus', async () => {
    const input = document.createElement('input')
    input.type = 'checkbox'
    document.body.append(input)
    input.focus()
    const sync = vi.fn()
    await start(sync)
    await vi.advanceTimersByTimeAsync(START)
    expect(sync).toHaveBeenCalledOnce()
    input.remove()
  })
})

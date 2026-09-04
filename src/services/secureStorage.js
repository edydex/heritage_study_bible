import { Capacitor, registerPlugin } from '@capacitor/core'

const HeritageSecureStorage = registerPlugin('HeritageSecureStorage')
const DEVICE_ID_KEY = 'heritage-installation-device-id-v1'
const DEVICE_NAME_KEY = 'heritage-installation-device-name-v1'

function isNativeAndroid() {
  return Capacitor.getPlatform?.() === 'android'
}

function browserSecretStorage() {
  try { return window.sessionStorage } catch { return null }
}

export async function getSecureValue(key) {
  if (isNativeAndroid()) {
    const result = await HeritageSecureStorage.get({ key })
    return typeof result?.value === 'string' ? result.value : null
  }
  return browserSecretStorage()?.getItem(key) ?? null
}

export async function setSecureValue(key, value) {
  if (isNativeAndroid()) {
    await HeritageSecureStorage.set({ key, value: String(value) })
    return
  }
  browserSecretStorage()?.setItem(key, String(value))
}

export async function removeSecureValue(key) {
  if (isNativeAndroid()) {
    await HeritageSecureStorage.remove({ key })
    return
  }
  browserSecretStorage()?.removeItem(key)
}

function browserDeviceValue(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

function setBrowserDeviceValue(key, value) {
  try { localStorage.setItem(key, value) } catch {}
}

export async function getDeviceIdentity() {
  let deviceId = isNativeAndroid()
    ? await getSecureValue(DEVICE_ID_KEY)
    : browserDeviceValue(DEVICE_ID_KEY)
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(deviceId || '')) {
    deviceId = `heritage-${crypto.randomUUID()}`
    if (isNativeAndroid()) await setSecureValue(DEVICE_ID_KEY, deviceId)
    else setBrowserDeviceValue(DEVICE_ID_KEY, deviceId)
  }

  let deviceName = isNativeAndroid()
    ? await getSecureValue(DEVICE_NAME_KEY)
    : browserDeviceValue(DEVICE_NAME_KEY)
  if (!deviceName) {
    deviceName = isNativeAndroid() ? 'Android phone' : 'Web browser'
    if (isNativeAndroid()) await setSecureValue(DEVICE_NAME_KEY, deviceName)
    else setBrowserDeviceValue(DEVICE_NAME_KEY, deviceName)
  }
  return {
    deviceId,
    deviceName,
    platform: isNativeAndroid() ? 'android' : 'web',
  }
}

export async function authenticateLocalDevice(reason = 'Confirm this account-protection change') {
  if (!isNativeAndroid()) return { supported: false, authenticated: true }
  return HeritageSecureStorage.authenticate({ reason })
}

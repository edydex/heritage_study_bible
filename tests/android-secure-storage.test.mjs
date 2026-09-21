import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readProjectFile = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

test('Android registers an encrypted secure-storage plugin and disables app-data backup', () => {
  const manifest = readProjectFile('android/app/src/main/AndroidManifest.xml')
  const activity = readProjectFile('android/app/src/main/java/faith/heritage/app/MainActivity.java')
  const plugin = readProjectFile('android/app/src/main/java/faith/heritage/app/HeritageSecureStoragePlugin.java')

  assert.match(manifest, /android:allowBackup="false"/)
  assert.match(activity, /registerPlugin\(HeritageSecureStoragePlugin\.class\)/)
  assert.match(plugin, /@CapacitorPlugin\(name = "HeritageSecureStorage"\)/)
  assert.match(plugin, /KeyStore\.getInstance\("AndroidKeyStore"\)/)
  assert.match(plugin, /AES\/GCM\/NoPadding/)
  assert.match(plugin, /setRandomizedEncryptionRequired\(true\)/)
  assert.match(plugin, /cipher\.updateAAD\(key\.getBytes\(StandardCharsets\.UTF_8\)\)/)
  assert.match(plugin, /preferences\(\)\.edit\(\)\.putString\(key, encoded\)/)
  assert.doesNotMatch(plugin, /putString\(key, value\)/)
})

test('Android account changes use the system device-credential confirmation UI', () => {
  const plugin = readProjectFile('android/app/src/main/java/faith/heritage/app/HeritageSecureStoragePlugin.java')

  assert.match(plugin, /isDeviceSecure\(\)/)
  assert.match(plugin, /createConfirmDeviceCredentialIntent/)
  assert.match(plugin, /startActivityForResult\(call, intent, "deviceAuthenticationResult"\)/)
  assert.match(plugin, /Activity\.RESULT_OK/)
})

test('the JavaScript secure-storage boundary keeps web account secrets in session storage', () => {
  const service = readProjectFile('src/services/secureStorage.js')

  assert.match(service, /return window\.sessionStorage/)
  assert.match(service, /HeritageSecureStorage\.get\(\{ key \}\)/)
  assert.match(service, /HeritageSecureStorage\.set\(\{ key, value: String\(value\) \}\)/)
  assert.doesNotMatch(service, /localStorage\.setItem\(key, String\(value\)\)/)
})

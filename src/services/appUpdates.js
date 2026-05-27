import { getNativeAppInfo, openNativeExternalUrl } from './androidControls'

const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/edydex/heritage_study_bible/releases/latest'

function parseVersionParts(version) {
  const match = String(version || '').match(/\d+(?:\.\d+)*/)
  if (!match) return null
  return match[0].split('.').map(part => Number.parseInt(part, 10) || 0)
}

function compareVersions(left, right) {
  const leftParts = parseVersionParts(left)
  const rightParts = parseVersionParts(right)
  if (!leftParts || !rightParts) return null

  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] || 0
    const rightValue = rightParts[index] || 0
    if (leftValue > rightValue) return 1
    if (leftValue < rightValue) return -1
  }
  return 0
}

function findApkAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : []
  return assets.find(asset =>
    /\.apk$/i.test(asset?.name || '') ||
    asset?.content_type === 'application/vnd.android.package-archive'
  ) || null
}

export async function checkForApkUpdate() {
  const appInfo = await getNativeAppInfo()
  const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  })

  if (response.status === 404) {
    return {
      status: 'no-release',
      currentVersion: appInfo?.versionName || '',
    }
  }

  if (!response.ok) {
    throw new Error(`GitHub update check failed (${response.status})`)
  }

  const release = await response.json()
  const apkAsset = findApkAsset(release)
  if (!apkAsset?.browser_download_url) {
    return {
      status: 'no-apk',
      currentVersion: appInfo?.versionName || '',
      latestVersion: release?.tag_name || release?.name || '',
      releaseUrl: release?.html_url || '',
    }
  }

  const currentVersion = appInfo?.versionName || ''
  const latestVersion = release?.tag_name || release?.name || ''
  const comparison = compareVersions(latestVersion, currentVersion)
  const updateAvailable = comparison == null
    ? latestVersion && latestVersion !== currentVersion
    : comparison > 0

  return {
    status: updateAvailable ? 'update-available' : 'up-to-date',
    currentVersion,
    latestVersion,
    releaseUrl: release?.html_url || '',
    downloadUrl: apkAsset.browser_download_url,
    assetName: apkAsset.name || 'APK',
  }
}

export async function openApkDownload(downloadUrl) {
  const opened = await openNativeExternalUrl(downloadUrl)
  if (!opened && downloadUrl) {
    window.location.href = downloadUrl
  }
  return opened
}

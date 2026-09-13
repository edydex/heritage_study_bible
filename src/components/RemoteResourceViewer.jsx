import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { resolveCommunitySongMemberAccess } from '../services/communitySongAccess'
import { getRemoteContentItem } from '../services/contentServers'
import { getCommunities } from '../services/communities'
import {
  buildCommunitySongMemberShareUrl,
  communitySongMemberItemFromRoute,
} from '../utils/communitySongLinks'
import { writeTextToClipboard } from '../utils/verseSelection'
import SongRightsDisclosure from './SongRightsDisclosure'

const REMOTE_CONTENT_CACHE = 'heritage-remote-content-v3'
const CHECKING_ACCESS = Object.freeze({ status: 'checking', communityName: '' })
const PUBLIC_ACCESS = Object.freeze({ status: 'not-required', communityName: '' })
const TEXT_MEDIA_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/markdown',
  'text/markdown',
  'text/plain',
  'text/html',
])
const BLOCK_LEXICAL_TYPES = new Set([
  'code',
  'heading',
  'list',
  'listitem',
  'paragraph',
  'quote',
  'root',
])
const ASSET_FIELDS = [
  ['files', 'Files'],
  ['media', 'Media'],
  ['uploads', 'Downloads'],
  ['choirScores', 'Choir scores'],
  ['recordings', 'Recordings'],
  ['attachments', 'Attachments'],
]

function isTextMediaType(mediaType) {
  return mediaType.startsWith('text/') || mediaType.endsWith('+json') || TEXT_MEDIA_TYPES.has(mediaType)
}

function resolveHttpAssetUrl(value, baseUrl) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim(), baseUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    return url.href
  } catch {
    return ''
  }
}

function htmlToPlainText(value) {
  const html = String(value || '')
  if (!html) return ''
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n').trim()
  }
  return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim()
}

function lexicalPlainText(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(lexicalPlainText).filter(Boolean).join('\n')
  if (typeof value !== 'object') return ''
  if (typeof value.text === 'string') return value.text
  if (value.type === 'linebreak') return '\n'

  const children = Array.isArray(value.children)
    ? value.children
    : Array.isArray(value.root?.children)
      ? value.root.children
      : []
  const joined = children.map(lexicalPlainText).filter(Boolean).join('')
  return joined && BLOCK_LEXICAL_TYPES.has(value.type) && value.type !== 'root' ? `${joined}\n` : joined
}

function readableText(value) {
  if (typeof value === 'string') {
    return /<\/?[a-z][\s\S]*>/i.test(value) ? htmlToPlainText(value) : value.trim()
  }
  return lexicalPlainText(value).replace(/\n{3,}/g, '\n\n').trim()
}

function friendlyStatus(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map(word => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

function assetFromValue(value, groupLabel, index, baseUrl) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : null
  const rawUrl = typeof value === 'string'
    ? value
    : object?.url || object?.path || object?.src || object?.file?.url
  const url = resolveHttpAssetUrl(rawUrl, baseUrl)
  if (!url) return null
  return {
    url,
    label: String(object?.label || object?.alt || object?.filename || object?.name || `${groupLabel} ${index + 1}`),
    mediaType: String(object?.mimeType || object?.mediaType || object?.type || ''),
    groupLabel,
  }
}

function collectAssets(document, baseUrl) {
  if (!document || typeof document !== 'object' || Array.isArray(document) || !baseUrl) return []
  const seen = new Set()
  const assets = []
  for (const [field, label] of ASSET_FIELDS) {
    const values = Array.isArray(document[field])
      ? document[field]
      : document[field] != null
        ? [document[field]]
        : []
    values.forEach((value, index) => {
      const asset = assetFromValue(value, label, index, baseUrl)
      if (!asset || seen.has(asset.url)) return
      seen.add(asset.url)
      assets.push(asset)
    })
  }
  return assets
}

function getMetadata(document, includeRights = true) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return []
  const entries = []
  const add = (label, value) => {
    const text = Array.isArray(value)
      ? value.filter(item => typeof item === 'string').join(', ')
      : typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : ''
    if (text.trim()) entries.push({ label, value: text.trim() })
  }
  add('Author', document.author)
  add('Authors', document.authors)
  add('Speaker', document.speaker)
  add('Series', document.series)
  add('Scripture', document.scripture)
  add('Preached', document.preachedAt)
  add('Published', document.publishedYear)
  add('Key', document.key)
  add('Tempo', document.tempo)
  if (includeRights) {
    add('Rights status', friendlyStatus(document.rightsStatus))
    add('CCLI song number', document.ccliNumber)
    add('License', document.license)
    add('Copyright', document.copyright)
  }
  return entries
}

async function parseTextResponse(response, mediaType) {
  return mediaType.includes('json') || mediaType.endsWith('+json')
    ? response.json()
    : response.text()
}

async function openRemoteCache(options = {}) {
  if (typeof window === 'undefined' || !('caches' in window)) return null
  try {
    if (!options.authorization) return await window.caches.open(REMOTE_CONTENT_CACHE)
    const scope = `${options.authorizationOrigin}\n${options.authorization}`
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope))
    const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    return await window.caches.open(`heritage-member-songs-v1-${id}`)
  } catch { return null }
}

async function fetchRemote(url, options = {}) {
  const headers = {}
  if (
    options.authorization
    && options.authorizationOrigin
    && new URL(url).origin === options.authorizationOrigin
  ) {
    headers.Authorization = options.authorization
  }
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'omit',
    headers,
    redirect: options.authorization ? 'error' : 'follow',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  return response
}

async function loadTextNetworkFirst(url, mediaType, options = {}) {
  let networkError = null
  try {
    const response = await fetchRemote(url, options)
    const value = await parseTextResponse(response.clone(), mediaType)
    const cache = await openRemoteCache(options)
    if (cache && (!options.authorization || await cache.match(url))) {
      await cache.put(url, response.clone()).catch(() => {})
    }
    return { value, source: 'network' }
  } catch (error) {
    networkError = error
  }

  const cache = await openRemoteCache(options)
  if (options.authorization && [401, 403, 404, 410].includes(networkError?.status)) {
    if (cache) await cache.delete(url).catch(() => {})
    throw networkError
  }
  const cached = cache ? await cache.match(url) : null
  if (cached) return { value: await parseTextResponse(cached.clone(), mediaType), source: 'cache' }
  throw networkError || new Error('No saved copy is available.')
}

async function cacheRemoteUrl(cache, url, options = {}) {
  try {
    const response = await fetchRemote(url, options)
    await cache.put(url, response.clone())
    return response
  } catch (error) {
    if (options.authorization && [401, 403, 404, 410].includes(error?.status)) {
      await cache.delete(url).catch(() => {})
      throw error
    }
    const existing = await cache.match(url)
    if (existing) return existing
    throw error
  }
}

function RemoteResourceViewer({ directSong = false }) {
  const { contentKey } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const directQuery = directSong ? searchParams.toString() : ''
  const item = useMemo(
    () => directSong
      ? communitySongMemberItemFromRoute(directQuery)
      : getRemoteContentItem(contentKey),
    [contentKey, directQuery, directSong],
  )
  const accessKey = directSong && item ? `${item.sourceServerId}:${item.content?.url}` : ''
  const [accessState, setAccessState] = useState(null)
  const memberAccess = directSong
    ? accessState?.key === accessKey ? accessState : CHECKING_ACCESS
    : PUBLIC_ACCESS
  useEffect(() => {
    if (!directSong || !item) return
    let cancelled = false
    resolveCommunitySongMemberAccess({
      contentServerId: item.sourceServerId,
      contentUrl: item.content?.url,
    }).then(result => {
      if (!cancelled) setAccessState({ ...result, key: accessKey })
    })
    return () => { cancelled = true }
  }, [accessKey, directSong, item])
  const memberRequestOptions = useMemo(
    () => memberAccess.status === 'ready'
      ? {
          authorization: memberAccess.authorization,
          authorizationOrigin: memberAccess.authorizationOrigin,
        }
      : {},
    [memberAccess],
  )
  const itemKey = item?.id || contentKey || directQuery
  const objectUrlsRef = useRef(new Map())
  const [content, setContent] = useState('')
  const [contentDocument, setContentDocument] = useState(null)
  const [status, setStatus] = useState(item ? 'idle' : 'missing')
  const [message, setMessage] = useState('')
  const [savingOffline, setSavingOffline] = useState(false)
  const [cachedAssetUrls, setCachedAssetUrls] = useState({})
  const [cachedPrimaryUrl, setCachedPrimaryUrl] = useState('')
  const [preferCachedPrimary, setPreferCachedPrimary] = useState(false)
  const [songLanguage, setSongLanguage] = useState('en')
  const mediaType = item?.content?.mediaType || 'application/octet-stream'
  const isText = isTextMediaType(mediaType)
  const isSong = item?.contentType === 'songs'
  const baseUrl = typeof window === 'undefined' ? 'https://invalid.local/' : window.location.href
  const contentUrl = resolveHttpAssetUrl(item?.content?.url, baseUrl)
  const assets = useMemo(() => collectAssets(contentDocument, contentUrl), [contentDocument, contentUrl])
  const metadata = useMemo(
    () => getMetadata(contentDocument, item?.contentType !== 'songs'),
    [contentDocument, item?.contentType],
  )
  const songSections = Array.isArray(contentDocument?.songSections) ? contentDocument.songSections : []
  const transcriptSections = Array.isArray(contentDocument?.transcriptSections) ? contentDocument.transcriptSections : []
  const chapters = Array.isArray(contentDocument?.chapters) ? contentDocument.chapters : []

  const getCachedObjectUrl = async url => {
    if (objectUrlsRef.current.has(url)) return objectUrlsRef.current.get(url)
    const cache = await openRemoteCache(memberRequestOptions)
    const response = cache ? await cache.match(url) : null
    if (!response) return ''
    const objectUrl = URL.createObjectURL(await response.blob())
    objectUrlsRef.current.set(url, objectUrl)
    return objectUrl
  }

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
    setCachedAssetUrls({})
    setCachedPrimaryUrl('')
    setPreferCachedPrimary(typeof navigator !== 'undefined' && navigator.onLine === false)
    setSongLanguage('en')
  }, [itemKey])

  useEffect(() => {
    if (!item || !isText) return
    if (directSong && memberAccess.status !== 'ready') return
    if (!contentUrl) {
      setStatus('error')
      setMessage('This resource has an invalid content URL.')
      return
    }

    let cancelled = false
    setStatus('loading')
    setMessage('')
    setContent('')
    setContentDocument(null)
    loadTextNetworkFirst(contentUrl, mediaType, memberRequestOptions)
      .then(({ value, source }) => {
        if (cancelled) return
        const document = value && typeof value === 'object' && !Array.isArray(value) ? value : null
        setContentDocument(document)
        setContent(typeof value === 'string' ? readableText(value) : '')
        setStatus('ready')
        if (source === 'cache') setMessage('Loaded the saved offline copy because the server was unavailable.')
      })
      .catch(error => {
        if (cancelled) return
        setStatus('error')
        setMessage(directSong && [401, 403, 404, 410].includes(error?.status)
          ? 'This song is no longer available to your church account. Check your church sign-in or ask your church about access.'
          : `Could not load this resource: ${error.message}`)
      })
    return () => { cancelled = true }
  }, [contentUrl, directSong, isText, item, itemKey, mediaType, memberAccess.status, memberRequestOptions])

  useEffect(() => {
    if (!assets.length) return
    let cancelled = false
    Promise.all(assets.map(async asset => [asset.url, await getCachedObjectUrl(asset.url)]))
      .then(entries => {
        if (cancelled) return
        setCachedAssetUrls(Object.fromEntries(entries.filter(([, url]) => url)))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [assets])

  useEffect(() => {
    if (!item || isText || !contentUrl) return
    if (directSong && memberAccess.status !== 'ready') return
    let cancelled = false
    getCachedObjectUrl(contentUrl)
      .then(url => {
        if (!cancelled) setCachedPrimaryUrl(url)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [contentUrl, directSong, isText, item, itemKey, memberAccess.status])

  const directSections = useMemo(() => {
    if (!contentDocument) return []
    const russian = songLanguage === 'ru'
    return [
      { title: russian ? 'Текст песни' : 'Lyrics', value: readableText(russian ? contentDocument.russianLyrics : contentDocument.lyrics), mono: false },
      { title: russian ? 'Аккорды' : 'Chord sheet', value: readableText(russian ? contentDocument.russianChordSheet : contentDocument.chordSheet), mono: true },
      { title: 'Transcript', value: readableText(contentDocument.transcript), mono: false },
      { title: 'Text', value: readableText(contentDocument.body || contentDocument.richText), mono: false },
    ].filter(section => section.value)
  }, [contentDocument, songLanguage])

  const hasStructuredContent = Boolean(
    contentDocument && (
      songSections.length
      || transcriptSections.length
      || chapters.length
      || directSections.length
      || assets.length
      || metadata.length
      || isSong
    )
  )

  const makeAvailableOffline = async () => {
    if (!contentUrl) {
      setMessage('This resource has an invalid content URL and cannot be saved.')
      return
    }
    const cache = await openRemoteCache(memberRequestOptions)
    if (!cache) {
      setMessage('Offline saving is not supported by this browser or WebView.')
      return
    }

    setSavingOffline(true)
    setMessage('Saving this resource and its linked files…')
    try {
      await cacheRemoteUrl(cache, contentUrl, memberRequestOptions)
      let failedAssets = 0
      for (const asset of assets) {
        try {
          await cacheRemoteUrl(cache, asset.url, memberRequestOptions)
        } catch {
          failedAssets += 1
        }
      }

      const assetEntries = await Promise.all(assets.map(async asset => [asset.url, await getCachedObjectUrl(asset.url)]))
      setCachedAssetUrls(Object.fromEntries(assetEntries.filter(([, url]) => url)))
      if (!isText) setCachedPrimaryUrl(await getCachedObjectUrl(contentUrl))

      if (failedAssets) {
        setMessage(`Saved the main resource, but ${failedAssets} linked file${failedAssets === 1 ? '' : 's'} could not be saved.`)
      } else if (assets.length) {
        setMessage(`Saved this resource and ${assets.length} linked file${assets.length === 1 ? '' : 's'} for offline use.`)
      } else {
        setMessage('Saved this resource for offline use on this device.')
      }
    } catch (error) {
      setMessage(`Could not save this resource: ${error.message}`)
    } finally {
      setSavingOffline(false)
    }
  }

  const handlePrimaryMediaError = () => {
    if (cachedPrimaryUrl && !preferCachedPrimary) {
      setPreferCachedPrimary(true)
      setMessage('The server copy was unavailable, so the saved offline copy was opened.')
    } else if (!cachedPrimaryUrl) {
      setMessage('This media could not be loaded and no saved offline copy is available.')
    }
  }

  const communitySongSource = item?.contentType === 'songs' && (directSong
    || getCommunities().some(community => community.contentPreview?.manifest?.id === item.sourceServerId))
  const memberShareUrl = communitySongSource
    ? buildCommunitySongMemberShareUrl(contentUrl, item.sourceServerId)
    : ''
  const shareSong = async () => {
    if (!memberShareUrl) {
      setMessage('This song does not have a valid member link.')
      return
    }
    const title = contentDocument?.title || item.title || 'Community song'
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} — member-only Community song; sign-in required`, url: memberShareUrl })
        setMessage('Member link shared.')
      } else {
        await writeTextToClipboard(memberShareUrl)
        setMessage('Member link copied.')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage(`Could not share this song: ${error.message}`)
    }
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Resource unavailable</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {directSong
              ? 'This member-only song link is incomplete or unsafe.'
              : 'Its Content Server may have been removed or refreshed.'}
          </p>
          <button onClick={() => navigate(directSong ? '/resources/songs' : '/settings/content-servers')} className="mt-4 text-primary dark:text-blue-300 underline">
            {directSong ? 'Browse songs' : 'Manage Content Servers'}
          </button>
        </div>
      </div>
    )
  }

  if (directSong && memberAccess.status === 'checking') {
    return <div className="p-6 text-center" role="status">Checking church sign-in…</div>
  }

  if (directSong && memberAccess.status !== 'ready') {
    const source = memberAccess.communityName || item.sourceServerName || 'this Community'
    const explanation = memberAccess.status === 'origin-mismatch'
      ? `This song address does not match your saved church, ${source}.`
      : memberAccess.status === 'invalid-community'
        ? 'Check this church’s saved address in Community Home before opening member songs.'
        : memberAccess.status === 'sign-in-required'
          ? `This is a member-only song from ${source}. Sign in to that Community on this device, then reopen the link.`
          : 'This is a member-only song. Join and sign in to the Community that sent it, then reopen the link.'
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-amber-300 bg-amber-50 p-5 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <h1 className="text-xl font-bold text-amber-950 dark:text-amber-100">Community sign-in required</h1>
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">{explanation}</p>
          <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
            Your personal notes and progress account is separate from church membership.
          </p>
          <button onClick={() => navigate('/community')} className="mt-4 font-semibold text-primary dark:text-blue-300 underline">
            Open Community Home
          </button>
        </div>
      </div>
    )
  }

  const primaryMediaUrl = preferCachedPrimary && cachedPrimaryUrl ? cachedPrimaryUrl : contentUrl
  const hasRussianListing = Boolean(
    contentDocument?.russianTitle
    || contentDocument?.russianLyrics
    || contentDocument?.russianChordSheet,
  )
  const displayTitle = songLanguage === 'ru' && contentDocument?.russianTitle
    ? contentDocument.russianTitle
    : (contentDocument?.title || item.title)
  const selectedSongHasContent = songLanguage === 'ru'
    ? Boolean(readableText(contentDocument?.russianLyrics) || readableText(contentDocument?.russianChordSheet))
    : Boolean(readableText(contentDocument?.lyrics) || readableText(contentDocument?.chordSheet))
  const sourceServerName = contentDocument?.communityRightsContact?.communityName || memberAccess.communityName || item.sourceServerName

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white sticky top-0 z-40 shadow-lg safe-area-top">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/20" aria-label="Back">←</button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">{displayTitle}</h1>
            <p className="text-[11px] text-blue-100 truncate">From {sourceServerName}</p>
          </div>
          {isSong && hasRussianListing && (
            <div className="ml-auto flex rounded-lg bg-white/15 p-0.5 text-xs font-semibold" aria-label="Song language">
              <button onClick={() => setSongLanguage('en')} className={`rounded-md px-2 py-1 ${songLanguage === 'en' ? 'bg-white text-primary' : ''}`}>EN</button>
              <button onClick={() => setSongLanguage('ru')} className={`rounded-md px-2 py-1 ${songLanguage === 'ru' ? 'bg-white text-primary' : ''}`}>RU</button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-6 pb-20">
        {(contentDocument?.description || item.description) && (
          <p className="mb-5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{contentDocument?.description || item.description}</p>
        )}

        {memberShareUrl && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
            <p className="font-semibold">Member-only Community song</p>
            <p className="mt-1">
              Recipients must be signed in to {sourceServerName}. Church editors manage which songs are available to members.
            </p>
          </div>
        )}

        {!contentUrl && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-200">
            This resource was rejected because its content URL is not HTTP or HTTPS.
          </div>
        )}
        {contentUrl && mediaType.startsWith('audio/') && <audio controls preload="metadata" src={primaryMediaUrl} onError={handlePrimaryMediaError} className="w-full" />}
        {contentUrl && mediaType.startsWith('video/') && <video controls preload="metadata" src={primaryMediaUrl} onError={handlePrimaryMediaError} className="w-full rounded-xl bg-black" />}
        {contentUrl && mediaType.startsWith('image/') && <img src={primaryMediaUrl} onError={handlePrimaryMediaError} alt={item.title} className="max-h-[70vh] w-full rounded-xl object-contain bg-white dark:bg-gray-800" />}
        {contentUrl && isText && (
          <article className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm">
            {status === 'loading' ? (
              <p className="animate-pulse text-gray-500 dark:text-gray-400">Loading resource…</p>
            ) : hasStructuredContent ? (
              <div className="space-y-6 text-gray-800 dark:text-gray-200">
                {metadata.length > 0 && (
                  <dl className="grid gap-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 sm:grid-cols-2">
                    {metadata.map(entry => (
                      <div key={entry.label} className="text-sm">
                        <dt className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{entry.label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap">{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {songSections.map((section, sectionIndex) => (
                  <section key={`${section.label || 'section'}-${sectionIndex}`}>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{section.label || `Section ${sectionIndex + 1}`}</h2>
                    <div className="mt-3 space-y-3">
                      {(Array.isArray(section.lines) ? section.lines : []).map((line, lineIndex) => {
                        const lineText = typeof line === 'string' ? line : readableText(line?.text)
                        const chords = typeof line === 'object' ? readableText(line?.chords) : ''
                        return (
                          <div key={`${lineText || 'line'}-${lineIndex}`}>
                            {chords && <p className="font-mono text-sm font-semibold text-primary dark:text-blue-300 whitespace-pre-wrap">{chords}</p>}
                            {lineText && <p className="text-base leading-relaxed whitespace-pre-wrap">{lineText}</p>}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}

                {transcriptSections.map((section, sectionIndex) => (
                  <section key={`${section.title || 'section'}-${sectionIndex}`} className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-lg font-bold">{readableText(section.title) || `Section ${sectionIndex + 1}`}</h2>
                      {section.timeRange && <span className="text-xs text-gray-500 dark:text-gray-400">{readableText(section.timeRange)}</span>}
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{readableText(section.text || section.summary)}</p>
                  </section>
                ))}

                {chapters.map((chapter, chapterIndex) => (
                  <section key={`${chapter.title || 'chapter'}-${chapterIndex}`} className="space-y-2">
                    <h2 className="text-lg font-bold">{readableText(chapter.title) || `Chapter ${chapterIndex + 1}`}</h2>
                    <p className="leading-relaxed whitespace-pre-wrap">{readableText(chapter.text || chapter.body || chapter.summary)}</p>
                  </section>
                ))}

                {directSections.map(section => (
                  <section key={section.title}>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{section.title}</h2>
                    <p className={`mt-3 leading-relaxed whitespace-pre-wrap ${section.mono ? 'font-mono text-sm' : ''}`}>{section.value}</p>
                  </section>
                ))}

                {isSong && !selectedSongHasContent && (
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
                    {songLanguage === 'ru'
                      ? 'This listing has a Russian title, but no Russian lyrics or chords have been published yet.'
                      : 'This song is currently a listing only; no English lyrics or chords have been published.'}
                  </div>
                )}

                {isSong && (
                  <SongRightsDisclosure
                    document={contentDocument}
                    songTitle={displayTitle}
                    contentUrl={contentUrl}
                  />
                )}

                {assets.length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Files and media</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {assets.map(asset => {
                        const assetUrl = cachedAssetUrls[asset.url] || asset.url
                        if (asset.mediaType.startsWith('audio/')) {
                          return <audio key={asset.url} controls preload="metadata" src={assetUrl} className="w-full" aria-label={asset.label} />
                        }
                        if (asset.mediaType.startsWith('video/')) {
                          return <video key={asset.url} controls preload="metadata" src={assetUrl} className="w-full rounded-lg bg-black" aria-label={asset.label} />
                        }
                        if (asset.mediaType.startsWith('image/')) {
                          return <a key={asset.url} href={assetUrl} target="_blank" rel="noreferrer"><img src={assetUrl} alt={asset.label} className="max-h-72 w-full rounded-lg object-contain" /></a>
                        }
                        return (
                          <a key={asset.url} href={assetUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-primary dark:text-blue-300">
                            {asset.label}
                          </a>
                        )
                      })}
                    </div>
                  </section>
                )}
              </div>
            ) : content ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200">{content}</pre>
            ) : status === 'error' ? null : (
              <p className="text-sm text-gray-500 dark:text-gray-400">This resource does not include readable text.</p>
            )}
          </article>
        )}

        {contentUrl && !isText && !mediaType.startsWith('audio/') && !mediaType.startsWith('video/') && !mediaType.startsWith('image/') && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">This resource is provided as a {mediaType} file.</p>
            {cachedPrimaryUrl && <a href={cachedPrimaryUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-primary dark:text-blue-300 underline">Open saved copy</a>}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {contentUrl && !directSong && <a href={contentUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Open original</a>}
          {contentUrl && (
            <button disabled={savingOffline} onClick={makeAvailableOffline} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50">
              {savingOffline ? 'Saving…' : 'Save offline'}
            </button>
          )}
          {memberShareUrl && (
            <button onClick={shareSong} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              Share member-only link
            </button>
          )}
        </div>
        {message && <p className={`mt-3 text-sm ${status === 'error' ? 'text-red-600 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'}`}>{message}</p>}
      </main>
    </div>
  )
}

export default RemoteResourceViewer

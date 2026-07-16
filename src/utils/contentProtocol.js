export const CONTENT_SERVER_KIND = 'heritage-content-server'
export const CONTENT_PROTOCOL_VERSION = 2
export const SUPPORTED_CONTENT_TYPES = Object.freeze([
  'readingPlans',
  'songs',
  'sermons',
  'books',
  'commentaries',
])

export const RESOURCE_CATEGORY_TO_CONTENT_TYPE = Object.freeze({
  'reading-plans': 'readingPlans',
  songs: 'songs',
  sermons: 'sermons',
  books: 'books',
  commentaries: 'commentaries',
})

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,95})$/
const CATALOG_ALIASES = Object.freeze({ plans: 'readingPlans', hymns: 'songs' })

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
}

export function resolvePublicUrl(value, baseUrl) {
  const url = new URL(String(value || ''), baseUrl)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Content URLs must use HTTP or HTTPS.')
  }
  url.username = ''
  url.password = ''
  return url.href
}

export function normalizeContentServerManifestUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('Enter a content server URL.')

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  const url = new URL(withProtocol)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Content server URLs must use HTTP or HTTPS.')
  }

  url.username = ''
  url.password = ''
  url.hash = ''
  if (!url.pathname.endsWith('.json')) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/heritage-content.json`.replace(/^\/{2,}/, '/')
    url.search = ''
  }
  return url.href
}

export function validateContentServerManifest(input, manifestUrl) {
  assertPlainObject(input, 'Content server manifest')
  if (input.kind !== CONTENT_SERVER_KIND) {
    throw new Error(`Unsupported server kind. Expected “${CONTENT_SERVER_KIND}”.`)
  }
  if (Number(input.schemaVersion) !== CONTENT_PROTOCOL_VERSION) {
    throw new Error(`Unsupported content protocol version ${input.schemaVersion ?? 'unknown'}.`)
  }
  if (!ID_PATTERN.test(String(input.id || ''))) {
    throw new Error('The content server has an invalid id.')
  }
  if (!String(input.name || '').trim()) {
    throw new Error('The content server is missing a name.')
  }
  assertPlainObject(input.catalogs, 'Content server catalogs')

  const catalogs = {}
  for (const [rawType, rawEntry] of Object.entries(input.catalogs)) {
    const contentType = CATALOG_ALIASES[rawType] || rawType
    if (!SUPPORTED_CONTENT_TYPES.includes(contentType)) continue
    const path = typeof rawEntry === 'string' ? rawEntry : rawEntry?.url
    if (!path) continue
    catalogs[contentType] = resolvePublicUrl(path, manifestUrl)
  }
  if (!Object.keys(catalogs).length) {
    throw new Error('The content server does not publish a supported catalog.')
  }

  return {
    schemaVersion: CONTENT_PROTOCOL_VERSION,
    kind: CONTENT_SERVER_KIND,
    id: String(input.id),
    name: String(input.name).trim(),
    description: String(input.description || '').trim(),
    publisher: String(input.publisher || '').trim(),
    website: input.website ? resolvePublicUrl(input.website, manifestUrl) : '',
    updatedAt: input.updatedAt || null,
    icon: input.icon ? resolvePublicUrl(input.icon, manifestUrl) : '',
    catalogs,
  }
}

export function validateContentCatalog(input, expectedType, catalogUrl) {
  assertPlainObject(input, `${expectedType} catalog`)
  if (Number(input.schemaVersion) !== CONTENT_PROTOCOL_VERSION) {
    throw new Error(`${expectedType} catalog uses an unsupported schema version.`)
  }
  const contentType = CATALOG_ALIASES[input.contentType] || input.contentType
  if (contentType !== expectedType) {
    throw new Error(`Expected a ${expectedType} catalog, received ${contentType || 'unknown'}.`)
  }
  if (!Array.isArray(input.items)) throw new Error(`${expectedType} catalog items must be an array.`)

  const seen = new Set()
  const items = input.items.map((item, index) => {
    assertPlainObject(item, `${expectedType} item ${index + 1}`)
    const id = String(item.id || '')
    if (!ID_PATTERN.test(id)) throw new Error(`${expectedType} item ${index + 1} has an invalid id.`)
    if (seen.has(id)) throw new Error(`${expectedType} catalog repeats item id “${id}”.`)
    seen.add(id)
    if (!String(item.title || '').trim()) throw new Error(`${expectedType} item “${id}” is missing a title.`)

    const rawContent = item.content && typeof item.content === 'object'
      ? item.content
      : { url: item.contentUrl || item.url, mediaType: item.mediaType }
    if (!rawContent?.url) throw new Error(`${expectedType} item “${id}” is missing content.url.`)

    return {
      ...item,
      id,
      title: String(item.title).trim(),
      description: String(item.description || '').trim(),
      content: {
        ...rawContent,
        url: resolvePublicUrl(rawContent.url, catalogUrl),
        mediaType: String(rawContent.mediaType || 'application/octet-stream'),
      },
      artwork: item.artwork ? resolvePublicUrl(item.artwork, catalogUrl) : '',
    }
  })

  return {
    schemaVersion: CONTENT_PROTOCOL_VERSION,
    contentType: expectedType,
    updatedAt: input.updatedAt || null,
    items,
  }
}

export function makeRemoteContentKey(serverId, contentType, itemId) {
  return `remote--${serverId}--${contentType}--${itemId}`
}

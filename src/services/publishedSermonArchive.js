import { SERMON_PUBLIC_MEDIA_TYPE } from './sermonCatalog.js'
import { createAnonymousSermonPublicationGateway } from './sermonPublicationGateway.js'

const CATALOG_REFRESH_INTERVAL_MS = 5 * 60 * 1000

function abortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('The published sermon archive request was cancelled.', 'AbortError')
  }
  const error = new Error('The published sermon archive request was cancelled.')
  error.name = 'AbortError'
  return error
}

function sourceKey(source) {
  return `${source.serverId}\u0000${source.catalogUrl}`
}

function normalizeSource(source) {
  if (
    !source
    || typeof source !== 'object'
    || typeof source.serverId !== 'string'
    || !source.serverId
    || typeof source.serverName !== 'string'
    || !source.serverName
    || typeof source.catalogUrl !== 'string'
    || !source.catalogUrl
    || source.detailMediaType !== SERMON_PUBLIC_MEDIA_TYPE
  ) {
    throw new Error('The sermon publication source marker is invalid.')
  }
  return {
    serverId: source.serverId,
    serverName: source.serverName,
    catalogUrl: source.catalogUrl,
    detailMediaType: source.detailMediaType,
  }
}

function publicMessage(error) {
  if (error?.code === 'CRYPTO_UNAVAILABLE') {
    return 'This device cannot verify published sermon checksums.'
  }
  return 'The published sermon catalog could not be verified from this source.'
}

function enrichCatalogItem(item, source, key) {
  return Object.freeze({
    publicId: item.id,
    sermonId: item.sermonId,
    sermonRevision: item.sermonRevision,
    checksum: item.checksum,
    title: item.title,
    titles: item.titles,
    defaultLanguage: item.defaultLanguage,
    speaker: item.speaker,
    serviceDate: item.serviceDate,
    series: item.series,
    references: item.references,
    contentUrl: item.content.url,
    sourceKey: key,
    sourceServerId: source.serverId,
    sourceServerName: source.serverName,
  })
}

function sortEntries(left, right) {
  return right.serviceDate.localeCompare(left.serviceDate)
    || left.title.localeCompare(right.title)
    || left.sourceServerName.localeCompare(right.sourceServerName)
    || left.publicId.localeCompare(right.publicId)
}

export class PublishedSermonArchive {
  #gatewayFactory

  #gateways = new Map()

  #lastRefreshAttemptAt = new Map()

  #verifiedSources = new Set()

  #refreshWarnings = new Map()

  constructor({ gatewayFactory = createAnonymousSermonPublicationGateway } = {}) {
    if (typeof gatewayFactory !== 'function') {
      throw new Error('Published sermon archive needs a gateway factory.')
    }
    this.#gatewayFactory = gatewayFactory
  }

  async load({
    sources = [],
    signal,
    forceRefresh = false,
  } = {}) {
    if (signal?.aborted) throw abortError()

    const rawSources = Array.isArray(sources) ? sources : []
    const uniqueSources = new Map()
    const sourceErrors = []
    for (const rawSource of rawSources) {
      try {
        const source = normalizeSource(rawSource)
        uniqueSources.set(sourceKey(source), source)
      } catch (error) {
        sourceErrors.push(Object.freeze({
          serverId: String(rawSource?.serverId || ''),
          serverName: String(rawSource?.serverName || 'Unknown source'),
          message: publicMessage(error),
        }))
      }
    }

    const activeSourceKeys = new Set(uniqueSources.keys())
    for (const key of this.#gateways.keys()) {
      if (!activeSourceKeys.has(key)) this.#gateways.delete(key)
    }
    for (const key of this.#lastRefreshAttemptAt.keys()) {
      if (!activeSourceKeys.has(key)) this.#lastRefreshAttemptAt.delete(key)
    }
    for (const key of this.#verifiedSources) {
      if (!activeSourceKeys.has(key)) this.#verifiedSources.delete(key)
    }
    for (const key of this.#refreshWarnings.keys()) {
      if (!activeSourceKeys.has(key)) this.#refreshWarnings.delete(key)
    }

    const results = await Promise.all([...uniqueSources].map(async ([key, source]) => {
      try {
        if (signal?.aborted) throw abortError()
        let gateway = this.#gateways.get(key)
        if (!gateway) {
          gateway = this.#gatewayFactory({ catalogUrl: source.catalogUrl })
          this.#gateways.set(key, gateway)
        }
        const lastRefreshAttemptAt = this.#lastRefreshAttemptAt.get(key) || 0
        if (
          forceRefresh
          || !this.#verifiedSources.has(key)
          || Date.now() - lastRefreshAttemptAt >= CATALOG_REFRESH_INTERVAL_MS
        ) {
          this.#lastRefreshAttemptAt.set(key, Date.now())
          try {
            await gateway.refreshCatalog({ signal })
            this.#verifiedSources.add(key)
            this.#refreshWarnings.delete(key)
          } catch (error) {
            if (signal?.aborted) throw abortError()
            if (!this.#verifiedSources.has(key)) throw error
            if (error?.code !== 'CATALOG_REFRESH_SUPERSEDED') {
              this.#refreshWarnings.set(key, Object.freeze({
                serverId: source.serverId,
                serverName: source.serverName,
                message: 'Using a previously verified sermon catalog because its latest refresh failed.',
              }))
            }
          }
        }
        const snapshot = gateway.getCatalogSnapshot()
        const entries = snapshot.catalog.items.map(item => enrichCatalogItem(item, source, key))
        return {
          source,
          key,
          entries,
          error: null,
          warning: this.#refreshWarnings.get(key) || null,
        }
      } catch (error) {
        if (signal?.aborted) throw abortError()
        return {
          source,
          key,
          entries: [],
          warning: null,
          error: Object.freeze({
            serverId: source.serverId,
            serverName: source.serverName,
            message: publicMessage(error),
          }),
        }
      }
    }))
    if (signal?.aborted) throw abortError()

    const entries = results.flatMap(result => result.entries).sort(sortEntries)
    const errors = [
      ...sourceErrors,
      ...results.flatMap(result => result.error ? [result.error] : []),
    ]
    const warnings = results.flatMap(result => result.warning ? [result.warning] : [])
    const successfulSourceCount = results.filter(result => !result.error).length
    return Object.freeze({
      status: successfulSourceCount === 0 && errors.length > 0 ? 'error' : 'ready',
      entries: Object.freeze(entries),
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      sourceCount: rawSources.length,
      successfulSourceCount,
    })
  }

  async getDetail(match, { signal } = {}) {
    if (
      !match
      || typeof match.sourceKey !== 'string'
      || typeof match.publicId !== 'string'
      || typeof match.sermonId !== 'string'
      || typeof match.sermonRevision !== 'string'
      || typeof match.checksum !== 'string'
    ) {
      throw new Error('Choose a verified published sermon first.')
    }
    const gateway = this.#gateways.get(match.sourceKey)
    if (!gateway) {
      throw new Error('Refresh the published sermon archive before opening this sermon.')
    }
    const verified = await gateway.getSermonDetail(match.publicId, { signal })
    if (
      verified?.item?.id !== match.publicId
      || verified.item.sermonId !== match.sermonId
      || verified.item.sermonRevision !== match.sermonRevision
      || verified.item.checksum !== match.checksum
    ) {
      throw new Error('This sermon publication changed. Refresh the archive before opening it.')
    }
    return verified
  }
}

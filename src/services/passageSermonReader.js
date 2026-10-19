import { normalizeCanonicalBibleRange } from '../utils/canonicalBibleRanges.js'
import { SERMON_PUBLIC_MEDIA_TYPE } from './sermonCatalog.js'
import { createAnonymousSermonPublicationGateway } from './sermonPublicationGateway.js'

const CATALOG_REFRESH_INTERVAL_MS = 5 * 60 * 1000

function abortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('The passage sermon request was cancelled.', 'AbortError')
  }
  const error = new Error('The passage sermon request was cancelled.')
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
  return 'Published sermons could not be verified from this source.'
}

function enrichMatch(match, source, key) {
  return Object.freeze({
    ...match,
    sourceKey: key,
    sourceServerId: source.serverId,
    sourceServerName: source.serverName,
  })
}

function sortMatches(left, right) {
  return right.serviceDate.localeCompare(left.serviceDate)
    || left.title.localeCompare(right.title)
    || left.sourceServerName.localeCompare(right.sourceServerName)
    || left.publicId.localeCompare(right.publicId)
}

export class PassageSermonReader {
  #gatewayFactory

  #gateways = new Map()

  #lastRefreshAttemptAt = new Map()

  #verifiedSources = new Set()

  #refreshWarnings = new Map()

  constructor({ gatewayFactory = createAnonymousSermonPublicationGateway } = {}) {
    if (typeof gatewayFactory !== 'function') {
      throw new Error('Passage sermon reader needs a gateway factory.')
    }
    this.#gatewayFactory = gatewayFactory
  }

  async query({
    sources = [],
    range = null,
    signal,
    forceRefresh = false,
  } = {}) {
    if (!range || !Array.isArray(sources) || sources.length === 0) {
      return Object.freeze({
        status: 'ready',
        primary: Object.freeze([]),
        mentioned: Object.freeze([]),
        errors: Object.freeze([]),
        warnings: Object.freeze([]),
      })
    }
    const canonicalRange = normalizeCanonicalBibleRange(range)
    if (signal?.aborted) throw abortError()

    const uniqueSources = new Map()
    const sourceErrors = []
    for (const rawSource of sources) {
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
      if (activeSourceKeys.has(key)) continue
      this.#gateways.delete(key)
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
        const matches = await gateway.querySermonsForRange(canonicalRange)
        return {
          source,
          key,
          primary: matches.primary.map(match => enrichMatch(match, source, key)),
          mentioned: matches.mentioned.map(match => enrichMatch(match, source, key)),
          error: null,
          warning: this.#refreshWarnings.get(key) || null,
        }
      } catch (error) {
        if (signal?.aborted) throw abortError()
        return {
          source,
          key,
          primary: [],
          mentioned: [],
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

    const primary = results.flatMap(result => result.primary).sort(sortMatches)
    const mentioned = results.flatMap(result => result.mentioned).sort(sortMatches)
    const errors = [
      ...sourceErrors,
      ...results.flatMap(result => result.error ? [result.error] : []),
    ]
    const warnings = results.flatMap(result => result.warning ? [result.warning] : [])
    const successfulSourceCount = results.filter(result => !result.error).length
    return Object.freeze({
      status: successfulSourceCount === 0 && errors.length > 0 ? 'error' : 'ready',
      primary: Object.freeze(primary),
      mentioned: Object.freeze(mentioned),
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
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
      throw new Error('Choose a verified sermon result first.')
    }
    const gateway = this.#gateways.get(match.sourceKey)
    if (!gateway) {
      throw new Error('Refresh this passage before opening the sermon.')
    }
    const verified = await gateway.getSermonDetail(match.publicId, { signal })
    if (
      verified?.item?.id !== match.publicId
      || verified.item.sermonId !== match.sermonId
      || verified.item.sermonRevision !== match.sermonRevision
      || verified.item.checksum !== match.checksum
    ) {
      throw new Error('This sermon publication changed. Refresh the passage before opening it.')
    }
    return verified
  }
}

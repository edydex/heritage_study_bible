import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PublishedSermonArchive } from '../services/publishedSermonArchive.js'

const INITIAL_STATE = Object.freeze({
  status: 'loading',
  entries: Object.freeze([]),
  errors: Object.freeze([]),
  warnings: Object.freeze([]),
  sourceCount: 0,
  successfulSourceCount: 0,
})

export function usePublishedSermonArchive({ sources }) {
  const archiveRef = useRef(null)
  if (!archiveRef.current) archiveRef.current = new PublishedSermonArchive()

  const [state, setState] = useState(INITIAL_STATE)
  const [retryToken, setRetryToken] = useState(0)
  const forceRefreshRef = useRef(false)
  const previousSourcesKeyRef = useRef(null)
  const safeSources = Array.isArray(sources) ? sources : []
  const sourcesKey = useMemo(
    () => safeSources
      .map(source => [
        source.serverId,
        source.catalogUrl,
        source.subscriptionRevision || '',
      ].join('\u0000'))
      .sort()
      .join('\u0001'),
    [safeSources],
  )
  const requestKey = `${sourcesKey}\u0002${retryToken}`

  useEffect(() => {
    const controller = new AbortController()
    const sourcesChanged = previousSourcesKeyRef.current !== null
      && previousSourcesKeyRef.current !== sourcesKey
    previousSourcesKeyRef.current = sourcesKey
    const forceRefresh = forceRefreshRef.current || sourcesChanged
    forceRefreshRef.current = false
    setState({ ...INITIAL_STATE, sourceCount: safeSources.length, requestKey })

    archiveRef.current.load({
      sources: safeSources,
      signal: controller.signal,
      forceRefresh,
    })
      .then(result => {
        if (!controller.signal.aborted) setState({ ...result, requestKey })
      })
      .catch(error => {
        if (controller.signal.aborted || error?.name === 'AbortError') return
        setState({
          status: 'error',
          entries: [],
          errors: [{
            serverId: '',
            serverName: 'Published sermons',
            message: 'Published sermon catalogs could not be verified right now.',
          }],
          warnings: [],
          sourceCount: safeSources.length,
          successfulSourceCount: 0,
          requestKey,
        })
      })

    return () => controller.abort()
  }, [retryToken, sourcesKey])

  const refresh = useCallback(() => {
    forceRefreshRef.current = true
    setRetryToken(value => value + 1)
  }, [])
  const loadDetail = useCallback(
    (match, options) => archiveRef.current.getDetail(match, options),
    [],
  )
  const visibleState = state.requestKey === requestKey
    ? state
    : { ...INITIAL_STATE, sourceCount: safeSources.length }

  return {
    ...visibleState,
    refresh,
    loadDetail,
  }
}

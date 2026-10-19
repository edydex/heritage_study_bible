import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PassageSermonReader } from '../services/passageSermonReader.js'
import { canonicalBibleRangeKey } from '../utils/sermonPassageSelection.js'

const INITIAL_STATE = Object.freeze({
  status: 'loading',
  primary: Object.freeze([]),
  mentioned: Object.freeze([]),
  errors: Object.freeze([]),
  warnings: Object.freeze([]),
})

export function usePassageSermons({ sources, range }) {
  const readerRef = useRef(null)
  if (!readerRef.current) readerRef.current = new PassageSermonReader()

  const [state, setState] = useState(INITIAL_STATE)
  const [retryToken, setRetryToken] = useState(0)
  const forceRefreshRef = useRef(false)
  const previousSourcesKeyRef = useRef(null)
  const rangeKey = canonicalBibleRangeKey(range)
  const sourcesKey = useMemo(
    () => sources
      .map(source => [
        source.serverId,
        source.catalogUrl,
        source.subscriptionRevision || '',
      ].join('\u0000'))
      .sort()
      .join('\u0001'),
    [sources],
  )
  const requestKey = `${rangeKey}\u0002${sourcesKey}\u0002${retryToken}`

  useEffect(() => {
    const controller = new AbortController()
    const sourcesChanged = previousSourcesKeyRef.current !== null
      && previousSourcesKeyRef.current !== sourcesKey
    previousSourcesKeyRef.current = sourcesKey
    const forceRefresh = forceRefreshRef.current || sourcesChanged
    forceRefreshRef.current = false
    setState({ ...INITIAL_STATE, requestKey })

    readerRef.current.query({
      sources,
      range,
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
          primary: [],
          mentioned: [],
          errors: [{
            serverId: '',
            serverName: 'Published sermons',
            message: 'Published sermons could not be verified right now.',
          }],
          warnings: [],
          requestKey,
        })
      })

    return () => controller.abort()
  }, [rangeKey, retryToken, sourcesKey])

  const retry = useCallback(() => {
    forceRefreshRef.current = true
    setRetryToken(value => value + 1)
  }, [])
  const loadDetail = useCallback(
    (match, options) => readerRef.current.getDetail(match, options),
    [],
  )
  const visibleState = state.requestKey === requestKey ? state : INITIAL_STATE

  return {
    ...visibleState,
    retry,
    loadDetail,
  }
}

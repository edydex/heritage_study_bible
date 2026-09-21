import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublishedSermonArchive } from './usePublishedSermonArchive.js'

const archiveMocks = vi.hoisted(() => ({
  load: vi.fn(),
  getDetail: vi.fn(),
}))

vi.mock('../services/publishedSermonArchive.js', () => ({
  PublishedSermonArchive: class {
    load = archiveMocks.load

    getDetail = archiveMocks.getDetail
  },
}))

const SOURCE = Object.freeze({
  serverId: 'example-church',
  serverName: 'Example Church',
  catalogUrl: 'https://church.example/publications/sermons/catalog.json',
  detailMediaType: 'application/vnd.heritage.sermon+json',
})

function resultFor(title) {
  return {
    status: 'ready',
    entries: [{ title }],
    errors: [],
    warnings: [],
    sourceCount: 1,
    successfulSourceCount: 1,
  }
}

describe('usePublishedSermonArchive', () => {
  beforeEach(() => {
    archiveMocks.load.mockReset()
    archiveMocks.getDetail.mockReset()
  })

  it('does not let an older source load replace the current archive', async () => {
    let resolveFirst
    let resolveSecond
    archiveMocks.load
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve }))

    const view = renderHook(
      props => usePublishedSermonArchive(props),
      { initialProps: { sources: [SOURCE] } },
    )
    const changedSource = {
      ...SOURCE,
      catalogUrl: 'https://church.example/publications/sermons/catalog-v2.json',
    }
    view.rerender({ sources: [changedSource] })

    await act(async () => {
      resolveSecond(resultFor('Current archive'))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(view.result.current.entries[0]?.title).toBe('Current archive')
    })

    await act(async () => {
      resolveFirst(resultFor('Late old archive'))
      await Promise.resolve()
    })
    expect(view.result.current.entries[0]?.title).toBe('Current archive')
  })

  it('forces catalog verification for changed sources and explicit refresh', async () => {
    archiveMocks.load.mockResolvedValue(resultFor('Published sermon'))
    const view = renderHook(
      props => usePublishedSermonArchive(props),
      { initialProps: { sources: [SOURCE] } },
    )
    await waitFor(() => expect(archiveMocks.load).toHaveBeenCalledTimes(1))
    expect(archiveMocks.load.mock.calls[0][0].forceRefresh).toBe(false)

    const refreshedSource = {
      ...SOURCE,
      subscriptionRevision: '2026-07-29T20:15:30.000Z',
    }
    view.rerender({ sources: [refreshedSource] })
    await waitFor(() => expect(archiveMocks.load).toHaveBeenCalledTimes(2))
    expect(archiveMocks.load.mock.calls[1][0].forceRefresh).toBe(true)

    act(() => view.result.current.refresh())
    await waitFor(() => expect(archiveMocks.load).toHaveBeenCalledTimes(3))
    expect(archiveMocks.load.mock.calls[2][0].forceRefresh).toBe(true)
  })

  it('keeps exact detail loading on the same archive instance', async () => {
    archiveMocks.load.mockResolvedValue(resultFor('Published sermon'))
    archiveMocks.getDetail.mockResolvedValue({ detail: { publicId: 'sermon-one' } })
    const match = { publicId: 'sermon-one' }
    const options = { signal: new AbortController().signal }
    const view = renderHook(() => usePublishedSermonArchive({ sources: [SOURCE] }))
    await waitFor(() => expect(view.result.current.status).toBe('ready'))

    await expect(view.result.current.loadDetail(match, options)).resolves.toEqual({
      detail: { publicId: 'sermon-one' },
    })
    expect(archiveMocks.getDetail).toHaveBeenCalledWith(match, options)
  })
})

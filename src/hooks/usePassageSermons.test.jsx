import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePassageSermons } from './usePassageSermons.js'

const readerMocks = vi.hoisted(() => ({
  query: vi.fn(),
  getDetail: vi.fn(),
}))

vi.mock('../services/passageSermonReader.js', () => ({
  PassageSermonReader: class {
    query = readerMocks.query

    getDetail = readerMocks.getDetail
  },
}))

const SOURCE = Object.freeze({
  serverId: 'example-church',
  serverName: 'Example Church',
  catalogUrl: 'https://church.example/publications/sermons/catalog.json',
  detailMediaType: 'application/vnd.heritage.sermon+json',
})

function range(verse) {
  return {
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse },
    end: { chapter: 3, verse },
  }
}

function resultFor(title) {
  return {
    status: 'ready',
    primary: [{ title }],
    mentioned: [],
    errors: [],
    warnings: [],
  }
}

describe('usePassageSermons', () => {
  beforeEach(() => {
    readerMocks.query.mockReset()
    readerMocks.getDetail.mockReset()
  })

  it('never lets a late A passage result paint over the newer B selection', async () => {
    let resolveA
    let resolveB
    readerMocks.query
      .mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve }))

    const view = renderHook(
      props => usePassageSermons(props),
      {
        initialProps: {
          sources: [SOURCE],
          range: range(18),
        },
      },
    )
    view.rerender({
      sources: [SOURCE],
      range: range(19),
    })

    await act(async () => {
      resolveB(resultFor('Passage B'))
      await Promise.resolve()
    })
    await waitFor(() => expect(view.result.current.primary[0]?.title).toBe('Passage B'))

    await act(async () => {
      resolveA(resultFor('Late passage A'))
      await Promise.resolve()
    })
    expect(view.result.current.primary[0]?.title).toBe('Passage B')
  })

  it('queries again for changed source identity and forces an explicit refresh', async () => {
    readerMocks.query.mockResolvedValue(resultFor('Current passage'))
    const view = renderHook(
      props => usePassageSermons(props),
      {
        initialProps: {
          sources: [SOURCE],
          range: range(18),
        },
      },
    )
    await waitFor(() => expect(readerMocks.query).toHaveBeenCalledTimes(1))

    const changedSource = {
      ...SOURCE,
      catalogUrl: 'https://church.example/publications/sermons/catalog-v2.json',
    }
    view.rerender({
      sources: [changedSource],
      range: range(18),
    })
    await waitFor(() => expect(readerMocks.query).toHaveBeenCalledTimes(2))
    expect(readerMocks.query.mock.calls[1][0].sources[0].catalogUrl).toBe(changedSource.catalogUrl)
    expect(readerMocks.query.mock.calls[1][0].forceRefresh).toBe(true)

    const refreshedSource = {
      ...changedSource,
      subscriptionRevision: '2026-07-28T20:15:30.000Z',
    }
    view.rerender({
      sources: [refreshedSource],
      range: range(18),
    })
    await waitFor(() => expect(readerMocks.query).toHaveBeenCalledTimes(3))
    expect(readerMocks.query.mock.calls[2][0].forceRefresh).toBe(true)

    act(() => view.result.current.retry())
    await waitFor(() => expect(readerMocks.query).toHaveBeenCalledTimes(4))
    expect(readerMocks.query.mock.calls[3][0].forceRefresh).toBe(true)
  })
})

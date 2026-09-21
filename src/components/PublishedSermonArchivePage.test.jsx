import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublishedSermonArchive } from '../hooks/usePublishedSermonArchive.js'
import PublishedSermonArchivePage from './PublishedSermonArchivePage.jsx'

const contentServerMocks = vi.hoisted(() => ({
  getSources: vi.fn(),
  getCommunities: vi.fn(),
}))

vi.mock('../services/communities.js', () => ({ COMMUNITIES_CHANGE_EVENT: 'communities-change', getCommunities: contentServerMocks.getCommunities }))

vi.mock('../hooks/usePublishedSermonArchive.js', () => ({
  usePublishedSermonArchive: vi.fn(),
}))

vi.mock('../services/contentServers.js', () => ({
  CONTENT_SERVERS_CHANGE_EVENT: 'heritage-content-servers-change',
  getPublicSermonPublicationSources: contentServerMocks.getSources,
}))

const SOURCE = Object.freeze({
  serverId: 'example-church',
  serverName: 'Example Church',
  catalogUrl: 'https://church.example/publications/sermons/catalog.json',
  detailMediaType: 'application/vnd.heritage.sermon+json',
})

const PRIMARY_RANGE = Object.freeze({
  schemaVersion: 1,
  bookId: 'Eph',
  start: { chapter: 3, verse: 14 },
  end: { chapter: 3, verse: 21 },
})

const MENTIONED_RANGE = Object.freeze({
  schemaVersion: 1,
  bookId: 'Eph',
  start: { chapter: 5, verse: 2 },
  end: { chapter: 5, verse: 2 },
})

function sermonEntry(overrides = {}) {
  return {
    publicId: 'sermon-one',
    sermonId: 'sermon:one',
    sermonRevision: 'a'.repeat(64),
    checksum: 'b'.repeat(64),
    title: 'The Prayer That Transforms the Church',
    titles: {
      en: 'The Prayer That Transforms the Church',
      ru: 'Молитва, преображающая Церковь',
    },
    defaultLanguage: 'en',
    speaker: { name: 'Paul Lvutin' },
    serviceDate: '2026-07-26',
    series: {
      titles: {
        en: 'From Pain to Unity',
        ru: 'От боли к единству',
      },
    },
    references: [
      { role: 'primary', range: PRIMARY_RANGE },
      { role: 'mentioned', range: MENTIONED_RANGE },
    ],
    contentUrl: '/content/sermons/sermon-one',
    sourceKey: `example-church\u0000${SOURCE.catalogUrl}`,
    sourceServerId: SOURCE.serverId,
    sourceServerName: SOURCE.serverName,
    ...overrides,
  }
}

function readyState(overrides = {}) {
  return {
    status: 'ready',
    entries: [],
    errors: [],
    warnings: [],
    sourceCount: 1,
    successfulSourceCount: 1,
    refresh: vi.fn(),
    loadDetail: vi.fn(),
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Current route">{location.pathname}{location.search}</output>
}

function renderArchive(initialEntry = '/resources/sermons') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/resources/sermons"
          element={<><PublishedSermonArchivePage /><LocationProbe /></>}
        />
        <Route
          path="/resources/sermons/:serverId/:publicId"
          element={<><PublishedSermonArchivePage /><LocationProbe /></>}
        />
        <Route path="/settings/content-servers" element={<LocationProbe />} />
        <Route path="/genesis/1" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublishedSermonArchivePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contentServerMocks.getCommunities.mockReturnValue([])
    contentServerMocks.getSources.mockReturnValue([SOURCE])
    usePublishedSermonArchive.mockReturnValue(readyState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading, no-source, partial-error, stale-catalog, and refresh states', () => {
    usePublishedSermonArchive.mockReturnValue({
      ...readyState(),
      status: 'loading',
    })
    const view = renderArchive()
    expect(screen.getByText('Verifying published sermon catalogs…')).toBeInTheDocument()

    const refresh = vi.fn()
    contentServerMocks.getSources.mockReturnValue([])
    usePublishedSermonArchive.mockReturnValue(readyState({
      sourceCount: 0,
      successfulSourceCount: 0,
      refresh,
    }))
    view.rerender(
      <MemoryRouter initialEntries={['/resources/sermons']}>
        <Routes>
          <Route path="/resources/sermons" element={<PublishedSermonArchivePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('No published sermon sources are installed')).toBeInTheDocument()

    contentServerMocks.getSources.mockReturnValue([SOURCE])
    usePublishedSermonArchive.mockReturnValue(readyState({
      entries: [sermonEntry()],
      errors: [{ serverId: 'offline-church' }],
      warnings: [{ serverId: SOURCE.serverId }],
      refresh,
    }))
    view.rerender(
      <MemoryRouter initialEntries={['/resources/sermons']}>
        <Routes>
          <Route path="/resources/sermons" element={<PublishedSermonArchivePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Some connected sermon sources could not be verified/)).toBeInTheDocument()
    expect(screen.getByText(/previously verified sermon catalog/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('searches localized titles, speaker, series, and Scripture while showing source identity', () => {
    const newer = sermonEntry()
    const older = sermonEntry({
      publicId: 'sermon-two',
      sermonId: 'sermon:two',
      title: 'Walking Wisely',
      titles: { en: 'Walking Wisely' },
      speaker: { name: 'Other Pastor' },
      serviceDate: '2026-07-20',
      series: null,
      references: [{ role: 'primary', range: MENTIONED_RANGE }],
    })
    usePublishedSermonArchive.mockReturnValue(readyState({
      entries: [newer, older],
    }))
    renderArchive()

    expect(screen.getByText('Молитва, преображающая Церковь')).toBeInTheDocument()
    expect(screen.getAllByText('Example Church').length).toBeGreaterThan(0)
    expect(screen.getByText('Ephesians 3:14–21')).toBeInTheDocument()
    expect(screen.getByText('Ephesians 5:2 · mentioned')).toBeInTheDocument()

    const search = screen.getByRole('searchbox', { name: 'Search published sermons' })
    fireEvent.change(search, { target: { value: 'От боли к единству' } })
    expect(screen.getByText('The Prayer That Transforms the Church')).toBeInTheDocument()
    expect(screen.queryByText('Walking Wisely')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'Other Pastor' } })
    expect(screen.queryByText('The Prayer That Transforms the Church')).not.toBeInTheDocument()
    expect(screen.getByText('Walking Wisely')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'Ephesians 3:14' } })
    expect(screen.getByText('The Prayer That Transforms the Church')).toBeInTheDocument()
    expect(screen.queryByText('Walking Wisely')).not.toBeInTheDocument()
  })

  it('opens a stable deep link and the exact verified viewer, then closes back to the archive', async () => {
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const entry = sermonEntry()
    const loadDetail = vi.fn().mockResolvedValue({
      detail: {
        publicId: entry.publicId,
        titles: entry.titles,
        defaultLanguage: entry.defaultLanguage,
        speaker: entry.speaker,
        serviceDate: entry.serviceDate,
        series: entry.series,
        references: entry.references,
        body: [{
          kind: 'slide-notes',
          language: 'en',
          text: 'Reviewed sermon notes.',
        }],
        media: [{
          kind: 'audio',
          title: 'Sermon audio',
          language: 'en',
          mediaType: 'audio/mpeg',
          durationSeconds: 60,
          url: 'https://media.church.example/sermons/one.mp3',
        }],
        canonicalUrl: null,
      },
    })
    usePublishedSermonArchive.mockReturnValue(readyState({
      entries: [entry],
      loadDetail,
    }))
    renderArchive()

    fireEvent.click(screen.getByRole('button', {
      name: 'Open The Prayer That Transforms the Church from Example Church',
    }))
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/resources/sermons/example-church/sermon-one',
    )
    const player = await screen.findByLabelText('Play Sermon audio (EN)')
    expect(player).toHaveAttribute('preload', 'none')
    expect(player).not.toHaveAttribute('autoplay')
    expect(loadDetail).toHaveBeenCalledWith(entry, {
      signal: expect.any(AbortSignal),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close sermon viewer' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/resources/sermons')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(pauseSpy).toHaveBeenCalled()
    expect(loadSpy).toHaveBeenCalled()
  })

  it('fails closed when a deep link is not in an installed verified catalog', () => {
    const loadDetail = vi.fn()
    usePublishedSermonArchive.mockReturnValue(readyState({
      entries: [sermonEntry()],
      loadDetail,
    }))
    renderArchive('/resources/sermons/unknown-server/unknown-sermon')

    expect(screen.getByRole('alert')).toHaveTextContent('This published sermon is unavailable')
    expect(loadDetail).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Return to the sermon archive' }))
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/resources/sermons')
  })
})


it('limits a church-scoped archive to that church and preserves the scope when opening a sermon', async () => {
  contentServerMocks.getCommunities.mockReturnValue([{ manifest: { id: 'church', name: 'My Church' }, contentPreview: { manifest: { id: SOURCE.serverId } } }])
  contentServerMocks.getSources.mockReturnValue([SOURCE, { ...SOURCE, serverId: 'other-church' }])
  usePublishedSermonArchive.mockReturnValue(readyState({ entries: [sermonEntry()], loadDetail: vi.fn().mockRejectedValue(new Error('Detail unavailable')) }))
  renderArchive('/resources/sermons?community=church')
  expect(usePublishedSermonArchive).toHaveBeenLastCalledWith({ sources: [SOURCE] })
  fireEvent.click(screen.getByRole('button', { name: /Open The Prayer/ }))
  await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/resources/sermons/example-church/sermon-one?community=church'))
})

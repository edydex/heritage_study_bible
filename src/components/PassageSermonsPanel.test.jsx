import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePassageSermons } from '../hooks/usePassageSermons.js'
import PassageSermonsPanel from './PassageSermonsPanel.jsx'

vi.mock('../hooks/usePassageSermons.js', () => ({
  usePassageSermons: vi.fn(),
}))

const PUBLICATION_SOURCE = Object.freeze({
  serverId: 'example-church',
  serverName: 'Example Church',
  catalogUrl: 'https://church.example/publications/sermons/catalog.json',
  detailMediaType: 'application/vnd.heritage.sermon+json',
})

function sermonMatch(publicId, title) {
  return {
    publicId,
    sourceKey: `example-church\u0000${PUBLICATION_SOURCE.catalogUrl}`,
    sourceServerId: 'example-church',
    sourceServerName: 'Example Church',
    title,
    speaker: { name: 'Example Pastor' },
    serviceDate: '2026-07-26',
  }
}

function readyState(overrides = {}) {
  return {
    status: 'ready',
    primary: [],
    mentioned: [],
    errors: [],
    warnings: [],
    retry: vi.fn(),
    loadDetail: vi.fn(),
    ...overrides,
  }
}

function renderPanel(overrides = {}) {
  return render(
    <PassageSermonsPanel
      publicationSources={[PUBLICATION_SOURCE]}
      selectedVerse={{ book: 'Ephesians', chapter: 3, verse: 18 }}
      selectedVerses={[{ book: 'Ephesians', chapter: 3, verse: 18 }]}
      bookName="Ephesians"
      {...overrides}
    />,
  )
}

describe('PassageSermonsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePassageSermons.mockReturnValue(readyState())
  })

  it('renders nothing and starts no passage reader without a strict publication source', () => {
    const { container } = render(
      <PassageSermonsPanel
        publicationSources={[]}
        selectedVerse={{ book: 'Ephesians', chapter: 3, verse: 18 }}
        bookName="Ephesians"
      />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(usePassageSermons).not.toHaveBeenCalled()
  })

  it('promotes primary sermons and keeps mentioned-verse matches behind the small link', () => {
    usePassageSermons.mockReturnValue(readyState({
      primary: [sermonMatch('primary', 'The Prayer That Transforms the Church')],
      mentioned: [sermonMatch('mentioned', 'Walking in Love')],
    }))
    renderPanel()

    expect(screen.getByText('On this passage')).toBeInTheDocument()
    expect(screen.getByText('The Prayer That Transforms the Church')).toBeInTheDocument()
    expect(screen.queryByText('Walking in Love')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Appears in 1 sermon' }))
    expect(screen.getByText('Walking in Love')).toBeInTheDocument()
  })

  it('loads one verified detail only after selection and removes its player when the passage changes', async () => {
    const match = sermonMatch('primary-audio', 'The Prayer That Transforms the Church')
    let detailSignal
    const loadDetail = vi.fn((selected, options) => {
      detailSignal = options.signal
      return Promise.resolve({
        detail: {
          publicId: selected.publicId,
          titles: { en: selected.title },
          defaultLanguage: 'en',
          speaker: { name: 'Example Pastor' },
          serviceDate: '2026-07-26',
          series: null,
          references: [{ role: 'primary', range: {
            schemaVersion: 1,
            bookId: 'Eph',
            start: { chapter: 3, verse: 14 },
            end: { chapter: 3, verse: 21 },
          } }],
          body: [],
          media: [{
            kind: 'audio',
            title: 'Sermon audio',
            language: 'en',
            mediaType: 'audio/mpeg',
            durationSeconds: 2484,
            url: 'https://media.church.example/sermons/prayer.mp3',
          }],
          canonicalUrl: null,
        },
      })
    })
    usePassageSermons.mockReturnValue(readyState({
      primary: [match],
      loadDetail,
    }))
    const view = renderPanel()

    expect(loadDetail).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {
      name: /The Prayer That Transforms the Church/,
    }))
    expect(await screen.findByLabelText('Play Sermon audio (EN)')).toHaveAttribute(
      'preload',
      'none',
    )
    expect(loadDetail).toHaveBeenCalledWith(match, {
      signal: expect.any(AbortSignal),
    })
    expect(detailSignal.aborted).toBe(false)

    view.rerender(
      <PassageSermonsPanel
        publicationSources={[PUBLICATION_SOURCE]}
        selectedVerse={{ book: 'Ephesians', chapter: 3, verse: 19 }}
        selectedVerses={[{ book: 'Ephesians', chapter: 3, verse: 19 }]}
        bookName="Ephesians"
      />,
    )
    await waitFor(() => {
      expect(screen.queryByLabelText('Play Sermon audio (EN)')).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(detailSignal.aborted).toBe(true)
    })
  })

  it('shows loading, empty, and retryable error states accessibly', () => {
    usePassageSermons.mockReturnValue({
      ...readyState(),
      status: 'loading',
    })
    const view = renderPanel()
    expect(screen.getByRole('status')).toHaveTextContent('Verifying published sermons')

    usePassageSermons.mockReturnValue(readyState())
    view.rerender(
      <PassageSermonsPanel
        publicationSources={[PUBLICATION_SOURCE]}
        selectedVerse={{ book: 'Ephesians', chapter: 3, verse: 18 }}
        selectedVerses={[{ book: 'Ephesians', chapter: 3, verse: 18 }]}
        bookName="Ephesians"
      />,
    )
    expect(screen.getByText('No published sermons are linked to this passage yet.')).toBeInTheDocument()

    const retry = vi.fn()
    usePassageSermons.mockReturnValue({
      ...readyState({ retry }),
      status: 'error',
      errors: [{ serverId: 'example-church' }],
    })
    view.rerender(
      <PassageSermonsPanel
        publicationSources={[PUBLICATION_SOURCE]}
        selectedVerse={{ book: 'Ephesians', chapter: 3, verse: 18 }}
        selectedVerses={[{ book: 'Ephesians', chapter: 3, verse: 18 }]}
        bookName="Ephesians"
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Published sermons are unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('rejects cross-book selection before starting the reader', () => {
    renderPanel({
      selectedVerses: [
        { book: 'Malachi', chapter: 4, verse: 6 },
        { book: 'Matthew', chapter: 1, verse: 1 },
      ],
    })

    expect(screen.getByRole('status')).toHaveTextContent('within one Bible book')
    expect(usePassageSermons).not.toHaveBeenCalled()
  })
})

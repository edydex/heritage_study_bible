import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SermonViewer from './SermonViewer.jsx'

const RANGE = {
  schemaVersion: 1,
  bookId: 'Eph',
  start: { chapter: 3, verse: 14 },
  end: { chapter: 3, verse: 21 },
}

describe('SermonViewer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders only verified structured detail as text and safe external links', async () => {
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {})
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load')
      .mockImplementation(() => {})
    const loadDetail = vi.fn().mockResolvedValue({
      detail: {
        publicId: 'sermon-one',
        titles: { en: 'The Prayer That Transforms the Church' },
        defaultLanguage: 'en',
        speaker: { name: 'Example Pastor' },
        serviceDate: '2026-07-26',
        series: { titles: { en: 'From Pain to Unity' } },
        references: [
          { role: 'primary', range: RANGE },
          {
            role: 'mentioned',
            range: {
              ...RANGE,
              start: { chapter: 5, verse: 2 },
              end: { chapter: 5, verse: 2 },
            },
          },
        ],
        body: [{
          kind: 'manuscript',
          language: 'en',
          text: '<img src=x onerror="window.__unsafe=true"> Exact reviewed text.',
        }],
        media: [{
          kind: 'audio',
          title: 'Sermon audio',
          language: 'en',
          mediaType: 'audio/mpeg',
          durationSeconds: 2484.5,
          url: 'https://media.church.example/sermons/prayer.mp3',
        }, {
          kind: 'audio',
          title: 'Sermon audio',
          language: 'ru',
          mediaType: 'audio/mp4',
          durationSeconds: 1805,
          url: 'https://media-ru.church.example/sermons/prayer.m4a',
        }, {
          kind: 'audio',
          title: 'Unrecognized audio download',
          language: 'en',
          mediaType: 'application/octet-stream',
          durationSeconds: null,
          url: 'https://media.church.example/sermons/prayer.bin',
        }],
        canonicalUrl: 'https://church.example/sermons/prayer',
      },
    })
    const onClose = vi.fn()
    const view = render(
      <SermonViewer
        match={{
          publicId: 'sermon-one',
          sourceKey: 'example-source',
          sourceServerName: 'Example Church',
          title: 'Catalog title',
        }}
        loadDetail={loadDetail}
        onClose={onClose}
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(await screen.findByText('The Prayer That Transforms the Church')).toBeInTheDocument()
    expect(screen.getByText(/<img src=x onerror=/)).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()

    const englishPlayer = screen.getByLabelText('Play Sermon audio (EN)')
    const russianPlayer = screen.getByLabelText('Play Sermon audio (RU)')
    expect(englishPlayer.tagName).toBe('AUDIO')
    expect(russianPlayer.tagName).toBe('AUDIO')
    expect(document.querySelectorAll('audio')).toHaveLength(2)
    expect(englishPlayer).toHaveAttribute('controls')
    expect(englishPlayer).toHaveAttribute('preload', 'none')
    expect(englishPlayer).toHaveAttribute(
      'src',
      'https://media.church.example/sermons/prayer.mp3',
    )
    expect(englishPlayer).toHaveAttribute('tabindex', '0')
    expect(englishPlayer).not.toHaveAttribute('autoplay')
    expect(russianPlayer).toHaveAttribute(
      'src',
      'https://media-ru.church.example/sermons/prayer.m4a',
    )
    expect(englishPlayer.closest('article')).toHaveTextContent(
      'audio · EN · 41:25',
    )
    expect(englishPlayer.closest('article')).toHaveTextContent(
      'Playback connects directly to media.church.example',
    )
    expect(russianPlayer.closest('article')).toHaveTextContent(
      'audio · RU · 30:05',
    )
    expect(russianPlayer.closest('article')).toHaveTextContent(
      'Playback connects directly to media-ru.church.example',
    )

    for (const linkName of [
      'Open Sermon audio (EN) in a new tab',
      'Open Sermon audio (RU) in a new tab',
      'Open this sermon on the church website',
    ]) {
      const link = screen.getByRole('link', { name: linkName })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    const downloadLink = screen.getByRole('link', {
      name: /^Unrecognized audio download/,
    })
    expect(downloadLink).toHaveAttribute('target', '_blank')
    expect(downloadLink).toHaveAttribute('rel', 'noopener noreferrer')

    fireEvent.play(russianPlayer)
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(pauseSpy.mock.instances[0]).toBe(englishPlayer)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()

    view.unmount()
    expect(pauseSpy).toHaveBeenCalledTimes(3)
    expect(pauseSpy.mock.instances.filter(player => player === englishPlayer)).toHaveLength(2)
    expect(pauseSpy.mock.instances.filter(player => player === russianPlayer)).toHaveLength(1)
    expect(loadSpy).toHaveBeenCalledTimes(2)
    expect(loadSpy.mock.instances).toEqual(expect.arrayContaining([
      englishPlayer,
      russianPlayer,
    ]))
    expect(englishPlayer).not.toHaveAttribute('src')
    expect(russianPlayer).not.toHaveAttribute('src')
  })
})

it('lets a reader switch between published English and Russian text without changing or translating it', async () => {
  const loadDetail = vi.fn().mockResolvedValue({ detail: {
    titles: { en: 'Prayer', ru: 'Молитва' }, defaultLanguage: 'en', speaker: { name: 'Pastor' }, serviceDate: '2026-09-13', references: [], media: [],
    body: [{ kind: 'manuscript', language: 'en', text: 'Reviewed English words.' }, { kind: 'manuscript', language: 'ru', text: 'Проверенный русский текст.' }],
  } })
  render(<SermonViewer match={{ publicId: 'bilingual', sourceKey: 'church', title: 'Prayer' }} loadDetail={loadDetail} onClose={() => {}} />)
  expect(await screen.findByText('Reviewed English words.')).toBeInTheDocument()
  expect(screen.queryByText('Проверенный русский текст.')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Sermon text language'), { target: { value: 'ru' } })
  expect(screen.getByRole('heading', { name: 'Молитва' })).toBeInTheDocument()
  expect(screen.getByText('Проверенный русский текст.')).toBeInTheDocument()
  expect(screen.queryByText('Reviewed English words.')).not.toBeInTheDocument()
  expect(loadDetail).toHaveBeenCalledTimes(1)
})

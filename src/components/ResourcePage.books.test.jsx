import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ResourcePage from './ResourcePage'
import { CONTENT_SERVERS_STORAGE_KEY, getContentServerSubscriptions } from '../services/contentServers'
import { saveCommunitySession } from '../services/communitySessions'

const manifestUrl = 'https://church.example/heritage-content.json'
const manifest = { schemaVersion: 2, kind: 'heritage-content-server', id: 'church-content', name: 'Test Church', catalogs: { books: 'https://church.example/catalogs/books' } }
const church = { manifest: { id: 'church', name: 'Test Church', apiBaseUrl: 'https://church.example/api', contentServerUrl: manifestUrl }, contentPreview: { manifest } }
const book = { id: 'prayer', title: 'Community Prayer Book', author: 'Test Author', content: { url: 'https://church.example/content/books/prayer' } }
const catalog = items => ({ schemaVersion: 2, contentType: 'books', items })
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
function install(items = [], enabled = true) {
  localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify([{ enabled, manifest, manifestUrl, catalogs: { books: catalog(items) } }]))
}
function show(query = '') {
  return render(<MemoryRouter initialEntries={[`/resources/books${query}`]}><Routes>
    <Route path="/resources/:categoryId" element={<ResourcePage />} />
    <Route path="/resources/content/:contentKey" element={<p>Community book reader</p>} />
  </Routes></MemoryRouter>)
}
beforeEach(async () => {
  sessionStorage.clear()
  localStorage.setItem('heritage-communities-v1', JSON.stringify([church]))
  install()
  await saveCommunitySession('church', { token: 'test-member-session' }, church)
  vi.stubGlobal('fetch', vi.fn(async url => json(url === manifestUrl ? manifest : catalog([book]))))
})
afterEach(() => vi.unstubAllGlobals())

it('automatically adds member books beside built-in books and opens the Community reader', async () => {
  show()
  expect(screen.getByRole('heading', { name: 'Books', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('The Wars of the Jews')).toBeInTheDocument()
  expect(await screen.findByText(book.title)).toBeInTheDocument()
  expect(fetch.mock.calls).toHaveLength(2)
  expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
  expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Authorization: 'Community test-member-session' } })
  fireEvent.change(screen.getByPlaceholderText('Search title or author…'), { target: { value: 'Test Author' } })
  expect(screen.queryByText('The Wars of the Jews')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Community Prayer Book/ }))
  expect(screen.getByText('Community book reader')).toBeInTheDocument()
})

it('shows this church’s books from Community Home with a path back to all Books', async () => {
  show('?community=church')
  expect(await screen.findByText(book.title)).toBeInTheDocument()
  expect(screen.queryByText('The Wars of the Jews')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show all books' }))
  expect(await screen.findByText('The Wars of the Jews')).toBeInTheDocument()
})

it('keeps the saved list on refresh failure, then updates it when Refresh succeeds', async () => {
  install([book])
  fetch.mockRejectedValue(new TypeError('Offline'))
  show()
  expect(await screen.findByText(/Refresh failed—showing saved books/)).toBeInTheDocument()
  expect(screen.getByText(book.title)).toBeInTheDocument()
  expect(getContentServerSubscriptions()[0].catalogs.books.items).toEqual([book])
  fetch.mockImplementation(async url => json(url === manifestUrl ? manifest : catalog([])))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }))
  await waitFor(() => expect(screen.queryByText(book.title)).not.toBeInTheDocument())
  expect(await screen.findByText('Books are up to date.')).toBeInTheDocument()
})

it('refreshes membership-visible books when sign-in changes while Books is open', async () => {
  await saveCommunitySession('church', null, church)
  fetch.mockImplementation(async (url, options) => json(url === manifestUrl ? manifest : catalog(options.headers.Authorization ? [book] : [])))
  show()
  await screen.findByText('Books are up to date.')
  expect(screen.queryByText(book.title)).not.toBeInTheDocument()
  await act(() => saveCommunitySession('church', { token: 'test-member-session' }, church))
  expect(await screen.findByText(book.title)).toBeInTheDocument()
  await act(() => saveCommunitySession('church', null, church))
  await waitFor(() => expect(screen.queryByText(book.title)).not.toBeInTheDocument())
})

it('does not re-enable disabled book sources or fetch unrelated sources for a missing church', async () => {
  install([book], false)
  const view = show()
  await screen.findByText('Join a Community to add its books to this library.')
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.queryByText(book.title)).not.toBeInTheDocument()
  expect(getContentServerSubscriptions()[0].enabled).toBe(false)
  view.unmount()
  install([book])
  show('?community=removed')
  expect(screen.getByText('Community unavailable')).toBeInTheDocument()
  expect(screen.queryByText(book.title)).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import HomeRedirect from './HomeRedirect'
import { getReaderProgress } from '../services/readerProgress'
vi.mock('../services/readerProgress', () => ({ getReaderProgress: vi.fn() }))
function Location() { return <div data-testid="location">{useLocation().pathname}</div> }
function mount() {
  window.history.replaceState({}, '', '/#/')
  return render(<HashRouter><Routes><Route path="/" element={<HomeRedirect />} /><Route path="*" element={<Location />} /></Routes></HashRouter>)
}
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, '', '/') })
describe('last passage startup navigation', () => {
  it('restores a valid chapter and replaces the initial root route', async () => {
    getReaderProgress.mockResolvedValue({ bible: { book: '1 Chronicles', chapter: 3 } })
    mount()
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/1-chronicles/3'))
  })
  it('opens Genesis if the saved chapter is outside its book', async () => {
    getReaderProgress.mockResolvedValue({ bible: { book: 'Jude', chapter: 5 } })
    mount()
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/genesis/1'))
  })
  it.each(['resolve', 'reject'])('keeps an incoming audio route when pending progress %ss', async outcome => {
    let finish, fail
    getReaderProgress.mockReturnValue(new Promise((resolve, reject) => { finish = resolve; fail = reject }))
    mount()
    await act(async () => {
      // The URL changed before the router's hashchange event/React commit.
      window.history.replaceState({}, '', '/#/audio')
      if (outcome === 'resolve') finish({ bible: { book: 'John', chapter: 3 } })
      else fail(new Error('storage unavailable'))
      await Promise.resolve()
    })
    expect(window.location.hash).toBe('#/audio')
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/audio'))
  })
})

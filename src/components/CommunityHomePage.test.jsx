import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ request: vi.fn(), join: vi.fn(), records: [] }))
vi.mock('../services/communities', () => ({
  COMMUNITIES_CHANGE_EVENT: 'community-change',
  getCommunities: () => mocks.records,
  communityApiRequest: (...args) => mocks.request(...args),
  beginCommunityJoin: (...args) => mocks.join(...args),
  refreshCommunityDiscovery: vi.fn().mockResolvedValue(null),
  inspectCommunity: vi.fn(), removeCommunity: vi.fn(), savePublicCommunity: vi.fn(), setPrimaryCommunity: vi.fn(),
}))
vi.mock('./CommunityResources', () => ({ default: () => <div>Saved church resources</div> }))
import CommunityHomePage from './CommunityHomePage'
import CommunityCalendarPage from './CommunityCalendarPage'
afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [], timeZone: 'UTC', authenticated: false }) }))
  mocks.request.mockReset()
  mocks.join.mockReset()
  mocks.records = [{
    manifest: { id: 'church', name: 'Test Church', apiBaseUrl: 'https://church.example/api' },
    manifestUrl: 'https://church.example/.well-known/heritage-community.json',
    status: 'joined', primary: true, member: { displayName: 'Reader', email: 'reader@example.com' },
  }]
})
function show(path = "/community/calendar") { render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/community/calendar" element={<CommunityCalendarPage />} /><Route path="/community" element={<CommunityHomePage />} /></Routes></MemoryRouter>) }

it('offers member sign-in after an authentication failure without claiming the calendar is empty', async () => {
  mocks.request.mockRejectedValue(Object.assign(new Error('Sign in to this community again.'), { status: 401 }))
  mocks.join.mockImplementation(async (community, email) => {
    mocks.records = [{ ...community, status: 'email-sent', email }]
    return mocks.records[0]
  })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'check your church sign-in in Community Home' }))
  const signIn = await screen.findByRole('button', { name: 'Sign in again' })
  expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument()
  expect(screen.queryByText('No upcoming events.')).not.toBeInTheDocument()
  expect(screen.getByText('Saved church resources')).toBeInTheDocument()
  expect(mocks.join).not.toHaveBeenCalled()
  fireEvent.click(signIn)
  expect(screen.getByLabelText('Church sign-in email')).toHaveValue('reader@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Send church sign-in link' }))
  await screen.findByText('Waiting for email sign-in')
  expect(mocks.join).toHaveBeenCalledWith(expect.objectContaining({ manifest: expect.objectContaining({ id: 'church' }) }), 'reader@example.com')
  expect(screen.queryByRole('button', { name: 'Sign in again' })).not.toBeInTheDocument()
})

it('keeps a temporary connection failure distinct from expired membership', async () => {
  mocks.request.mockRejectedValue(new Error('Could not reach the Community server.'))
  show()
  await screen.findByText('Could not reach the Community server.')
  expect(screen.queryByRole('button', { name: 'Sign in again' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'check your church sign-in in Community Home' })).not.toBeInTheDocument()
  mocks.request.mockResolvedValue({ events: [], timeZone: 'UTC', authenticated: true })
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await waitFor(() => expect(screen.queryByText('Could not reach the Community server.')).not.toBeInTheDocument())
  expect(mocks.join).not.toHaveBeenCalled()
})

it('keeps the calendar behind its own page without fetching it on Community Home', () => {
  show('/community')
  expect(screen.queryByRole('region', { name: 'Church calendar' })).not.toBeInTheDocument()
  expect(mocks.request).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

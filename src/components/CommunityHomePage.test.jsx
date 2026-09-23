import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ request: vi.fn(), join: vi.fn(), session: vi.fn(), inspect: vi.fn(), records: [] }))
vi.mock('../services/communities', () => ({
  COMMUNITIES_CHANGE_EVENT: 'community-change',
  getCommunities: () => mocks.records,
  communityApiRequest: (...args) => mocks.request(...args),
  beginCommunityJoin: (...args) => mocks.join(...args),
  refreshCommunityDiscovery: vi.fn().mockResolvedValue(null),
  inspectCommunity: (...args) => mocks.inspect(...args), removeCommunity: vi.fn(), savePublicCommunity: vi.fn(), setPrimaryCommunity: vi.fn(),
}))
vi.mock('../services/communitySessions',()=>({COMMUNITY_SESSION_CHANGE_EVENT:'session-change',getCommunitySession:(...args)=>mocks.session(...args)}))
vi.mock('./CommunityResources', () => ({ default: () => <div>Saved church resources</div> }))
import CommunityHomePage from './CommunityHomePage'
import CommunityCalendarPage from './CommunityCalendarPage'
afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [], timeZone: 'UTC', authenticated: false }) }))
  mocks.request.mockReset()
  mocks.join.mockReset()
  mocks.inspect.mockReset()
  mocks.session.mockReset().mockResolvedValue({token:'test-session',expiresAt:'2099-01-01T00:00:00Z'})
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


it('checks local credentials on Home and offers rejoining when the saved session is absent',async()=>{
  mocks.session.mockResolvedValue(null)
  show('/community')
  await screen.findByText('Member sign-in needed')
  expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Sign in again'})).toBeInTheDocument()
  expect(mocks.request).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})
it('recognizes an expired local session without making a calendar request',async()=>{
  mocks.session.mockResolvedValue({token:'expired',expiresAt:'2000-01-01T00:00:00Z'})
  show('/community')
  await screen.findByText('Member sign-in needed')
  expect(mocks.request).not.toHaveBeenCalled()
})

it.each(['following', 'sync-only', 'email-sent'])('offers member sign-in for a saved %s church without silently sending email', async status => {
  mocks.records[0].status = status
  show('/community')
  fireEvent.click(screen.getByRole('button', { name: 'Member sign-in', exact: true }))
  expect(screen.getByLabelText('Church sign-in email')).toHaveValue('reader@example.com')
  expect(mocks.join).not.toHaveBeenCalled()
  if (status === 'email-sent') expect(screen.getByRole('button', { name: 'Resend sign-in link' })).toBeInTheDocument()
})

it('opens the saved church sign-in form directly from Books', () => {
  mocks.records[0].status = 'following'
  show('/community?signin=church')
  expect(screen.getByLabelText('Church sign-in email')).toHaveValue('reader@example.com')
  expect(mocks.join).not.toHaveBeenCalled()
})

it('lets a new device use a shared church link without signing in or sending email automatically', async () => {
  const preview = { ...mocks.records[0], manifest: { ...mocks.records[0].manifest, capabilities: {} }, contentPreview: { manifest: {}, counts: { books: 0 } } }
  mocks.records = []
  mocks.inspect.mockResolvedValue(preview)
  mocks.join.mockResolvedValue({ email: 'invited@example.com' })
  show('/community?server=https%3A%2F%2Fchurch.example')
  expect(await screen.findByRole('button', { name: 'Sign in to Test Church' })).toBeDisabled()
  expect(mocks.inspect).toHaveBeenCalledWith('https://church.example')
  expect(mocks.join).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Member email'), { target: { value: 'invited@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to Test Church' }))
  await screen.findByText(/A secure sign-in link was sent to invited@example.com/)
  expect(mocks.join).toHaveBeenCalledWith(preview, 'invited@example.com')
})

it('shows discovery errors from a shared church link without sending email', async () => {
  mocks.records = []
  mocks.inspect.mockRejectedValue(new Error('Could not reach the Community server.'))
  show('/community?server=https%3A%2F%2Fchurch.example')
  await screen.findByText('Could not reach the Community server.')
  expect(mocks.join).not.toHaveBeenCalled()
})

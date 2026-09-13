import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ subscriptions: [], inspect: vi.fn(), save: vi.fn(), refresh: vi.fn() }))
vi.mock('../services/communities', () => ({ inspectCommunity: mocks.inspect, savePublicCommunity: mocks.save }))
vi.mock('../services/contentServers', () => ({ CONTENT_SERVERS_CHANGE_EVENT: 'content-change', getContentServerSubscriptions: () => mocks.subscriptions, refreshContentServer: mocks.refresh }))
import CommunityResources from './CommunityResources'
const church = { manifestUrl: 'https://church.example/community.json', manifest: { id: 'church', publicPages: { live: 'https://church.example/live', translation: 'https://church.example/translate' } }, contentPreview: { manifest: { id: 'content' } } }
function show() { render(<MemoryRouter><Routes><Route path="/" element={<CommunityResources community={church} />} /><Route path="/resources/songs" element={<p>Song library</p>} /><Route path="/settings/content-servers" element={<p>Content settings</p>} /></Routes></MemoryRouter>) }
beforeEach(() => { vi.clearAllMocks(); mocks.subscriptions = [] })
it('opens live pages without membership and adds public resources only on request', async () => {
  mocks.inspect.mockResolvedValue(church)
  mocks.save.mockResolvedValue(church)
  show()
  expect(screen.getByRole('link', { name: /Live service/ })).toHaveAttribute('href', 'https://church.example/live')
  expect(screen.getByRole('link', { name: /Live translation/ })).toHaveAttribute('rel', 'noopener noreferrer')
  expect(mocks.inspect).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Songs / }))
  expect(await screen.findByText('Song library')).toBeInTheDocument()
  expect(mocks.save).toHaveBeenCalledWith(church)
})
it('opens an installed library without a network refresh', () => {
  mocks.subscriptions = [{ manifest: { id: 'content' }, enabled: true }]
  show()
  fireEvent.click(screen.getByRole('button', { name: /^Songs / }))
  expect(screen.getByText('Song library')).toBeInTheDocument()
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(mocks.inspect).not.toHaveBeenCalled()
})
it('keeps disabled libraries disabled', () => {
  mocks.subscriptions = [{ manifest: { id: 'content' }, enabled: false }]
  show()
  fireEvent.click(screen.getByRole('button', { name: /^Songs / }))
  expect(screen.getByText('Content settings')).toBeInTheDocument()
  expect(mocks.save).not.toHaveBeenCalled()
})
it('reports a failed refresh while preserving access to the installed library', async () => {
  mocks.subscriptions = [{ manifest: { id: 'content' }, enabled: true }]
  mocks.refresh.mockRejectedValue(new Error('Server unavailable.'))
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh church resources' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Previously loaded resources are still available'))
  fireEvent.click(screen.getByRole('button', { name: /^Songs / }))
  expect(screen.getByText('Song library')).toBeInTheDocument()
})

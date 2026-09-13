import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
vi.mock('../services/communities', () => ({ COMMUNITIES_CHANGE_EVENT: 'community-change', getCommunities: () => [{ manifest: { id: 'church', name: 'My Church' }, contentPreview: { manifest: { id: 'church-content' } } }] }))
vi.mock('../services/contentServers', () => ({ CONTENT_SERVERS_CHANGE_EVENT: 'content-change', getRemoteContentItemsForCategory: () => [
  { id: 'church-song', title: 'My Church Song', sourceServerId: 'church-content', sourceServerName: 'My Church' },
  { id: 'other-song', title: 'Other Church Song', sourceServerId: 'other-content', sourceServerName: 'Other Church' },
] }))
import ResourcePage from './ResourcePage'
function show(id) { render(<MemoryRouter initialEntries={[`/resources/songs?community=${id}`]}><Routes><Route path="/resources/:categoryId" element={<ResourcePage />} /></Routes></MemoryRouter>) }
it('shows only song groups that contain the selected church source', () => {
  show('church')
  expect(screen.getByText('My Church Song')).toBeInTheDocument()
  expect(screen.queryByText('Other Church Song')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Show all/ })).toBeInTheDocument()
})
it('does not fall back to unrelated songs when a saved church has been removed', () => {
  show('removed')
  expect(screen.getByText('Community unavailable')).toBeInTheDocument()
  expect(screen.queryByText('My Church Song')).not.toBeInTheDocument()
  expect(screen.queryByText('Other Church Song')).not.toBeInTheDocument()
})

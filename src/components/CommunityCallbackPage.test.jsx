import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  completeCommunitySignIn: vi.fn(),
  inspectCommunity: vi.fn(),
  getCommunitySession: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

vi.mock('../services/communities', () => ({
  completeCommunitySignIn: mocks.completeCommunitySignIn,
  inspectCommunity: mocks.inspectCommunity,
}))

vi.mock('../services/communitySessions', () => ({
  getCommunitySession: mocks.getCommunitySession,
}))

import CommunityCallbackPage from './CommunityCallbackPage'

function renderCallback(query = '?server=https%3A%2F%2Fcommunity.example&token=one-time-token&flow=sync') {
  return render(
    <MemoryRouter initialEntries={[`/community/callback${query}`]}>
      <Routes>
        <Route path="/community/callback" element={<CommunityCallbackPage />} />
        <Route path="/settings/sync" element={<div>Sync settings destination</div>} />
        <Route path="/community" element={<div>Community destination</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CommunityCallbackPage Strict protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('asks for the Strict password only after email verification requires it', async () => {
    const passwordRequired = Object.assign(new Error('This sign-in link or password is invalid or expired.'), {
      status: 428,
      body: { passwordRequired: true },
    })
    mocks.completeCommunitySignIn
      .mockRejectedValueOnce(passwordRequired)
      .mockResolvedValueOnce({
        manifest: { id: 'wotbc', name: 'WOTBC Community' },
        member: { id: 'reader-1' },
        syncOnly: true,
        contentWarning: '',
      })

    renderCallback()

    const password = await screen.findByLabelText('Strict protection password')
    expect(password).toHaveAttribute('type', 'password')
    expect(screen.getByText(/cannot be reset while signed out/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /forgot|reset/i })).not.toBeInTheDocument()
    expect(mocks.completeCommunitySignIn).toHaveBeenNthCalledWith(
      1,
      'https://community.example',
      'one-time-token',
      {},
    )

    fireEvent.change(password, { target: { value: 'long password from manager' } })
    fireEvent.click(screen.getByRole('button', { name: 'Finish sign-in' }))

    await waitFor(() => expect(mocks.completeCommunitySignIn).toHaveBeenNthCalledWith(
      2,
      'https://community.example',
      'one-time-token',
      { password: 'long password from manager' },
    ))
    expect(await screen.findByText('You are signed in.')).toBeInTheDocument()
  })
})

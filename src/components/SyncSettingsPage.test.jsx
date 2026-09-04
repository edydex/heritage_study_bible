import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSyncState: vi.fn(),
  loadSyncAccount: vi.fn(),
  loadSyncConflicts: vi.fn(),
}))

vi.mock('../services/progressSync.js', () => ({
  beginSyncSignIn: vi.fn(),
  changeAccountProtection: vi.fn(),
  clearPendingSyncSignIn: vi.fn(),
  eraseSynchronizedAccountData: vi.fn(),
  exportSynchronizedAccountData: vi.fn(),
  getSyncState: mocks.getSyncState,
  loadSyncAccount: mocks.loadSyncAccount,
  loadSyncConflicts: mocks.loadSyncConflicts,
  performManualSync: vi.fn(),
  requestAccountReverification: vi.fn(),
  resolveSyncConflict: vi.fn(),
  revokeSyncDevice: vi.fn(),
  signOutSyncAccount: vi.fn(),
}))

vi.mock('../services/secureStorage.js', () => ({
  authenticateLocalDevice: vi.fn(async () => ({ supported: false, authenticated: true })),
}))

import SyncSettingsPage from './SyncSettingsPage.jsx'

function renderSync() {
  return render(<MemoryRouter><SyncSettingsPage /></MemoryRouter>)
}

function state(overrides = {}) {
  return {
    schemaVersion: 1,
    lastRevision: 0,
    records: {},
    knownKeys: [],
    blockedConflicts: [],
    initialComplete: false,
    lastSyncedAt: null,
    status: '',
    ...overrides,
  }
}

describe('SyncSettingsPage account states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSyncConflicts.mockResolvedValue([])
  })

  it('shows the minimal email-only signed-out experience', async () => {
    mocks.getSyncState.mockResolvedValue(state())
    mocks.loadSyncAccount.mockResolvedValue(null)
    renderSync()

    expect(await screen.findByText('Sync your reading progress')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveAttribute('type', 'email')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByText('No password required.')).toBeInTheDocument()
  })

  it('shows the waiting state without exposing account-management controls', async () => {
    mocks.getSyncState.mockResolvedValue(state({
      pendingEmail: 'reader@example.test',
      verificationSentAt: new Date().toISOString(),
      status: 'waiting',
    }))
    mocks.loadSyncAccount.mockResolvedValue(null)
    renderSync()

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText(/reader@example\.test/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open email app' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend in/ })).toBeDisabled()
    expect(screen.queryByText('Manage account')).not.toBeInTheDocument()
  })

  it('keeps device management collapsed and surfaces preserved conflicts', async () => {
    const context = {
      account: {
        member: { email: 'reader@example.test' },
        accountProtection: 'email',
        recentEmailVerification: false,
        conflicts: 1,
        devices: [{
          id: 1,
          deviceId: 'device-a',
          name: 'Reader phone',
          platform: 'android',
          current: true,
          firstConnectedAt: '2026-09-03T12:00:00.000Z',
          lastSyncedAt: null,
          revokedAt: null,
        }],
        events: [],
      },
    }
    mocks.getSyncState.mockResolvedValue(state({ status: 'conflict', conflictCount: 1 }))
    mocks.loadSyncAccount.mockResolvedValue(context)
    mocks.loadSyncConflicts.mockResolvedValue([{
      id: 7,
      recordType: 'note',
      recordId: 'shared-note',
      updatedAt: '2026-09-03T13:00:00.000Z',
    }])
    renderSync()

    expect(await screen.findByText('Review changes from two devices')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use this device’s change' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep synchronized version' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Manage account').closest('details')).not.toHaveAttribute('open'))
    expect(screen.getByRole('button', { name: 'Sign out on this device' })).toBeInTheDocument()
  })
})

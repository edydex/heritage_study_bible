import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'

const databaseUrl =
  'postgresql://heritage_ci:test-password@127.0.0.1:5432/heritage_syncshow_payload_live'
const marker = 'heritage-community-syncshow-payload-live-v1'

function withDisposableEnvironment(callback: () => void) {
  const previousDatabaseUrl = process.env.DATABASE_URL
  const previousMarker = process.env.HERITAGE_DISPOSABLE_CI
  process.env.DATABASE_URL = databaseUrl
  process.env.HERITAGE_DISPOSABLE_CI = marker
  try {
    callback()
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    if (previousMarker === undefined) delete process.env.HERITAGE_DISPOSABLE_CI
    else process.env.HERITAGE_DISPOSABLE_CI = previousMarker
  }
}

function assertPayloadDatabase(overrides: {
  databaseUrl?: string
  expectedDatabase?: string
  expectedMarker?: string
} = {}) {
  assertDisposableLiveDatabase({
    databaseUrl: overrides.databaseUrl ?? databaseUrl,
    expectedDatabase:
      overrides.expectedDatabase ?? 'heritage_syncshow_payload_live',
    expectedMarker: overrides.expectedMarker ?? marker,
    variableName: 'SERVICE_PLAN_LIVE_DATABASE_URL',
  })
}

test('disposable live database guard accepts only the explicit loopback target', () => {
  withDisposableEnvironment(() => {
    assert.doesNotThrow(() => assertPayloadDatabase())
  })
})

test('disposable live database guard rejects an absent or different marker', () => {
  withDisposableEnvironment(() => {
    process.env.HERITAGE_DISPOSABLE_CI = 'almost-the-right-marker'
    assert.throws(
      () => assertPayloadDatabase(),
      /exact disposable PostgreSQL test marker/,
    )
  })
})

test('disposable live database guard rejects a non-loopback server', () => {
  withDisposableEnvironment(() => {
    const remote = databaseUrl.replace('127.0.0.1', 'database.example.org')
    process.env.DATABASE_URL = remote
    assert.throws(
      () => assertPayloadDatabase({ databaseUrl: remote }),
      /must target a loopback PostgreSQL server/,
    )
  })
})

test('disposable live database guard rejects the wrong database name', () => {
  withDisposableEnvironment(() => {
    assert.throws(
      () => assertPayloadDatabase({ expectedDatabase: 'production' }),
      /must target the dedicated production database/,
    )
  })
})

test('disposable live database guard rejects disagreement with DATABASE_URL', () => {
  withDisposableEnvironment(() => {
    process.env.DATABASE_URL = databaseUrl.replace(
      'heritage_syncshow_payload_live',
      'another_database',
    )
    assert.throws(
      () => assertPayloadDatabase(),
      /DATABASE_URL must name the same disposable database/,
    )
  })
})

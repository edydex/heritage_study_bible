import assert from 'node:assert/strict'

type DisposableLiveDatabaseOptions = {
  databaseUrl: string | undefined
  expectedDatabase: string
  expectedMarker: string
  variableName: string
}

/**
 * The opt-in PostgreSQL checks mutate real tables, and the sermon-history
 * check deliberately drops three of them. Require three independent signals
 * before touching a database: the opt-in URL must equal DATABASE_URL, the
 * caller must provide the disposable-test marker, and the target must be an
 * explicitly named loopback database.
 */
export function assertDisposableLiveDatabase({
  databaseUrl,
  expectedDatabase,
  expectedMarker,
  variableName,
}: DisposableLiveDatabaseOptions) {
  assert.ok(databaseUrl, `${variableName} is required`)
  assert.equal(
    process.env.DATABASE_URL,
    databaseUrl,
    `DATABASE_URL must name the same disposable database as ${variableName}`,
  )
  assert.equal(
    process.env.HERITAGE_DISPOSABLE_CI,
    expectedMarker,
    'Set the exact disposable PostgreSQL test marker before running this live check.',
  )

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    assert.fail(`${variableName} must be a valid PostgreSQL URL`)
  }
  assert.equal(parsed.protocol, 'postgresql:')
  assert.ok(
    ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname),
    `${variableName} must target a loopback PostgreSQL server`,
  )
  assert.equal(
    decodeURIComponent(parsed.pathname.replace(/^\/+/, '')),
    expectedDatabase,
    `${variableName} must target the dedicated ${expectedDatabase} database`,
  )
}

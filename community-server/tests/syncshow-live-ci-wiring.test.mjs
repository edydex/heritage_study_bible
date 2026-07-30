import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [workflow, packageSource, servicePlanTest, historyTest, guardSource] =
  await Promise.all([
    readFile(
      new URL('../../.github/workflows/community-server.yml', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(
      new URL('./community-service-plan-payload.test.ts', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL(
        './syncshow-sermon-change-source-postgres.test.ts',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(
      new URL('./lib/disposableLiveDatabase.ts', import.meta.url),
      'utf8',
    ),
  ])

function job(name, nextName) {
  const start = workflow.indexOf(`\n  ${name}:`)
  assert.notEqual(start, -1, `missing ${name} job`)
  const end = nextName
    ? workflow.indexOf(`\n  ${nextName}:`, start + 1)
    : workflow.length
  assert.ok(end > start, `could not bound ${name} job`)
  return workflow.slice(start, end)
}

test('Payload live CI migrates one dedicated database before sequential lifecycle checks', () => {
  const payloadJob = job(
    'syncshow-payload-live',
    'syncshow-sermon-history-live',
  )
  assert.match(payloadJob, /image: postgres:17-alpine/)
  assert.match(payloadJob, /POSTGRES_DB: heritage_syncshow_payload_live/)
  assert.match(
    payloadJob,
    /HERITAGE_DISPOSABLE_CI: heritage-community-syncshow-payload-live-v1/,
  )
  const install = payloadJob.indexOf('run: npm ci --legacy-peer-deps')
  const productionMode = payloadJob.indexOf('NODE_ENV: production')
  const migrate = payloadJob.indexOf('run: npm run migrate')
  const servicePlan =
    payloadJob.indexOf('run: npm run test:syncshow:service-plan-live')
  const songLink =
    payloadJob.indexOf('run: npm run test:syncshow:song-link-live')
  assert.ok(install > -1)
  assert.ok(install < productionMode)
  assert.ok(productionMode < migrate)
  assert.ok(migrate < servicePlan)
  assert.ok(servicePlan < songLink)
  assert.doesNotMatch(payloadJob, /SERMON_HISTORY_LIVE_DATABASE_URL/)
})

test('destructive sermon-history CI has a distinct fresh database and test mode', () => {
  const historyJob = job('syncshow-sermon-history-live')
  assert.match(historyJob, /image: postgres:17-alpine/)
  assert.match(
    historyJob,
    /POSTGRES_DB: heritage_syncshow_sermon_history_live/,
  )
  assert.match(
    historyJob,
    /HERITAGE_DISPOSABLE_CI: heritage-community-syncshow-sermon-history-live-v1/,
  )
  const install = historyJob.indexOf('run: npm ci --legacy-peer-deps')
  const testMode = historyJob.indexOf('NODE_ENV: test')
  const history =
    historyJob.indexOf('run: npm run test:syncshow:sermon-history-live')
  assert.ok(install > -1)
  assert.ok(install < testMode)
  assert.ok(testMode < history)
  assert.doesNotMatch(historyJob, /run: npm run migrate/)
  assert.doesNotMatch(historyJob, /SERVICE_PLAN_LIVE_DATABASE_URL/)
  assert.doesNotMatch(historyJob, /SONG_PUBLIC_LINK_LIVE_DATABASE_URL/)
})

test('live checks are self-contained, guarded, and declare direct PostgreSQL tooling', () => {
  const packageJson = JSON.parse(packageSource)
  assert.equal(packageJson.devDependencies.pg, '8.20.0')
  assert.equal(packageJson.devDependencies['@types/pg'], '8.20.0')
  assert.match(
    packageJson.scripts['test:syncshow'],
    /tests\/disposable-live-database\.test\.ts/,
  )
  assert.match(
    packageJson.scripts['test:syncshow'],
    /tests\/syncshow-live-ci-wiring\.test\.mjs/,
  )
  assert.match(servicePlanTest, /push: false/)
  assert.match(
    servicePlanTest,
    /managerSermonPreparationEndpoints\.find\(candidate =>/,
  )
  assert.match(
    servicePlanTest,
    /candidate\.path === '\/community\/sermon-preparations'/,
  )
  assert.match(
    servicePlanTest,
    /sermonPreparationRequest\(payload, leader\)/,
  )
  assert.doesNotMatch(servicePlanTest, /service-plan-sermon-seed/)
  assert.match(servicePlanTest, /collection: 'syncshow-sermon-changes'/)
  assert.match(servicePlanTest, /journal\.totalDocs, 1/)
  assert.match(historyTest, /assertDisposableLiveDatabase\(\{/)
  assert.match(
    historyTest,
    /expectedDatabase: 'heritage_syncshow_sermon_history_live'/,
  )
  assert.match(guardSource, /127\.0\.0\.1/)
  assert.match(guardSource, /localhost/)
  assert.match(guardSource, /parsed\.pathname/)
})

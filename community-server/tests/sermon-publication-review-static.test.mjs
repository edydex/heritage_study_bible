import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8')
}

test('Payload wires a manager-only same-origin sermon review view into the normal admin shell', async () => {
  const [
    config,
    importMap,
    welcome,
    view,
    client,
    model,
  ] = await Promise.all([
    source('../src/payload.config.ts'),
    source('../src/app/(payload)/admin/importMap.js'),
    source('../src/components/AdminWelcome.tsx'),
    source('../src/components/SermonPublicationReview.tsx'),
    source('../src/components/SermonPublicationReviewClient.tsx'),
    source('../src/components/sermonPublicationReviewModel.ts'),
  ])

  assert.match(config, /sermonPublications:\s*\{/)
  assert.match(config, /Component:\s*'@\/components\/SermonPublicationReview'/)
  assert.match(config, /path:\s*'\/sermon-publications'/)
  assert.match(importMap, /"@\/components\/SermonPublicationReview#default"/)
  assert.match(welcome, /href:\s*'\/admin\/sermon-publications'/)
  assert.match(welcome, /Review SyncShow sermons/)

  assert.match(view, /DefaultTemplate/)
  assert.match(view, /viewType="sermon-publications"/)
  assert.match(view, /parseSermonPublicationReviewTarget\(props\.searchParams\)/)
  assert.match(view, /initialTarget=\{initialTarget\}/)
  assert.match(client, /'use client'/)
  assert.match(client, /\/api\/community\/sermon-publications/)
  assert.match(client, /credentials:\s*'same-origin'/)
  assert.match(client, /cache:\s*'no-store'/)
  assert.match(client, /'Content-Type':\s*'application\/json'/)
  assert.match(client, /resolveSermonPublicationReviewTarget/)
  assert.match(client, /Nothing else was opened automatically/)
  assert.match(client, /setTargetError\(null\)/)
  assert.match(model, /SERMON_SYNC_ID_PATTERN = \/\^\[A-Za-z0-9\]/)
  assert.match(model, /item\.syncId === target\.syncId/)
  assert.doesNotMatch(model, /item\.(?:title|serviceDate) === target/)
  assert.doesNotMatch(client, /Authorization/)
})

test('review is explicit, stale proposals clear, and technical hashes stay collapsed', async () => {
  const client = await source('../src/components/SermonPublicationReviewClient.tsx')

  assert.match(client, /Nothing is selected automatically/)
  assert.match(client, /including the choice\s+to publish none/)
  assert.match(client, /type="url"/)
  assert.match(client, /preload="none"/)
  assert.match(client, /Preview \$\{/)
  assert.match(client, /stable anonymous HTTPS file URL/)
  assert.match(client, /recordingRightsAndPrivacyConfirmed/)
  assert.match(client, /audioNeedsWrittenAlternative/)
  assert.match(client, /before publishing the selected audio/)
  assert.match(client, /contains no private prayer, counseling, or minor-related/)
  assert.match(client, /does not fetch or verify the remote file/)
  assert.match(client, /not\s+only signed-in Community members/)
  assert.match(client, /intentionally has no canonical website link/)
  assert.match(client, /I intend to withdraw this exact active publication/)
  assert.match(client, /setDraft\(createEmptyPublicationReviewDraft\(\)\)/)
  assert.match(client, /Load current revision/)
  assert.match(client, /Technical details and hashes/)
  assert.doesNotMatch(client, /window\.confirm/)
})

test('generic sermon forms remain writable only for legacy rows', async () => {
  const sermons = await source('../src/collections/Sermons.ts')

  assert.match(sermons, /const manageLegacySermonsOnly: Access/)
  assert.match(sermons, /const legacyOnly: Where = \{ syncId: \{ exists: false \} \}/)
  assert.match(sermons, /update: manageLegacySermonsOnly/)
  assert.match(sermons, /delete: manageLegacySermonsOnly/)
  assert.match(sermons, /next\.status = 'draft'/)
})

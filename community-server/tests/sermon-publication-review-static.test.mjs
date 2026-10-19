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
  const [client, model] = await Promise.all([
    source('../src/components/SermonPublicationReviewClient.tsx'),
    source('../src/components/sermonPublicationReviewModel.ts'),
  ])

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
  assert.match(client, /Private Community recordings/)
  assert.match(client, /manager-only controls select and publish nothing/)
  assert.match(client, /managed-recordings/)
  assert.match(client, /parseManagedRecordingInventory/)
  assert.match(client, /managedRecordingInventoryMatchesDetail/)
  assert.match(client, /void \(async \(\) =>/)
  assert.match(client, /<audio[\s\S]*?preload="none"[\s\S]*?contentPath/)
  assert.match(client, /Download original/)
  assert.match(client, /href=\{downloadPath\}/)
  assert.match(client, /External public recording fallback/)
  assert.match(client, /Preserved Community recording/)
  assert.match(client, /managedRecordingReviewId/)
  assert.match(client, /recording\.eligibility === 'publishable'/)
  assert.match(client, /role="radiogroup"/)
  assert.match(client, /type="radio"/)
  assert.match(client, /Nothing is selected\s+automatically/)
  assert.match(client, /review-only recordings remain available only through the\s+private playback and download controls above/)
  assert.match(client, /function updateManagedRecordingSelection\(/)
  assert.match(client, /managedRecordingReviewId: reviewId/)
  assert.match(client, /directAudio:[\s\S]*?url: ''/)
  assert.match(client, /mediaSelectionConfirmed: false,[\s\S]*?recordingRightsAndPrivacyConfirmed: false/)
  assert.match(client, /managedRecordingReviewId: directAudio\.url\.trim\(\) \? null/)
  assert.match(client, /buildSermonPublishIntent\([\s\S]*?managedRecordingState\.inventory/)
  assert.match(model, /export type SermonPublishIntentV3/)
  assert.match(model, /schemaVersion: 3/)
  assert.match(model, /managedRecordingReviewId: string/)
  assert.match(model, /selected\.eligibility !== 'publishable'/)
  assert.match(model, /either one preserved Community recording or one external recording URL/)
  assert.ok(
    client.indexOf('Private Community recordings') < client.indexOf('<form onSubmit={publish}>'),
    'private playback must remain outside the disabled publication form',
  )
  assert.doesNotMatch(client, /\bBlob\b|createObjectURL|revokeObjectURL/)
  assert.match(client, /Passage discovery/)
  assert.match(client, /Confirmed primary passages appear prominently/)
  assert.match(client, /Confirmed mentioned passages power its small/)
  assert.match(client, /This exact revision has no Scripture references to publish/)
  assert.match(client, /reference\.enteredText \|\| formatBibleRange\(reference\.range\)/)
  assert.match(client, /reference\.role === 'primary'/)
  assert.match(client, /Mentioned passage/)
  assert.match(model, /references:\s*parseReferences\(raw\.references\)/)
  assert.match(model, /REFERENCE_ROLES = new Set\(\['primary', 'mentioned'\]\)/)
  assert.match(model, /REFERENCE_REVIEW_STATUSES = new Set\(\['suggested', 'confirmed'\]\)/)
  assert.match(model, /enteredText:[\s\S]*?\{ empty: true \}/)
  assert.match(client, /not\s+only signed-in Community members/)
  assert.match(client, /intentionally has no canonical website link/)
  assert.match(client, /I intend to withdraw this exact active publication/)
  assert.match(client, /setDraft\(createEmptyPublicationReviewDraft\(\)\)/)
  assert.match(client, /Load current revision/)
  assert.match(client, /Technical details and hashes/)
  assert.doesNotMatch(client, /window\.confirm/)
  assert.match(client, /type MutationClaim = Readonly/)
  assert.match(client, /const activeMutation = useRef<MutationClaim \| null>\(null\)/)
  assert.match(client, /function claimMutation\(/)
  assert.match(client, /function mutationClaimIsCurrent\(/)
  assert.match(client, /function releaseMutation\(/)
  assert.doesNotMatch(
    client,
    /selectedSyncIdRef\.current = null\s+activeMutation\.current = null/,
  )
  assert.match(client, /const claim = claimMutation\('publish', detail\.sermon\.syncId\)/)
  assert.match(client, /const claim = claimMutation\('withdraw', detail\.sermon\.syncId\)/)
  assert.match(client, /handleMutationFailure\(error, claim\)/)
  assert.match(client, /disabled=\{busyAction !== null\}/)
})

test('generic sermon forms remain writable only for legacy rows', async () => {
  const sermons = await source('../src/collections/Sermons.ts')

  assert.match(sermons, /const manageLegacySermonsOnly: Access/)
  assert.match(sermons, /const legacyOnly: Where = \{ syncId: \{ exists: false \} \}/)
  assert.match(sermons, /update: manageLegacySermonsOnly/)
  assert.match(sermons, /delete: manageLegacySermonsOnly/)
  assert.match(sermons, /next\.status = 'draft'/)
})

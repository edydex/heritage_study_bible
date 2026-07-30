import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8')
}

test('Payload wires a same-origin manager sermon-preparation task into admin', async () => {
  const [
    config,
    importMap,
    welcome,
    view,
    client,
    endpoint,
  ] = await Promise.all([
    source('../src/payload.config.ts'),
    source('../src/app/(payload)/admin/importMap.js'),
    source('../src/components/AdminWelcome.tsx'),
    source('../src/components/PrepareSermon.tsx'),
    source('../src/components/PrepareSermonClient.tsx'),
    source('../src/endpoints/sermonPreparations.ts'),
  ])

  assert.match(config, /prepareSermon:\s*\{/)
  assert.match(config, /Component:\s*'@\/components\/PrepareSermon'/)
  assert.match(config, /path:\s*'\/prepare-sermon'/)
  assert.match(config, /\.\.\.managerSermonPreparationEndpoints/)
  assert.match(importMap, /"@\/components\/PrepareSermon#default"/)
  assert.match(welcome, /href:\s*'\/admin\/prepare-sermon'/)
  assert.match(welcome, /title:\s*'Prepare a sermon'/)
  assert.match(welcome, /title:\s*'Add an older sermon'/)

  assert.match(view, /DefaultTemplate/)
  assert.match(view, /viewType="prepare-sermon"/)
  assert.match(client, /'use client'/)
  assert.match(client, /\/api\/community\/sermon-preparations/)
  assert.match(client, /credentials:\s*'same-origin'/)
  assert.match(client, /cache:\s*'no-store'/)
  assert.match(client, /'Idempotency-Key':\s*`manager-sermon-/)
  assert.doesNotMatch(client, /Authorization/)
  assert.match(client, /This does not publish anything/)
  assert.match(client, /does not upload or retain the original DOCX or PPTX/)
  assert.match(client, /reviewConfirmed:\s*false/)
  assert.match(client, /schemaVersion:\s*2/)
  assert.match(client, /response\.schemaVersion !== 2/)
  assert.match(client, /mentionedPassages:\s*draft\.mentionedPassages\.map\(passageBody\)/)
  assert.match(client, /mentionedPassageCount:\s*number/)
  assert.match(client, /hasExactKeys\(response, \['schemaVersion', 'created', 'sermon'\]\)/)
  assert.match(client, /confirmed other passages/)
  assert.match(client, /const MAX_MENTIONED_PASSAGES = 64/)
  assert.match(client, /function addMentionedPassage\(\)/)
  assert.match(client, /function updateMentionedPassage\(/)
  assert.match(client, /function removeMentionedPassage\(/)
  assert.match(client, /Other passages used in this sermon/)
  assert.match(client, /Appears in sermons/)
  assert.match(client, /Exact duplicates,[\s\S]*?are safely collapsed/)
  assert.match(client, /every other[\s\S]*?passage listed above/)
  assert.match(client, /function localToday\(now = new Date\(\)\)/)
  assert.match(client, /onClick=\{\(\) => updateField\('serviceDate', localToday\(\)\)\}/)
  assert.match(client, /Use today/)
  assert.match(client, /Create private Ready sermon/)
  assert.match(client, /<span>Sermon title<\/span>[\s\S]*?<input[\s\S]*?maxLength=\{300\}/)
  assert.match(client, /<span>Speaker<\/span>[\s\S]*?<input[\s\S]*?maxLength=\{200\}/)
  assert.match(client, /const PENDING_IDENTITY_KEY = 'heritage:prepare-sermon:pending:v2'/)
  assert.match(client, /globalThis\.crypto\.subtle\.digest\('SHA-256'/)
  assert.match(client, /rememberPendingIdentity\(fingerprint, effectiveRequestId\)/)
  assert.match(client, /clearPendingIdentity\(\)[\s\S]*?setResult\(response\)/)
  assert.match(client, /type="checkbox"[\s\S]*?disabled=\{busy\}/)
  assert.match(client, /busy \? \([\s\S]*?aria-disabled="true">Cancel/)
  assert.match(client, /canonicalBibleChapterVerseMaximum/)
  assert.match(client, /max=\{startVerseMaximum\}/)
  assert.match(client, /max=\{endVerseMaximum\}/)
  assert.doesNotMatch(client, /max=\{999\}/)

  assert.match(endpoint, /startsWith\('SyncShow '\)/)
  assert.match(endpoint, /role" IN \('owner', 'admin', 'leader'\)/)
  assert.match(endpoint, /FOR SHARE/)
  assert.match(endpoint, /authorize:\s*database => assertLiveManager/)
  assert.match(endpoint, /Idempotency-Key is required/)
  assert.match(
    endpoint,
    /requestSchemaVersion === LEGACY_MANAGER_SERMON_PREPARATION_SCHEMA_VERSION/,
  )
  assert.match(endpoint, /schemaVersion:\s*1 as const/)
  assert.match(endpoint, /schemaVersion:\s*2 as const/)
  assert.match(endpoint, /mentionedPassageCount:\s*document\.references\.filter/)
  assert.match(endpoint, /prepared\.schemaVersion/)
  assert.match(endpoint, /Cache-Control', 'private, no-store'/)
})

test('service-plan sermon relationships show only canonical sermons from the selected Community', async () => {
  const servicePlans = await source('../src/collections/ServicePlans.ts')
  assert.match(servicePlans, /const canonicalSermonsForPlan: FilterOptions/)
  assert.match(servicePlans, /syncId:\s*\{ exists: true \}/)
  assert.match(servicePlans, /syncArchived:\s*\{ not_equals: true \}/)
  assert.match(servicePlans, /community:\s*\{ equals: communityId \}/)
  assert.match(servicePlans, /communityId < 1\) return false/)
  assert.equal(
    [...servicePlans.matchAll(/filterOptions:\s*canonicalSermonsForPlan/g)].length,
    2,
  )
})

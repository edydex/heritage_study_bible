import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../src/migrations/20260903_200000_community_accounts_sync.ts', import.meta.url)

test('personal-sync migration persists generation and recoverable conflict metadata', async () => {
  const source = await readFile(migrationUrl, 'utf8')
  for (const fragment of [
    '"sync_generation" numeric DEFAULT 1 NOT NULL',
    '"schema_version" numeric NOT NULL',
    '"client_updated_at" timestamp(3) with time zone',
    '"server_record_missing" boolean DEFAULT false NOT NULL',
    'sync_records_server_revision_seq',
    'sync_records_user_type_record_id_idx',
  ]) {
    assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.equal((source.match(/ON DELETE cascade/g) || []).length, 7)
  // The down migration restores the two legacy constraints exactly; every
  // required sync-account FK in the up migration is CASCADE.
  assert.equal((source.match(/ON DELETE set null/g) || []).length, 2)
})

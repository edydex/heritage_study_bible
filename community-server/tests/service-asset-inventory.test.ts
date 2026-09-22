import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import pg from 'pg'

test('private media inventory retains current and historical service assets without double counting', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE inventory_services (community_id int, document_source text) ON COMMIT DROP')
    await client.query('CREATE TEMP TABLE inventory_history (community_id int, document_source text) ON COMMIT DROP')
    await client.query('CREATE TEMP TABLE inventory_churches (id int, presentation_slides jsonb) ON COMMIT DROP')
    await client.query('CREATE TEMP TABLE inventory_books (id int, community_id int, read_along jsonb) ON COMMIT DROP')
    const current = 'a'.repeat(64)
    const historical = 'b'.repeat(64)
    const template = 'c'.repeat(64), bookAudio='d'.repeat(64)
    const document = (sha256: string) => JSON.stringify({ project: { assets: { [`sha256:${sha256}`]: { id: `sha256:${sha256}`, sha256, size: 42, kind: 'image' } } } })
    await client.query('INSERT INTO inventory_services VALUES (1, $1)', [document(current)])
    await client.query('INSERT INTO inventory_history VALUES (1, $1), (1, $2)', [document(current), document(historical)])
    await client.query('INSERT INTO inventory_churches VALUES (1, $1), (2, $2)', [JSON.stringify([{documentSource:document(template)}]),'null'])
    await client.query('INSERT INTO inventory_books VALUES (4, 1, $1)', [JSON.stringify({chapters:[{audioSha256:bookAudio,audioSize:123}]})])
    const query = readFileSync(new URL('../scripts/service-document-asset-inventory.sql', import.meta.url), 'utf8')
      .replace('public.communities','pg_temp.inventory_churches').replace('public.books','pg_temp.inventory_books')
      .replace('public.service_documents', 'pg_temp.inventory_services')
      .replace('public.syncshow_service_document_changes', 'pg_temp.inventory_history')
    const result = await client.query(query)
    assert.deepEqual(result.rows.map(row => row.sha256).sort(), [current, historical, template, bookAudio])
    const namespace = createHash('sha256').update('heritage-sermon-media-community-v1\0').update('1').digest('hex')
    assert.equal(result.rows.find(row=>row.sha256===current).storage_key, `objects/${namespace}/sha256/aa/${current}`)
    assert.equal(Number(result.rows.find(row=>row.sha256===current).size_bytes), 42)
    assert.equal(result.rows.find(row=>row.sha256===bookAudio).storage_key, `objects/${createHash('sha256').update('heritage-book-audio/v1:1:4').digest('hex')}/sha256/dd/${bookAudio}`)
    assert.equal(Number(result.rows.find(row=>row.sha256===bookAudio).size_bytes),123)
  } finally {
    await client.query('ROLLBACK')
    await client.end()
  }
})

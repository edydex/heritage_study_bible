import assert from 'node:assert/strict'
import test from 'node:test'
import { groupServiceHistory, type ServiceHistoryEntry } from '../src/lib/serviceVersionHistory'
import { ServiceDocumentSaves } from '../src/collections/ServiceDocumentSaves'
import { managerWrite, blankServiceDocument } from '../src/endpoints/serviceDocuments'

function entry(version: number, minute: number, kind: ServiceHistoryEntry['saveKind'] = 'automatic', author = 'Pastor') {
  return { id: `save-${version}`, syncVersion: version, revision: 'a'.repeat(64), savedAt: new Date(Date.UTC(2026, 9, 1, 12, minute)).toISOString(), saveKind: kind, savedBy: author }
}
test('autosaves group for at most five minutes, manual saves and authors separate groups', () => {
  const grouped = groupServiceHistory([entry(1, 0), entry(2, 3), entry(3, 5), entry(4, 6, 'manual'), entry(5, 7), entry(6, 8, 'automatic', 'Another pastor')])
  assert.deepEqual(grouped.map(group => group.entries.map(item => item.syncVersion)), [[6], [5], [4], [3], [2, 1]])
  assert.equal(grouped[2].saveKind, 'manual')
})
test('restore checkpoints remain distinct and history order is stable', () => {
  const grouped = groupServiceHistory([entry(3, 4, 'restore'), entry(1, 0), entry(2, 2)])
  assert.deepEqual(grouped.map(group => group.saveKind), ['restore', 'automatic'])
  assert.equal(grouped[0].entries[0].syncVersion, 3)
})
test('save checkpoint collection denies generic access and mutation', async () => {
  for (const action of Object.values(ServiceDocumentSaves.access!)) assert.equal(await (action as any)({}), false)
  const hook = ServiceDocumentSaves.hooks!.beforeChange![0]
  assert.throws(() => (hook as any)({ operation: 'update', context: { serviceDocumentSave: true }, data: {} }), /immutable/)
  assert.throws(() => (hook as any)({ operation: 'create', context: {}, data: {} }), /immutable/)
  assert.deepEqual((hook as any)({ operation: 'create', context: { serviceDocumentSave: true }, data: { safe: true } }), { safe: true })
})
test('editor save intent is narrow and does not permit user-supplied authors', () => {
  const mutation = blankServiceDocument({ schemaVersion: 1, requestId: 'history-fixture', syncId: 'history-fixture', title: 'History fixture', serviceDate: '2026-10-01' })
  const input = { schemaVersion: 1, requestId: 'save-fixture', ...mutation.write }
  const { revision, ...body } = input
  assert.equal(managerWrite({ ...body, saveKind: 'automatic' }).write.revision, revision)
  assert.throws(() => managerWrite({ ...body, saveKind: 'forged' }), /valid save type/)
  assert.throws(() => managerWrite({ ...body, saveKind: 'manual', savedBy: 'Someone else' }), /incomplete/)
})

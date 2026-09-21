import { describe, expect, it } from 'vitest'
import { mergeSyncList, mergeSyncPlan, mergeSyncPosition } from './syncLocalMerge.js'

describe('incoming sync while reading and editing', () => {
  it('preserves a newer local edit, deletion and addition while applying unrelated remote changes', () => {
    const before = [{ id: 'edit', text: 'old' }, { id: 'delete' }, { id: 'remote', text: 'old' }]
    const current = [{ id: 'edit', text: 'typing' }, { id: 'new' }, { id: 'remote', text: 'old' }]
    const incoming = [{ id: 'edit', text: 'server' }, { id: 'delete', text: 'server' }, { id: 'remote', text: 'server' }]
    expect(mergeSyncList(before, current, incoming)).toEqual([
      { id: 'edit', text: 'typing' }, { id: 'new' }, { id: 'remote', text: 'server' },
    ])
  })
  it('keeps the current Bible position but accepts another resource update', () => {
    expect(mergeSyncPosition(
      { bible: { chapter: 1 }, resources: {} },
      { bible: { chapter: 2 }, resources: {} },
      { bible: { chapter: 9 }, resources: { book: { chapterIndex: 3 } } },
    )).toEqual({ bible: { chapter: 2 }, resources: { book: { chapterIndex: 3 } } })
  })
  it('compares local resource positions without their wire-only resource id', () => {
    expect(mergeSyncPosition(
      { resources: { book: { resourceId: 'book', chapterIndex: 1 } } },
      { resources: { book: { chapterIndex: 1 } } },
      { resources: { book: { resourceId: 'book', chapterIndex: 2 } } },
    ).resources.book).toEqual({ chapterIndex: 2 })
  })
  it('retains a newly unchecked reading item and edited day note', () => {
    const before = { completedItems: { 1: ['a'] }, completedDays: [1], dayNotes: { 1: 'old' } }
    const current = { ...before, completedItems: {}, completedDays: [], dayNotes: { 1: 'typing' }, startedOn: '2026-01-01' }
    const incoming = { completedItems: { 1: ['a', 'b'] }, completedDays: [1, 2], dayNotes: { 1: 'server', 2: 'new' } }
    expect(mergeSyncPlan(before, current, incoming)).toMatchObject({
      completedItems: { 1: ['b'] }, completedDays: [2], dayNotes: { 1: 'typing', 2: 'new' }, startedOn: '2026-01-01',
    })
  })
})

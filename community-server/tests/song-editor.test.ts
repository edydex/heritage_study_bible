import assert from 'node:assert/strict'
import test from 'node:test'
import { assignSongCommunity } from '../src/lib/songEditor'
import { songPublicationChange, songPublicationChoice } from '../src/lib/songPublicationChoice'
import { songMemberSharingEndpoints } from '../src/endpoints/songMemberSharing'
import { fillSongSlug, slugifySongTitle } from '../src/lib/contentAdmin'

test('Russian-only imported songs get a readable address while existing links remain stable', async () => {
  assert.equal(slugifySongTitle('Не уходи Иисус'),'ne-ukhodi-iisus')
  assert.equal(slugifySongTitle('Speak, O Lord'),'speak-o-lord')
  assert.deepEqual(await fillSongSlug({data:{title:'Мы славим Тебя'}} as never),{title:'Мы славим Тебя',slug:'my-slavim-tebya'})
  assert.deepEqual(await fillSongSlug({data:{title:'Новое имя'},originalDoc:{slug:'original-link'}} as never),{title:'Новое имя',slug:'original-link'})
})

test('one publication choice includes archiving and restoring without legacy visibility', () => {
  assert.deepEqual(songPublicationChange('archived'), { status: 'archived', songbookVisibility: 'private' })
  for (const choice of ['published', 'unlisted', 'private'] as const) {
    assert.deepEqual(songPublicationChange(choice), { status: 'draft', songbookVisibility: choice })
    assert.equal(songPublicationChoice(choice, 'draft'), choice)
    assert.equal(songPublicationChoice(choice, 'archived'), 'archived')
  }
})

test('derive the church for new songs and enforce the derived tenant scope', async () => {
  const hook = (user: unknown, managerCommunity: number) => assignSongCommunity({
    data: { title: 'Test song' }, req: { user, payload: {
      find: async ({ collection }: { collection: string }) => ({ docs: collection === 'communities' ? [{ id: 7 }] : [{ community: managerCommunity }] }),
    } },
  } as never)
  assert.deepEqual(await hook({ id: 3, systemRole: 'member' }, 7), { title: 'Test song', community: 7 })
  await assert.rejects(hook({ id: 3, systemRole: 'member' }, 9), /permission/)
  assert.deepEqual(await hook({ id: 1, systemRole: 'system-admin' }, 9), { title: 'Test song', community: 7 })
  const existing = { title: 'Updated' }
  assert.equal(await assignSongCommunity({ data: existing, originalDoc: { community: 9 } } as never), existing)
})

test('old member-sharing clients receive a clear retirement response without a database mutation', async () => {
  const result = await songMemberSharingEndpoints[0].handler({
    headers: new Headers(), payload: { config: { cors: [] } },
  } as never)
  assert.equal(result.status, 410)
  assert.equal(result.headers.get('cache-control'), 'private, no-store')
  assert.equal((await result.json()).code, 'LEGACY_MEMBER_SHARING_RETIRED')
})

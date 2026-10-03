import assert from 'node:assert/strict'
import test from 'node:test'
import { songDocumentBody, songSectionLanguageChoices, songSourceHeading, songSourceSections } from '../src/lib/songSourceSyntax'
import { prepareSongSyncFields } from '../src/lib/syncShowSongHooks'
import { parseSongLyrics } from '../packages/song-text/index.js'
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


test('asterisks mark only section headings and retain exact text ranges', () => {
  const lyrics = '*Verse 1a*\nEnglish one\n\nChorus\n*These lyric words stay literal*\n\nChorus\n'
  const sections = songSourceSections(lyrics)
  assert.equal(sections.map(section => lyrics.slice(section.start, section.end)).join(''), lyrics)
  assert.deepEqual(sections.map(({id,primary})=>({id,primary})), [{id:'1',primary:true},{id:'chorus',primary:false},{id:'chorus',primary:false}])
  assert.deepEqual({...songSectionLanguageChoices(lyrics,'Куплет 1\nРусские слова\n\n*Припев*\nМы поём').choices},{'1':'en',chorus:'ru'})
  assert.equal(songSourceHeading('*Chorus* x2')?.repeat,2)
  assert.equal(songSourceHeading('*Припев x2*')?.repeat,2)
  assert.equal(songSourceHeading('*These lyric words stay literal*'),null)
  const body=songDocumentBody(lyrics)
  assert.doesNotMatch(body,/\*Verse/)
  assert.match(body,/\*These lyric words stay literal\*/)
  assert.equal((songDocumentBody('*Chorus* x2\nWe sing').match(/\^chorus/g)||[]).length,2)
  assert.deepEqual(songSectionLanguageChoices('*Chorus*\nEnglish','*Припев*\nРусский').conflicts,['chorus'])
  assert.deepEqual(parseSongLyrics('*Chorus*\nWe sing\n*literal lyric words*'),[{label:'Chorus',lines:['We sing','*literal lyric words*']}])
  assert.deepEqual(parseSongLyrics('*Chorus* x2\nWe sing'),[{label:'Chorus',lines:['We sing']}])
  assert.deepEqual(parseSongLyrics('*Припев x2*\nМы поём',{language:'ru'}),[{label:'Припев',lines:['Мы поём']}])
})

test('saving rejects competing primary languages and keeps a single choice in canonical source', async () => {
  assert.throws(()=>prepareSongSyncFields({operation:'create',data:{title:'Example',lyrics:'*Chorus*\nEnglish',russianLyrics:'*Припев*\nРусский'},context:{}} as never),/Choose one primary language/)
  const saved=prepareSongSyncFields({operation:'create',data:{title:'Example',lyrics:'*Chorus*\nEnglish',russianLyrics:'Припев\nРусский'},context:{}} as never) as any
  assert.match(saved.syncDocuments[0].source,/primarySections:/)
  assert.doesNotMatch(saved.syncDocuments[0].source,/\*Chorus\*/)
})

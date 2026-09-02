import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import { plannerSlides, editPlannerSlide } from '../src/components/plannerSlides.ts'
import { preparePlannerPresentation, scripturePages, scriptureLineCount, SCRIPTURE_PAGE_MAX_LINES } from '../src/components/plannerPresentation.ts'

function fixture() {
  let project = core.createServiceProject({ id: 'projector-test', title: 'Projector service', serviceDate: '2026-08-23',
    preferredProfileId: 'main-sanctuary', presetPack: { id: 'main-sanctuary', version: 1, sha256: null },
    channels: [{ id: 'english', label: 'English', language: 'en' }, { id: 'russian', label: 'Russian', language: 'ru' }, { id: 'media', label: 'Singers', language: 'ru' }] })
  const document = core.parseSongDocument('---\nid: song\ntitle: A Song\nlanguage: en\nauthors: A Writer\nattribution: Import notes and permission review text do not belong on a title slide.\n---\n\n^1\nFirst line\nSecond line\n', { fileName: 'song.md' })
  const pinned = core.addSongResource(project, document)
  project = core.addProjectItem(pinned.project, { id: 'song', kind: 'song', title: 'A Song',
    variants: { english: { mode: 'content', resourceId: pinned.resourceId }, russian: { mode: 'inherit', from: 'english' }, media: { mode: 'derive', from: 'english', transform: { id: 'first-lines', version: 1, maxLines: 2 } } },
    primaryChannelId: 'english', arrangement: [{ id: 'one', sectionId: 'verse-1' }] })
  const passagesByChannel = Object.fromEntries(['english', 'russian', 'media'].map(channel => [channel, {
    reference: 'Psalms 18:16-35', translationId: channel === 'english' ? 'BSB' : 'SYNO-W', attribution: 'Source credit',
    verses: Array.from({ length: 20 }, (_, index) => ({ number: 16 + index, text: channel === 'english' ? 'Exact English verse text, preserved without paraphrase.' : 'Точный русский текст стиха, без сокращений и изменений.' })),
  }]))
  project = core.addBibleItem(project, { id: 'reading', title: 'Psalm reading', range: { bookId: 'Ps', start: { chapter: 18, verse: 16 }, end: { chapter: 18, verse: 35 } }, passagesByChannel })
  return project
}

function reopen(project: any) {
  return core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({ ...project, revision: 1 }))).project
}

test('long Scripture becomes real synchronized, projector-sized cues and survives native round-trip', () => {
  const original = fixture()
  const before = JSON.stringify(original)
  const prepared = preparePlannerPresentation(original)
  assert.equal(prepared.changed, true)
  assert.equal(prepared.readingsSplit, 1)
  const project = reopen(prepared.project)
  const pages = project.items.reading.childIds.map((id: string) => project.items[id])
  assert.equal(pages.length, 5)
  assert.equal(pages[0].title, 'Psalms 18:16–19')
  assert.equal(pages.at(-1).title, 'Psalms 18:32–35')
  for (const channel of original.channelIds) {
    assert.deepEqual(pages.flatMap((item: any) => item.passagesByChannel[channel].verses), original.items.reading.passagesByChannel[channel].verses)
    pages.forEach((item: any) => {
      assert.equal(item.passagesByChannel[channel].attribution, 'Source credit')
      assert.ok(item.passagesByChannel[channel].contentSha256)
      assert.equal(item.presetId, 'wotbc-reading')
      assert.equal(item.passagesByChannel[channel].verses.length, 4)
    })
  }
  const timeline = core.compileServiceProject(project)
  assert.equal(timeline.cueIds.filter((id: string) => timeline.cues[id].kind === 'bible').length, 5)
  assert.equal(JSON.stringify(original), before)
  assert.equal(preparePlannerPresentation(project).changed, false)
  assert.deepEqual(preparePlannerPresentation(project).project, project)
})

test('compact titles credit authors without projecting import notes or changing library metadata', () => {
  const original = fixture()
  const project = reopen(preparePlannerPresentation(original).project)
  assert.deepEqual(project.resources, original.resources)
  const timeline = core.compileServiceProject(project)
  const title = timeline.cues[timeline.cueIds[0]]
  for (const channel of project.channelIds) {
    assert.deepEqual(title.channels[channel].blocks, [
      { type: 'text', role: 'title', text: 'A Song' },
      ...(channel !== 'media' ? [{ type: 'text', role: 'credit', text: 'A Writer' }] : []),
    ])
  }
})

test('explicit title choices are preserved; projection defaults do not override managers', () => {
  const project = JSON.parse(JSON.stringify(fixture()))
  project.items.song.variants.english.titleCardMode = 'full'
  assert.equal(preparePlannerPresentation(project).project.items.song.variants.english.titleCardMode, 'full')
})

test('the longest output controls verse boundaries; no translation is omitted or mismatched', () => {
  const item = JSON.parse(JSON.stringify(fixture().items.reading))
  item.passagesByChannel.russian.verses[0].text = 'Длинная строка для чтения на экране. '.repeat(11)
  const pages = scripturePages(item)
  assert.deepEqual(pages[0], [16])
  assert.deepEqual(pages.flat(), Array.from({ length: 20 }, (_, index) => 16 + index))
  for (const page of pages) for (const passage of Object.values(item.passagesByChannel) as any[]) {
    assert.ok(passage.verses.filter((verse: any) => page.includes(verse.number)).reduce((count: number, verse: any) => count + scriptureLineCount(`${verse.number} ${verse.text}`), 0) <= SCRIPTURE_PAGE_MAX_LINES)
  }
  item.passagesByChannel.russian.verses.pop()
  assert.throws(() => scripturePages(item), /same verses/)
})

test('splitting keeps group placement, operator notes and total planned duration without duplication', () => {
  let project = JSON.parse(JSON.stringify(fixture()))
  project.items.reading.plannedDurationSeconds = 300
  project.items.reading.operatorNotes = 'Reader walks up before this passage.'
  project = preparePlannerPresentation(project).project
  assert.equal(project.rootItemIds[1], 'reading')
  assert.equal(project.items.reading.plannedDurationSeconds, 300)
  assert.equal(project.items.reading.operatorNotes, 'Reader walks up before this passage.')
  for (const id of project.items.reading.childIds) assert.equal(project.items[id].plannedDurationSeconds, undefined)
})

test('stacked songs are identical on both audience screens; lower orange translation edits only its source', () => {
  let project: any = JSON.parse(JSON.stringify(fixture()))
  const ru = core.parseSongDocument('---\nid: song-ru\ntitle: Песня\nlanguage: ru\nauthors: A Writer\n---\n\n^1\nПервая строка\nВторая строка\n', { fileName: 'song-ru.md' })
  const pinned = core.addSongResource(project, ru)
  project = JSON.parse(JSON.stringify(pinned.project))
  project.items.song.variants.russian = { mode: 'content', resourceId: pinned.resourceId }
  project.items.song.variants.media.from = 'russian'
  project = reopen(preparePlannerPresentation(project).project)
  const rows = plannerSlides(project)
  const title = rows.find(row => row.itemId === 'song' && row.index === 0)!
  const lyrics = rows.find(row => row.itemId === 'song' && row.index === 1)!
  assert.deepEqual(title.cue!.channels.english.blocks, title.cue!.channels.russian.blocks)
  assert.equal(title.cue!.channels.english.blocks[0].text, 'Песня')
  assert.deepEqual(lyrics.cue!.channels.english.blocks, lyrics.cue!.channels.russian.blocks)
  assert.equal(lyrics.cue!.channels.english.blocks[0].text, 'Первая строка\nВторая строка')
  assert.equal(lyrics.cue!.channels.english.blocks[1].spans[0].foreground, '#ffc000')
  assert.equal(lyrics.cue!.channels.media.blocks.length, 1)
  const edited = editPlannerSlide(project, lyrics, 'russian', 1, 'Edited English')
  const after = plannerSlides(reopen(edited)).find(row => row.itemId === 'song' && row.index === 1)!
  assert.equal(after.cue!.channels.english.blocks[0].text, lyrics.cue!.channels.english.blocks[0].text)
  assert.equal(after.cue!.channels.english.blocks[1].text, 'Edited English')
  assert.deepEqual(project.resources, preparePlannerPresentation(project).project.resources)
  const off = JSON.parse(JSON.stringify(project))
  off.items.song.songPresentation.stackedTranslation = false
  const single = plannerSlides(reopen(off)).find(row => row.itemId === 'song' && row.index === 1)!
  assert.equal(single.cue!.channels.english.blocks.length, 1)
  assert.equal(single.cue!.channels.russian.blocks[0].text, 'Первая строка\nВторая строка')
  assert.notEqual(single.cue!.channels.english.blocks[0].text, single.cue!.channels.russian.blocks[0].text)
  const credited = editPlannerSlide(project, title, 'english', 2, 'Short credits')
  assert.equal(credited.items.song.songPresentation.credits, 'Short credits')
  assert.deepEqual(credited.resources, project.resources)
  assert.throws(() => core.normalizeServiceProject({ ...project, items: { ...project.items, song: { ...project.items.song,
    songPresentation: { ...project.items.song.songPresentation, primaryChannelId: 'media' } } } }), /Invalid song presentation/)
})

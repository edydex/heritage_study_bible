import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import { plannerSlides } from '../src/components/plannerSlides.ts'
import { plannerPreview } from '../src/components/plannerPreview.ts'
import singerPresentation from '../packages/service-core/node/services/project/SingerPresentation.js'

function fixture() {
  let project = core.createServiceProject({ id: 'singer-test', title: 'Sunday', serviceDate: '2026-08-23',
    preferredProfileId: 'main-sanctuary', presetPack: {id: 'main-sanctuary', version: 1, sha256: null},
    channels: [{id: 'english', label: 'English', language: 'en'}, {id: 'russian', label: 'Russian', language: 'ru'}, {id: 'media', label: 'Singers', language: 'ru'}] })
  const ids: Record<string, string> = {}
  for (const [id, text] of Object.entries({english: 'One\nTwo\nThree\nFour', russian: 'Первая\nВторая\nТретья\nЧетвёртая'})) {
    const result = core.addSongResource(project, core.parseSongDocument(`---\nid: song-${id}\ntitle: ${id}\nlanguage: ${id === 'russian' ? 'ru' : 'en'}\n---\n\n^1\n${text}\n`, {fileName: id + '.md'}))
    project = result.project; ids[id] = result.resourceId
  }
  project = core.addProjectItem(project, { id: 'song', kind: 'song', title: 'Test song',
    variants: { english: {mode: 'content', resourceId: ids.english}, russian: {mode: 'content', resourceId: ids.russian},
      media: {mode: 'derive', from: 'russian', transform: {id: 'first-lines', version: 1, maxLines: 2}}},
    primaryChannelId: 'english', arrangement: [{id: 'verse', sectionId: 'verse-1'}],
    titlePresetId: 'wotbc-song-title', lyricsPresetId: 'wotbc-song-stacked',
    songPresentation: {stackedTranslation: true, primaryChannelId: 'russian', secondaryChannelId: 'english', credits: 'Writer'}
  })
  return core.addProjectItem(project, {id: 'blank', kind: 'blank', title: 'Transition'})
}

test('singers keep all primary lines, not the condensed excerpt or audience stack', () => {
  const project = fixture()
  const rows = plannerSlides(project)
  const slide = rows.find(row => row.index === 1)!
  assert.equal(slide.cue!.channels.media.blocks[0].text, 'Первая\nВторая')
  const singer = plannerPreview(rows, slide, 'media')
  assert.equal(singer.output.blocks[0].text, 'Первая\nВторая\nТретья\nЧетвёртая')
  assert.equal(singer.output.blocks.length, 1)
  assert.equal(singer.presetId, 'wotbc-song-lyrics')
  assert.equal(plannerPreview(rows, slide, 'english').output.blocks[1].spans[0].fontScale, 0.96)
  assert.deepEqual(singer.next, {state: 'blank', text: ''})
  const changed = JSON.parse(JSON.stringify(project))
  changed.items.song.songPresentation.primaryChannelId = 'english'
  changed.items.song.songPresentation.secondaryChannelId = 'russian'
  const switched = plannerSlides(changed)
  assert.equal(plannerPreview(switched, switched.find(row => row.index === 1), 'media').output.blocks[0].text, 'One\nTwo\nThree\nFour')
  // Full source survives canonical timeline serialization as well as compilation.
  assert.ok(slide.cue!.channels.media.sourceBlocks)
})

test('next cue follows the service, distinguishes blank from end and uses one bounded Unicode line', () => {
  const rows = plannerSlides(fixture())
  const title = rows[0]
  assert.deepEqual(plannerPreview(rows, title, 'media').next, {state: 'text', text: 'Первая'})
  assert.deepEqual(plannerPreview(rows, rows.at(-1), 'media').next, {state: 'end', text: ''})
  const next = {...rows[0], id: 'next-song', itemId: 'next-song'}
  assert.deepEqual(plannerPreview([...rows, next], rows.at(-1), 'media').next, {state: 'text', text: 'russian'})
  assert.equal(singerPresentation.singerNextLine('\n' + 'я'.repeat(80) + '\nDo not show this'), 'я'.repeat(80))
  assert.equal(singerPresentation.singerNextLine('😀'.repeat(71)), '😀'.repeat(71))
  assert.equal(singerPresentation.singerNextLine('i'.repeat(120)), 'i'.repeat(120))
  const bounded = singerPresentation.singerNextLine('😀'.repeat(1200))
  assert.ok(bounded.length <= 2000)
  assert.match(bounded, /^(?:😀)+…$/u)
  assert.equal(singerPresentation.singerNextLine('abc\r\ndef'), 'abc')
})

test('previewing every output leaves the draft unchanged and includes deliberate blank slides',()=>{
  const project=fixture()
  const before=JSON.stringify(project)
  const rows=plannerSlides(project)
  for (const row of rows.filter(row=>row.cue)) {
    for (const channel of ['english','russian','media']) {
      const preview=plannerPreview(rows,row,channel)
      assert.ok(preview.output)
      if (row.kind==='blank') assert.deepEqual(preview.output.blocks,[{type:'blank'}])
    }
  }
  assert.equal(JSON.stringify(project),before)
  assert.equal(rows.filter(row=>row.cue).length,3)
})

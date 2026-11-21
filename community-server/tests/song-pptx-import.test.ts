import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import { draftSongPptx, inspectSongPptx } from '../src/lib/songPptxImport'
import { songDocumentBody } from '../src/lib/songSourceSyntax'
import core from '../packages/service-core/index.js'
import songCore from '../packages/service-core/node/services/project/SongDocument.js'

const parse = (xml: string) => new DOMParser({onError: (_level, message) => {throw new Error(message)}}).parseFromString(xml, 'application/xml') as unknown as Document
const a = 'http://schemas.openxmlformats.org/drawingml/2006/main', p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const shape = (paragraphs: string[], x = 0, y = 0, attrs = '') => `<p:sp><p:nvSpPr><p:cNvPr id="1" ${attrs}/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/></a:xfrm></p:spPr><p:txBody>${paragraphs.map(text => `<a:p>${text}</a:p>`).join('')}</p:txBody></p:sp>`
const run = (text: string) => `<a:r><a:t>${text}</a:t></a:r>`
async function deck(slides: string[], order = slides.map((_, i) => i)) {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${p}" xmlns:r="${r}"><p:sldIdLst>${order.map(i => `<p:sldId id="${100 + i}" r:id="r${i}"/>`).join('')}</p:sldIdLst></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_, i) => `<Relationship Id="r${i}" Type="${r}/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`)
  slides.forEach((slide, i) => zip.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld xmlns:p="${p}" xmlns:a="${a}"><p:cSld><p:spTree>${slide}</p:spTree></p:cSld></p:sld>`))
  return zip.generateAsync({type:'uint8array', compression:'DEFLATE'})
}
const parsed = (lyrics: string, language: string): any => core.parseSongDocument(`---\nlanguage: ${language}\n---\n${songDocumentBody(lyrics)}`, {fileName:'test.song'})
test('PowerPoint breaks, split text runs, title credits and exact repeats survive bilingual import', async () => {
  const title = shape([run('Наш Бог') + '<a:br/>' + run('Our God'), run('Words and music by'), run('Writer One / Writer Two')])
  const verse = shape([run('Пер') + run('вая строка') + '<a:br/>' + run('Вторая строка'), run('First line') + '<a:br/>' + run('Second &amp; last line')])
  const inspection = await inspectSongPptx(await deck([title, verse, verse, '']), 'sample.pptx', parse)
  const result = draftSongPptx(inspection)
  assert.equal(result.russianTitle, 'Наш Бог'); assert.equal(result.title, 'Our God')
  assert.deepEqual(result.authors, ['Writer One','Writer Two']); assert.deepEqual(result.blankSlides, [4])
  assert.equal(result.lyricSlides, 2); assert.deepEqual(result.unresolved, [])
  assert.equal(result.russianLyrics, '^slide-2\nПервая строка\nВторая строка\n\n^slide-3\nПервая строка\nВторая строка')
  const ru = parsed(result.russianLyrics, 'ru'), en = parsed(result.lyrics, 'en')
  assert.deepEqual(ru.sections.map((s: any) => s.id), en.sections.map((s: any) => s.id))
  assert.equal(en.sections[0].slides[0].lines[1], 'Second & last line')
})
test('presentation relationships, shape coordinates and hidden/footer text determine reading order', async () => {
  const first = shape([run('English first'),run('English second')],0,200) + shape([run('Русская первая'),run('Русская вторая')],0,100)
    + shape([run('HIDDEN')],0,0,'hidden="1"')
    + '<p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p>' + run('99') + '</a:p></p:txBody></p:sp>'
  const second = shape([run('Русский следующий'),run('English next')])
  const inspection = await inspectSongPptx(await deck([first,second],[1,0]), 'order.pptx', parse)
  assert.deepEqual(inspection.slides[0].lines.map(line => line.text), ['Русский следующий','English next'])
  assert.deepEqual(inspection.slides[1].lines.map(line => line.text), ['Русская первая','Русская вторая','English first','English second'])
})
test('Russian-only text, embedded lookalikes and bilingual text without a line break do not invent words', async () => {
  const inspection = await inspectSongPptx(await deck([shape([run('Наш БогOur God')]), shape([run('Хвалим Tвое имя')]),shape([run('Славим имя')])]), 'source.pptx', parse)
  const result = draftSongPptx(inspection)
  assert.equal(result.title,'Our God'); assert.equal(result.russianTitle,'Наш Бог')
  assert.equal(result.lyrics,''); assert.match(result.russianLyrics,/Хвалим Tвое имя/)
  assert.deepEqual(result.unresolved,[])
  const solo = draftSongPptx({...inspection, slides: inspection.slides.slice(1)},false)
  assert.equal(solo.title,'source'); assert.equal(solo.defaultSongLanguage,'ru')
  const credits = await inspectSongPptx(await deck([shape([run('Наш Бог'),run('Words and music by'),run('Writer One')]), shape([run('Слава'),run('Хвала')])]),'credits.pptx',parse)
  const soloWithCredit = draftSongPptx(credits)
  assert.equal(soloWithCredit.title,'Наш Бог'); assert.deepEqual(soloWithCredit.authors,['Writer One'])
  const noTitle = await inspectSongPptx(await deck([shape(['One line','Two lines','Three lines','Four lines'].map(run)), shape(['Another line','Another two','Another three','Another four'].map(run))]),'no-title.pptx',parse)
  assert.equal(noTitle.firstSlideIsTitle,false)
  assert.equal(draftSongPptx(noTitle).lyricSlides,2)
})
test('missing translations retain matching slide IDs; unresolved text stays available for a language choice', async () => {
  const inspection = await inspectSongPptx(await deck([shape([run('Первый'),run('First')]), shape([run('Второй')]), shape([run('Третий'),run('Third'),run('Ελληνικά')])]), 'mixed.pptx', parse)
  const result = draftSongPptx(inspection,false)
  assert.deepEqual(result.missingLanguages,[{slide:2,language:'en'}])
  assert.deepEqual(result.unresolved,[{slide:3,text:'Ελληνικά'}])
  assert.deepEqual(parsed(result.lyrics,'en').sections.map((s: any) => s.id),['slide-1','slide-3'])
  assert.deepEqual(parsed(result.russianLyrics,'ru').sections.map((s: any) => s.id),['slide-1','slide-2','slide-3'])
})
test('verse/chorus labels are structure rather than projected lyrics, and literal caret text stays literal',async () => {
  const inspection = await inspectSongPptx(await deck([shape([run('Куплет 1'),run('Строка'),run('Verse 1'),run('A line')]),shape([run('Припев'),run('Другой текст'),run('Chorus'),run('^literal words')])]),'labels.pptx',parse)
  const result = draftSongPptx(inspection,false)
  assert.deepEqual(result.sectionLabels,['1: Куплет 1','1: Verse 1','2: Припев','2: Chorus'])
  const ru=parsed(result.russianLyrics,'ru'), en=parsed(result.lyrics,'en')
  assert.ok(songCore.compareSongSections(ru,en).compatible)
  assert.equal(en.sections[1].slides[0].lines[0],'^literal words')
})
test('corrupt packages, oversized XML, external slides and image-only files give actionable errors', async () => {
  await assert.rejects(inspectSongPptx(new Uint8Array([1,2,3]),'bad.pptx',parse),/readable PPTX/)
  await assert.rejects(inspectSongPptx(await deck(['']),'images.pptx',parse),/No editable text/)
  await assert.rejects(inspectSongPptx(await deck([shape([run('x'.repeat(2 * 1024 * 1024))])]),'huge.pptx',parse),/too much slide text/)
  const zip = await JSZip.loadAsync(await deck([shape([run('Words')])]))
  zip.file('ppt/_rels/presentation.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r0" Type="'+r+'/slide" Target="https://example.test/slide.xml" TargetMode="External"/></Relationships>')
  await assert.rejects(inspectSongPptx(await zip.generateAsync({type:'uint8array'}),'external.pptx',parse),/missing a slide/)
  zip.file('ppt/presentation.xml','<!DOCTYPE xml [<!ENTITY bad "bad">]><xml/>')
  await assert.rejects(inspectSongPptx(await zip.generateAsync({type:'uint8array'}),'entity.pptx',parse),/XML declarations/)
})

const samples = process.env.SONG_PPTX_SAMPLES_DIR
test('the 11 supplied song decks produce 88 aligned lyric slides without unresolved text', {skip: !samples}, async () => {
  const expected: Record<string, [number, boolean]> = {
    'Великий Бог!.pptx':[8,true], 'Говори Господи!.pptx':[7,true], 'Господь - скала мой искупитель.pptx':[7,true],
    'Любовь Искупителя.pptx':[8,true], 'Милостивый Царь благой.pptx':[12,true], 'Мы славим Тебя.pptx':[8,false],
    'Не уходи Иисус.pptx':[6,false], 'О Великий Бог Творец.pptx':[9,false], 'Радуйтесь.pptx':[9,true],
    'Твоим рабом.pptx':[5,false], 'Я живу Христом.pptx':[9,true],
  }
  const names = (await readdir(samples!)).filter(name => name.endsWith('.pptx'))
  assert.equal(names.length,11)
  for (const name of names) {
    const inspection = await inspectSongPptx(await readFile(path.join(samples!,name)),name,parse)
    const result = draftSongPptx(inspection)
    assert.ok(inspection.firstSlideIsTitle,name); assert.deepEqual(result.unresolved,[],name)
    assert.deepEqual(result.missingLanguages,[],name); assert.equal(result.lyricSlides,expected[name][0],name)
    assert.equal(Boolean(result.lyrics),expected[name][1],name)
    assert.equal(result.blankSlides.length,1,name)
    const ru = parsed(result.russianLyrics,'ru')
    assert.equal(ru.sections.length,expected[name][0],name)
    if (result.lyrics) {
      const en = parsed(result.lyrics,'en')
      assert.ok(songCore.compareSongSections(ru,en).compatible,name)
    }
    // Every text line after the title appears exactly once in its source lane,
    // preserving run joins, manual breaks and later repeated occurrences.
    for (const language of ['ru','en'] as const) {
      const source = inspection.slides.slice(1).flatMap(slide => slide.lines.filter(line => line.language === language).map(line => line.text))
      const text = language === 'ru' ? result.russianLyrics : result.lyrics
      const actual = text.split('\n').filter(line => line && !line.startsWith('^slide-'))
      assert.deepEqual(actual,source,name+' '+language)
    }
  }
})

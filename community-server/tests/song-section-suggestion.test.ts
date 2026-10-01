import assert from 'node:assert/strict'
import test from 'node:test'
import { suggestEnglishSongSections } from '../src/lib/songSectionSuggestion.ts'
import { songDocumentBody } from '../src/lib/songSourceSyntax.ts'

const russian='Куплет 1\nРусская строка 1\nРусская строка 2\n\nРусская строка 3\nРусская строка 4\n\nПрипев\nПрипев строка 1\nПрипев строка 2\n\nКуплет 2\nВторая строка 1\nВторая строка 2\n\nПрипев x2'
const english='English one\nEnglish two\nEnglish three\nEnglish four\nChorus one\nChorus two\nSecond one\nSecond two'
test('wall of text becomes an editable proposal with matching sections, slide breaks and repeated choruses',()=>{
  const result=suggestEnglishSongSections(russian,english)
  assert.equal(result.repeats,2)
  assert.equal(result.text,'Verse 1\nEnglish one\nEnglish two\n\nEnglish three\nEnglish four\n\nChorus\nChorus one\nChorus two\n\nVerse 2\nSecond one\nSecond two\n\nChorus\n\nChorus')
  const expected=songDocumentBody(russian).replace(/[^\n]+/g,line=>line.startsWith('^')||line==='---'?line:'word')
  const actual=songDocumentBody(result.text).replace(/[^\n]+/g,line=>line.startsWith('^')||line==='---'?line:'word')
  assert.equal(actual,expected)
  assert.equal(english.split('\n').length,8)
})
test('already-expanded English repeats are reduced to repeat references without losing words',()=>{
  assert.equal(suggestEnglishSongSections(russian,english+'\nChorus one\nChorus two\nChorus one\nChorus two').text,suggestEnglishSongSections(russian,english).text)
})
test('mismatches and ambiguous repeats ask for manual work instead of inventing words',()=>{
  assert.throws(()=>suggestEnglishSongSections(russian,english+'\nextra'),/English has 9 lines/)
  assert.throws(()=>suggestEnglishSongSections(russian,'Verse 1\nWords'),/already has section labels/)
  assert.throws(()=>suggestEnglishSongSections('Куплет 1\nПервый\n\nКуплет 1\nДругой','One\nTwo'),/distinct labels/)
  assert.throws(()=>suggestEnglishSongSections(russian,english+'\nDifferent\nChorus two\nChorus one\nChorus two'),/different words/)
  assert.throws(()=>suggestEnglishSongSections('Строка\nСтрока','Line\nLine'),/labels to Russian/)
})

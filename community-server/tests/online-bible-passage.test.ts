import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLsbPassage, parseNasbPassage, onlineBiblePassage } from '../src/lib/bible/OnlineBiblePassage'
import { loadHeritageServiceBiblePassage } from '../src/lib/syncshow/HeritageServiceBibleLookup'
import { BibleImportError } from '../packages/bible-import/index.js'
import core from '../packages/service-core/index.js'

const range = {schemaVersion: 1 as const, bookId:'John',start:{chapter:8,verse:31},end:{chapter:8,verse:44}}
const selected = [31,32,44]
const reference = 'John 8:31-32,44'
const lsb = (verses = selected, ref = reference) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({page:'/ref-tagger',props:{pageProps:{query:ref,found:true,html:`<h3 class="head">Not verse text</h3>${verses.map(n=>`<span class="v" data-ref="43.8.${n}"><sup class="vn">${n}</sup><span class="ln">First <sup class="note xref"><a>a</a></sup><i>part</i> &amp;</span><span class="ln">second ${n}.</span></span>`).join('')}<aside>Footnotes</aside>`}}})}</script>`
const nasb = (verses = selected, book='John',chapter=8) => `<div class="bible-reference-verse-text"><div class="resourcetext">${verses.map((n,i)=>`<p><a rel="milestone" data-datatype="bible+nasb95" data-reference="${book} ${chapter}:${n}"></a>${i===0?'<span>A heading</span></p><p>':''}<span${i===0?' style="font-weight:bold"':''}>${n}</span> First <a rel="popup">a</a><span style="font-variant:small-caps">Lord</span> &amp; <i>part</i>.</p><p>Second ${n}.</p>`).join('')}</div><button>Expand</button></div><div class="resourcetext">Other translation preview</div>`

test('LSB extracts exact selected verse text without numbers, notes or headings',()=>{
  assert.deepEqual(parseLsbPassage(lsb(),range,selected,reference),selected.map(number=>({number,text:`First part & second ${number}.`})))
})
test('LSB rejects missing, duplicated, reordered and wrong-book verses or changed envelopes',()=>{
  for(const source of [lsb([31,32]),lsb([31,31,44]),lsb([32,31,44]),lsb().replaceAll('43.8.','42.8.'),lsb().replace('"found":true','"found":false'),lsb().replace('"query":','"other":'),'<script>alert(1)</script>'])
    assert.throws(()=>parseLsbPassage(source,range,selected,reference),/incomplete or unexpected/)
})
test('NASB isolates its own edition and strips headings, notes and expand controls',()=>{
  assert.deepEqual(parseNasbPassage(nasb(),range,selected),selected.map(number=>({number,text:`First LORD & part. Second ${number}.`})))
})
test('NASB poetry and chapter starts support singular Psalm labels and unbolded numbers',()=>{
  assert.deepEqual(parseNasbPassage(nasb([1,2],'Psalm',23),{...range,bookId:'Ps',start:{chapter:23,verse:1},end:{chapter:23,verse:2}},[1,2]).map(v=>v.number),[1,2])
})
test('NASB rejects truncation, missing numbers, extra verses and edition substitutions',()=>{
  for(const html of [nasb([31,32]),nasb([31,32,44,45]),nasb().replaceAll('bible+nasb95','bible+esv'),nasb().replace('Second 44.','Second …'),nasb().replace('<span>32</span>','<span>99</span>')])
    assert.throws(()=>parseNasbPassage(html,range,selected),/incomplete or unexpected/)
})
test('LSB request includes only selected verses and parses data without executing scripts',async()=>{
  const urls:string[]=[]
  const result=await onlineBiblePassage('LSB',range,selected,async(input,init)=>{
    urls.push(String(input));assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'manual')
    return new Response(lsb()+'<script>throw new Error("must not execute")</script>')
  })
  assert.equal(new URL(urls[0]).searchParams.get('ref'),reference)
  assert.equal(urls.length,1);assert.equal(result.passage.translationId,'LSB');assert.equal(result.passage.attribution,'(LSB)')
})
test('NASB splits nonsequential selection into exact contiguous requests',async()=>{
  const refs:string[]=[]
  const result=await onlineBiblePassage('NASB95',range,selected,async input=>{
    const ref=decodeURIComponent(new URL(String(input)).pathname.split('/').at(-1)!);refs.push(ref)
    return new Response(nasb(ref.endsWith('31-32')?[31,32]:[44]))
  })
  assert.deepEqual(refs,['John 8:31-32','John 8:44']);assert.deepEqual(result.passage.verses.map(v=>v.number),selected)
})
test('canonical redirects stay on the provider origin; private redirects are refused',async()=>{
  let calls=0
  const result=await onlineBiblePassage('NASB95',range,selected,async input=>{
    calls++;const url=new URL(String(input))
    if(url.pathname.includes('%'))return new Response(null,{status:301,headers:{location:'/bible/nasb95/john/8/'+(url.pathname.endsWith('31-32')?'31-32':'44')}})
    return new Response(nasb(url.pathname.endsWith('31-32')?[31,32]:[44]))
  })
  assert.equal(calls,4);assert.equal(result.passage.verses.length,3)
  calls=0
  await assert.rejects(onlineBiblePassage('LSB',range,selected,async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/secrets'}})}),/could not be reached/)
  assert.equal(calls,1)
})
test('timeouts, upstream errors and oversized streams cannot produce partial slides',async()=>{
  await assert.rejects(onlineBiblePassage('LSB',range,selected,async()=>{throw new Error('timeout')}),/could not be reached/)
  await assert.rejects(onlineBiblePassage('LSB',range,selected,async()=>new Response('',{status:503})),/temporarily unavailable/)
  await assert.rejects(onlineBiblePassage('LSB',range,selected,async()=>new Response('x'.repeat(2*1024*1024+1))),/incomplete or unexpected/)
  await assert.rejects(onlineBiblePassage('LSB',range,selected,async()=>new Response('',{headers:{'content-length':'999999999'}})),/incomplete or unexpected/)
})
test('pinned online verses survive service save/reopen without another network request',async()=>{
  let calls=0
  const response=await loadHeritageServiceBiblePassage(range,{verseNumbers:selected,translations:{english:'LSB',russian:'LSB'},fetchImpl:async()=>{calls++;return new Response(lsb())}})
  const project=core.createServiceProject({id:'online-bible-test',title:'Test',serviceDate:'2026-09-22',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
  const pinned=core.addBibleItem(project,{id:'reading',range,verseNumbers:selected,passagesByChannel:response.passagesByChannel,presetId:'wotbc-reading'})
  const reopened=core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...pinned,revision:1}))).project
  assert.equal(calls,1)
  assert.deepEqual(reopened.items.reading.passagesByChannel.english.verses,response.passagesByChannel.english.verses)
  assert.match(reopened.items.reading.passagesByChannel.english.contentSha256,/^[a-f0-9]{64}$/)
})
test('an installed edition takes priority; a damaged installed edition is not silently replaced',async()=>{
  const passage={reference,translationId:'LSB',attribution:'Installed edition',verses:selected.map(number=>({number,text:'Installed text.'}))}
  const result=await loadHeritageServiceBiblePassage(range,{verseNumbers:selected,translations:{english:'LSB',russian:'LSB'},fetchImpl:async()=>{throw Error('must not fetch')},importedPassage:async()=>({passage,sourceUrl:'https://example.com/licensed-edition'})})
  assert.equal(result.passagesByChannel.english.attribution,'Installed edition')
  await assert.rejects(loadHeritageServiceBiblePassage(range,{verseNumbers:selected,translations:{english:'LSB',russian:'LSB'},importedPassage:async()=>{throw new BibleImportError('BIBLE_INTEGRITY','Damaged installed edition',503)}}),/Damaged/)
})

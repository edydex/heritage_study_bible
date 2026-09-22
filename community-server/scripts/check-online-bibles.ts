// Opt-in network rehearsal. Prints identities/counts/hashes, never passage text.
// Run from community-server: node --import tsx scripts/check-online-bibles.ts
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { onlineBiblePassage } from '../src/lib/bible/OnlineBiblePassage'

const cases = [
  {bookId:'John',chapter:8,verses:[31,32,44]},
  {bookId:'Ps',chapter:119,verses:Array.from({length:14},(_,i)=>162+i)},
  {bookId:'1Chr',chapter:3,verses:[7,8,9,10]},
  {bookId:'Gen',chapter:1,verses:[1,2,3]},
  {bookId:'Esth',chapter:8,verses:[9]},
]
for (const id of ['LSB','NASB95']) {
  for (const item of cases) {
    const range = {schemaVersion:1 as const,bookId:item.bookId,start:{chapter:item.chapter,verse:item.verses[0]},end:{chapter:item.chapter,verse:item.verses.at(-1)!}}
    const result = await onlineBiblePassage(id,range,item.verses)
    assert.deepEqual(result.passage.verses.map(v=>v.number),item.verses)
    if (item.bookId === 'Esth') assert.ok(result.passage.verses[0].text.length > 450, 'Long verse must not be a truncated tooltip')
    assert.ok(result.passage.verses.every(v=>!v.text.includes('Expand') && !v.text.includes('Footnotes')))
    console.log(JSON.stringify({edition:id,reference:result.passage.reference,verses:result.passage.verses.length,sha256:createHash('sha256').update(JSON.stringify(result.passage)).digest('hex')}))
  }
}

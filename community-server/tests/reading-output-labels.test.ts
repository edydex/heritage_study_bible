import test from 'node:test'
import assert from 'node:assert/strict'
import core from '../packages/service-core/index.js'
import labels from '../packages/service-core/node/services/project/ReadingLabels.js'
import formatting from '../packages/service-core/node/services/project/SlideFormatting.js'

test('Russian reading labels preserve chapter selections, styling and authored topic wording',()=>{
 const text='Ephesians 4:17-25';
 const blocks=[{type:'canvas',objects:[{id:'reading-reference',type:'text',text,spans:[{start:0,end:text.length,weight:'700'}]},
  {id:'reading-edition',type:'text',text:'Russian Synodal Bible'}, {id:'reading-topic',type:'text',text:'Authored topic'}]}];
 const before=JSON.stringify(blocks);
 const localized=labels.localizeReadingBlocks(blocks,'ru');
 assert.equal(localized[0].objects[0].text,'Ефесянам 4:17-25');
 assert.deepEqual(localized[0].objects[0].spans,[{start:0,end:'Ефесянам 4:17-25'.length,weight:'700'}]);
 assert.equal(localized[0].objects[1].text,'Синодальный перевод');
 assert.equal(localized[0].objects[2].text,'Authored topic');
 assert.equal(JSON.stringify(blocks),before);
 assert.equal(labels.localizedReference('John 8:31-32,44','ru'),'Иоанна 8:31-32,44');
 assert.equal(labels.localizedReference('Ephesians 4:17-25','en'),text);
});
test('localized Scripture display preserves the pinned source and emphasis after the prefix',()=>{
 const passage={reference:'Ephesians 4:25',translationId:'SYNO-W',verses:[{number:25,text:'Текст стиха'}],spans:[{start:3,end:8,weight:'700'}]};
 const before=JSON.stringify(passage), display=formatting.scriptureDisplay(passage,'wotbc-sermon-scripture');
 assert.equal(display.text,'Ефесянам 4:25 Текст стиха');
 assert.equal(display.text.slice(display.spans[1].start,display.spans[1].end),'Текст');
 assert.equal(JSON.stringify(passage),before);
});
test('legacy reading title labels localize when compiled without rewriting the saved service',()=>{
 let p=core.createServiceProject({id:'reading-label',title:'Sunday',serviceDate:'2026-09-20',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'}]});
 p=core.addProjectItem(p,{id:'reading',kind:'sermon',sermonTemplate:'title',presetId:'wotbc-reading-title',title:'Reading',textByChannel:{english:'Ephesians 4:17-25\nBerean Standard Bible',russian:'Ephesians 4:17-25\nRussian Synodal Bible'}});
 const before=JSON.stringify(p), timeline=core.compileServiceProject(p),cue=timeline.cues[timeline.cueIds[0]];
 assert.match(cue.channels.russian.blocks[0].text,/Ефесянам 4:17-25\nСинодальный перевод/);
 assert.equal(JSON.stringify(p),before);
});

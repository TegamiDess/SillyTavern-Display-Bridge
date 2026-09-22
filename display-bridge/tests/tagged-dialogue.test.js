import test from 'node:test';import assert from 'node:assert/strict';
import {taggedDialogue} from '../adapters/tagged-dialogue.js';
import {DEFAULT_PRESET,parsePortraitDialogue} from '../adapters/portrait-dialogue.js';
const config={...DEFAULT_PRESET,format:{kind:'tagged',entries:[{kind:'dialogue',tag:'guide',speaker:'Alex',portrait:'guide',quoted:true}]}};
test('Quoted tagged speech accepts trailing translations in parentheses or kagikakko',()=>{
 for(const pair of ['(That is not fair!)','「That is not fair!」']){
  const raw=`<guide>"Zurui yo!" ${pair}</guide>`,p=parsePortraitDialogue(raw,config);assert.equal(p.unsupported,0);assert.equal(p.blocks.length,1);assert.equal(p.blocks[0].translatedDialogue,'That is not fair!');assert.equal(p.blocks[0].originalDialogue,'Zurui yo!');assert.equal(raw.slice(p.blocks[0].start,p.blocks[0].end),raw);
 }
 assert.equal(taggedDialogue('"Ohayou (Good morning)"',true).translatedDialogue,'Good morning');assert.equal(taggedDialogue('“Ohayou” 「Good morning」',true).originalDialogue,'Ohayou');
 assert.equal(taggedDialogue('"Sou" (Yes (indeed))',true).translatedDialogue,'Yes (indeed)');
});
test('Plain sounds, ambiguous/incomplete translations and unsafe markup never lose their source text',()=>{
 assert.deepEqual(taggedDialogue('"Mmph—! Nn... nnh..."',true),{dialogue:'Mmph—! Nn... nnh...'});
 for(const text of ['"Hello" (unfinished','"Hello" ()','"Hi" (aside) (translation)'])assert.equal(taggedDialogue(text,true).translatedDialogue,undefined);
 assert.equal(taggedDialogue('not quoted',true),null);assert.equal(taggedDialogue('"'+ 'a'.repeat(12001)+'"',true),null);
 assert.equal(parsePortraitDialogue('<guide>"Hi" (Hello)',config).incomplete,1);
 assert.equal(parsePortraitDialogue('<guide>"Hi" (<img src=x onerror=run()>)</guide>',config).blocks.length,0);
 assert.equal(parsePortraitDialogue('```\n<guide>"Hi" (Hello)</guide>\n```',config).blocks.length,0);
});

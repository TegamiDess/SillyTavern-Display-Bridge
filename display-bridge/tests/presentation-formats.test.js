import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_PRESET,validatePortraitPreset,parsePortraitDialogue} from '../adapters/portrait-dialogue.js';
import {discoverProfile,profileConflicts} from '../core/profiles.js';
import {inspectPresentationRule} from '../adapters/presentation-recognition.js';
import {COMMUNITY_PATTERN} from '../adapters/presentation-formats.js';
const config=format=>validatePortraitPreset({...DEFAULT_PRESET,format});
const rule={type:'editdisplay',in:'<guide>"(.*?)"</guide>',out:'<div class="neutral-dialogue-container"><div class="neutral-character-area"><img src="{{raw::guide}}"></div><div class="neutral-character-fullname">Alex</div><div class="neutral-dialogue-text">$1</div></div>'};
const discover=rules=>discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:rules}});
test('Common quoted tags combine different speakers without author or card identifiers',()=>{
 const second={...rule,in:rule.in.replaceAll('guide','curator'),out:rule.out.replaceAll('Alex','Robin').replace('raw::guide','raw::curator')};const r=discover([rule,second]);assert(r.profile);assert(r.discovery.rules.every(x=>x.status==='adapted'));const c=r.profile.adapters[0].source;assert.equal(c.format.entries.length,2);const blocks=parsePortraitDialogue('<guide>"Hello"</guide><curator>"Welcome"</curator>',c).blocks;assert.deepEqual(blocks.map(b=>[b.speaker,b.portrait,b.dialogue]),[['Alex','guide','Hello'],['Robin','curator','Welcome']]);
});
test('Recency wrapper, metadata, mismatched tags and incomplete streaming are bounded',()=>{
 const wrapped={...rule,out:'{{#if {{greater_equal::{{chat_index}}::{{? {{lastmessageid}}-10}}}}}}'+rule.out+'{{/if}}'};const r=inspectPresentationRule(wrapped,{optionsPreserved:true});assert.equal(r.entry.recent,11);
 const c=config({kind:'tagged',entries:[r.entry,{kind:'narration',tag:'narration'},{kind:'status',tag:'Status',recent:6}]});const message='<guide>"Hello"</guide>\n[Status|18:00|Friday|2026-09-22|Museum]';assert.equal(parsePortraitDialogue(message,c,[],11).blocks.filter(x=>x.suppressed).length,2);assert.equal(parsePortraitDialogue('<guide>"Half',c).incomplete,1);assert.equal(parsePortraitDialogue('<guide>"Wrong"</other>',c).blocks.length,0);assert.equal(parsePortraitDialogue('`'+message.split('\n')[0]+'`',c).blocks.length,0);
});
test('Dynamic portrait-name tags require matching closing tags and use a fixed speaker',()=>{
 const c=config({kind:'tagged',entries:[{kind:'dynamic',speaker:'Robin'}]});assert.equal(parsePortraitDialogue('<Smile.1>Hello</Smile.1>',c).blocks[0].portrait,'Smile.1');assert.equal(parsePortraitDialogue('<Smile.1>Hello</Other.1>',c).blocks.length,0);
});
test('Twelve-field community input preserves all values and requires straight image quotes',()=>{
 const text='<img="reader.webp">\n[ID: A1 | Name: Alex | Age: 14 | Class: Reading]\n[Loc: Library | Attire: Cardigan | Equipment: Notebook | Interests: Books]\n[Mood: Curious | Allocation: Approved]\n[Personality: Helps at the library.]';const c=config({kind:'community'});const d=parsePortraitDialogue(text,c).blocks[0];assert.equal(d.profileFields.length,11);assert.equal(d.profileFields.at(-1)[1],'Helps at the library.');assert.equal(d.speaker,'Alex');assert.equal(parsePortraitDialogue(text.replace('"reader.webp"','“reader.webp”'),c).blocks.length,0);assert.equal(parsePortraitDialogue('```\n'+text+'\n```',c).blocks.length,0);assert.equal(new RegExp(COMMUNITY_PATTERN).exec(text).length,13);
});
test('Scene declarations validate up to four portraits, hover names and inert dialogue',()=>{
 const c=config({kind:'scene',open:'<scene>',close:'</scene>'});const d={speaker:'Alex',dialogue:'Text </scene> remains quoted.',portraits:[{image:'guide',hover:'guide-smile'}],background:'room'};assert.equal(parsePortraitDialogue('<scene>'+JSON.stringify(d)+'</scene>',c).blocks[0].portraits[0].hover,'guide-smile');for(const extra of [{portraits:Array(5).fill({image:'guide'})},{script:'run()'},{portraits:[{image:'x',onclick:'run()'}]}])assert.equal(parsePortraitDialogue('<scene>'+JSON.stringify({...d,...extra})+'</scene>',c).unsupported,1);
});
test('Unsupported matching options, executable templates and ambiguous tags cannot auto-enable',()=>{
 for(const r of [{...rule,matchOptions:{flag:'i'}},{...rule,out:rule.out.replace('<img','<img onerror="run()"')},{...rule,out:rule.out+'<script>run()</script>'}])assert.equal(discover([r]).profile,null);
 assert.equal(discover([rule,{...rule,out:rule.out.replace('Alex','Someone else')}]).profile,null);assert.throws(()=>config({kind:'tagged',entries:[{kind:'dialogue',tag:'x',speaker:'Alex',portrait:'a'},{kind:'narration',tag:'x'}]}));
});
test('New formats report native regex conflicts and reject overlapping explicit tags',()=>{
 const p=discover([rule]).profile;assert.equal(profileConflicts(p,[{findRegex:rule.in,scriptName:'Existing display'}]).length,1);
 assert.throws(()=>config({kind:'tagged',entries:[{kind:'dynamic',speaker:'Alex'},{kind:'narration',tag:'Smile.1'}]}));
 const p2={adapters:[{id:'portrait-dialogue',source:config({kind:'community'})}]};assert.equal(profileConflicts(p2,[{findRegex:COMMUNITY_PATTERN}]).length,1);
});

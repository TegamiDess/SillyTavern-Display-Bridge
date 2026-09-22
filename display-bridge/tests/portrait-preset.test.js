import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PRESET,validatePortraitPreset,parsePortraitDialogue,portraitActions,REFERENCE_RULE} from '../adapters/portrait-dialogue.js';
import {validateProfile,discoverProfile,profileFromSettings,profileConflicts} from '../core/profiles.js';
import {createPreferences} from '../core/preferences.js';
import {initialState,reduceAction} from '../core/actions.js';
const base=()=>structuredClone(DEFAULT_PRESET);
const profile=source=>({kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:1,source}]});
test('Two unrelated field grammars use the same portable portrait preset',()=>{
 const a=validatePortraitPreset(base()),b=base();b.format={kind:'json',open:'<scene>',close:'</scene>',fields:{speaker:'who',dialogue:'says',portrait:'sprite',location:'where'}};b.variants=[{id:'coat',label:'Coat',images:{guide:'guide-coat'}}];
 const first=parsePortraitDialogue('[Scene|speaker:Alex|text:Welcome.|image:guide|place:Observatory]',a).blocks[0];
 const second=parsePortraitDialogue('<scene>{"who":"Robin","says":"A | B and </scene> stay literal.","sprite":"guide","where":"Museum"}</scene>',validatePortraitPreset(b)).blocks[0];
 assert.equal(first.location,'Observatory');assert.equal(second.dialogue,'A | B and </scene> stay literal.');assert.equal(second.type,first.type);assert.deepEqual(validateProfile(profile(b)),profileFromSettings({adapters:['portrait-dialogue'],portraitSource:validatePortraitPreset(b)}));
});
test('Preset rejects executable overrides, resource CSS, collisions and undeclared fields',()=>{
 for(const change of [c=>c.lua='run()',c=>c.theme.accent='url(https://example.com)',c=>c.format.fields.dialogue='speaker',c=>c.variants=[{id:'original',label:'Other',images:{}}],c=>c.format.fields.speaker='__proto__',c=>c.theme.position='fixed']){const c=base();change(c);assert.throws(()=>validatePortraitPreset(c));}
});
test('Recognition requires the exact reviewed rule, not author, labels or similar HTML',()=>{
 const rule={...REFERENCE_RULE,label:'Any author'};
 const r=discoverProfile({sourceVersion:1,risuai:{customScripts:[rule]}});assert.equal(r.profile.adapters[0].id,'portrait-dialogue');assert.equal(r.discovery.rules[0].status,'adapted');
 const unknown=discoverProfile({sourceVersion:1,risuai:{customScripts:[{...rule,out:'similar looking markup'}]}});assert.equal(unknown.profile,null);
 assert.equal(discoverProfile({sourceVersion:1,risuai:{customScripts:[{...rule,out:rule.out+'<script>run()</script>'}]}}).profile,null);
});
test('Complete blocks render while streaming tails, examples and ambiguous fields remain raw',()=>{
 const c=validatePortraitPreset(base()),text='[Scene|speaker:Alex|text:Hello|image:guide]';
 const r=parsePortraitDialogue(text+'\n'+text.slice(0,-1),c);assert.equal(r.blocks.length,1);assert.equal(r.incomplete,1);assert.equal(r.blocks[0].end,text.length);
 assert.equal(parsePortraitDialogue('`'+text+'`\n\\'+text,c).blocks.length,0);
 for(const wrong of [text.replace('text:Hello','text:Hello|text:Other'),text.replace('text:Hello','unknown:Hello'),text.replace('speaker:Alex','speaker:')])assert.equal(parsePortraitDialogue(wrong,c).unsupported,1);
 assert.equal(parsePortraitDialogue(text,c,[[0,text.length]]).blocks.length,0);
});
test('Configurable selections are typed and scoped to display state',()=>{
 const c=base();c.variants=[{id:'casual',label:'Casual',images:{guide:'casual-guide'}}];const def=portraitActions(c),start=initialState(def),changed=reduceAction(def,start,'choose-casual');assert.equal(changed.variant,'casual');assert.equal(start.variant,'original');assert.throws(()=>reduceAction(def,start,'choose-unknown'));assert.deepEqual(reduceAction(def,changed,'reset'),start);
 assert.equal(profileConflicts(profile(validatePortraitPreset(c)),[{findRegex:REFERENCE_RULE.in,scriptName:'Conflicting panel'}]).length,1);
});
test('Preset preferences survive serialization and keep characters/chats/configurations separate',()=>{
 let storage={},save=()=>{};const api=()=>createPreferences({state:()=>storage,save});let p=api();const d=initialState(portraitActions(base()));p.setPreset('a','chat',{signature:'one',state:{...d,image:false},previous:d});p.set('a','chat','report');
 storage=JSON.parse(JSON.stringify(storage));p=api();assert.equal(p.getPreset('a','chat','one').state.image,false);assert.equal(p.get('a','chat'),'report');assert.equal(p.getPreset('a','other','one'),null);assert.equal(p.getPreset('b','chat','one'),null);assert.equal(p.getPreset('a','chat','two'),null);
 const exported=p.exportFor('a');assert.equal(exported.schemaVersion,2);p.importFor('b',exported);assert.deepEqual(p.getPreset('b','chat','one').previous,d);p.reset('a','chat');assert.equal(p.getPreset('a','chat','one'),null);assert(p.getPreset('b','chat','one'));
});
test('Malformed preference imports fail before touching saved choices; old preference files remain supported',()=>{
 const storage={},p=createPreferences({state:()=>storage,save:()=>{}});p.set('a','chat','report');const snapshot=JSON.stringify(storage);assert.throws(()=>p.importFor('a',{kind:'display-bridge-preferences',schemaVersion:2,chats:[{chat:'chat',mode:'auto',preset:{signature:'x',state:{script:'run()'}}}]}));assert.equal(JSON.stringify(storage),snapshot);p.importFor('a',{kind:'display-bridge-preferences',schemaVersion:1,chats:[{chat:'chat',mode:'roster'}]});assert.equal(p.get('a','chat'),'roster');
});

test('Preference exports with many large preset signatures can be imported again',()=>{
 const storage={},p=createPreferences({state:()=>storage,save:()=>{}}),state=initialState(portraitActions(base()));
 const signature='\\'.repeat(100000);
 for(let i=0;i<200;i++)p.setPreset('a','chat-'+i,{signature,state,previous:null});
 const exported=p.exportFor('a');assert(JSON.stringify(exported).length>24000000);
 const restored={},q=createPreferences({state:()=>restored,save:()=>{}});q.importFor('a',exported);assert.deepEqual(q.exportFor('a'),exported);
});

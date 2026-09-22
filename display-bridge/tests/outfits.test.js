import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_PRESET,validatePortraitPreset,portraitActions} from '../adapters/portrait-dialogue.js';
import {appearanceChoices,mappedPortraitReference,preservePortraitMappings} from '../adapters/portrait-mappings.js';
import {validateProfile,portraitVersion} from '../core/profiles.js';
import {initialState,reduceAction} from '../core/actions.js';
import {createPreferences} from '../core/preferences.js';
const config=()=>validatePortraitPreset({...DEFAULT_PRESET,variants:[{id:'school',label:'School',images:{guide:'guide',curator:'curator'}},{id:'casual',label:'Casual',images:{guide:'guide-coat',curator:'curator-coat'}}],appearance:{allowOriginal:false,defaultVariant:'school'},portraitLabels:{guide:'Alex',curator:'Robin'}});
test('Required outfits start and reset to a valid named choice; old profiles retain As written',()=>{
 const c=config(),d=portraitActions(c);assert.deepEqual(appearanceChoices(c).map(v=>v.id),['school','casual']);assert.equal(initialState(d).variant,'school');
 const changed=reduceAction(d,initialState(d),'choose-casual');assert.equal(mappedPortraitReference(c,'guide',changed.variant),'guide-coat');assert.equal(mappedPortraitReference(c,'curator',changed.variant),'curator-coat');assert.equal(mappedPortraitReference(c,'other',changed.variant),'other');
 assert.equal(reduceAction(d,changed,'reset').variant,'school');assert.throws(()=>reduceAction(d,changed,'choose-original'));
 assert.equal(initialState(portraitActions(DEFAULT_PRESET)).variant,'original');assert.equal(appearanceChoices(DEFAULT_PRESET)[0].id,'original');
 c.appearance.allowOriginal=true;c.appearance.defaultVariant='casual';assert.equal(initialState(portraitActions(c)).variant,'casual');assert.equal(appearanceChoices(c)[0].id,'original');
});
test('Outfit and identity metadata round trip as v5; older adapters must reject',()=>{
 const c=config();assert.equal(portraitVersion(c),5);const p={kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:5,source:c}]};assert.deepEqual(validateProfile(p),p);
 for(const version of [1,2,3,4])assert.throws(()=>validateProfile({...p,adapters:[{...p.adapters[0],version}]}));
 const labelsOnly={...DEFAULT_PRESET,portraitLabels:{guide:'Alex'}};assert.equal(portraitVersion(labelsOnly),5);validatePortraitPreset(labelsOnly);
});
test('Invalid default, required empty options, malformed policies and dangerous label keys reject',()=>{
 for(const appearance of [null,{},true,{allowOriginal:false,defaultVariant:'original'},{allowOriginal:false,defaultVariant:'missing'},{allowOriginal:'no',defaultVariant:'school'},{allowOriginal:true,defaultVariant:'school',script:'run'}])assert.throws(()=>validatePortraitPreset({...config(),appearance}));
 assert.throws(()=>validatePortraitPreset({...config(),variants:[]}));assert.throws(()=>validatePortraitPreset({...config(),format:{kind:'community'}}));
 for(const portraitLabels of [{guide:''},{guide:'a'.repeat(81)},JSON.parse('{"__proto__":"x"}'),{guide:42}])assert.throws(()=>validatePortraitPreset({...config(),portraitLabels}));
});
test('Migration normalizes saved and undo selections to required default without changing visibility or other chats',()=>{
 const storage={},p=createPreferences({state:()=>storage,save(){}}),state={visual:false,image:false,dialogue:true,console:false,variant:'original'};
 for(const id of ['a','b'])p.setPreset(id,'chat',{signature:'old',state,previous:{...state,variant:'removed'}});
 p.migratePreset('a','old','new',['school','casual'],config().appearance);const next=p.getPreset('a','chat','new');assert.deepEqual(next.state,{...state,variant:'school'});assert.equal(next.previous.variant,'school');assert.equal(p.getPreset('b','chat','old').state.variant,'original');
 p.setPreset('a','chosen',{signature:'new',state:{...state,variant:'casual'},previous:null});p.migratePreset('a','new','renamed',['school','casual'],config().appearance);assert.equal(p.getPreset('a','chosen','renamed').state.variant,'casual');
 p.migratePreset('a','renamed','removed',['school'],config().appearance);assert.equal(p.getPreset('a','chosen','removed').state.variant,'school');
});
test('Reimport keeps local outfit policy and character labels alongside newly discovered source styling',()=>{
 const c=config(),incoming=validatePortraitPreset({...DEFAULT_PRESET,theme:{...DEFAULT_PRESET.theme,accent:'#123456'}});const merged=validatePortraitPreset(preservePortraitMappings(incoming,c));assert.deepEqual(merged.appearance,c.appearance);assert.deepEqual(merged.portraitLabels,c.portraitLabels);assert.equal(merged.theme.accent,'#123456');assert.equal(portraitVersion(merged),5);
});

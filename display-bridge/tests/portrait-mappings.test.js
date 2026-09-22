import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_PRESET,validatePortraitPreset,portraitActions} from '../adapters/portrait-dialogue.js';
import {mappedPortraitReference,preservePortraitMappings} from '../adapters/portrait-mappings.js';
import {validateProfile,portraitVersion} from '../core/profiles.js';
import {createPreferences} from '../core/preferences.js';import {initialState} from '../core/actions.js';
const preset=patch=>validatePortraitPreset({...DEFAULT_PRESET,...patch});
test('Exact default mappings are single-pass; explicit appearance overrides use the original reference',()=>{
 const c=preset({imageMappings:{guide:'replacement',replacement:'never-chain'},variants:[{id:'casual',label:'Casual',images:{guide:'coat'}}]});
 assert.equal(mappedPortraitReference(c,'guide'),'replacement');assert.equal(mappedPortraitReference(c,'guide','casual'),'coat');assert.equal(mappedPortraitReference(c,'Guide'),'Guide');assert.equal(mappedPortraitReference(c,'unknown'),'unknown');
 assert.equal(portraitVersion(c),3);const p={kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:3,source:c}]};assert.deepEqual(validateProfile(p),p);assert.throws(()=>validateProfile({...p,adapters:[{...p.adapters[0],version:2}]}));
});
test('Mapping configuration remains inert, bounded and rejects malformed fields',()=>{
 for(const patch of [{imageMappings:JSON.parse('{"__proto__":"x"}')},{imageMappings:{x:''}},{imageMappings:{x:3}},{metadataLabels:{location:'',onclick:'run()'}},{defaults:{image:'false'}},{defaults:{unknown:true}},{imageMappings:Object.fromEntries(Array.from({length:201},(_,i)=>['x'+i,'y']))}])assert.throws(()=>preset(patch));
 const c=preset({metadataLabels:{location:'<img src=x onerror=run()>'},defaults:{image:false}});assert.equal(initialState(portraitActions(c)).image,false);
});
test('Reimport merges exact IDs and local maps while retaining new source styling; formats never cross',()=>{
 const current=preset({imageMappings:{guide:'mine'},variants:[{id:'casual',label:'My casual',images:{guide:'coat'}}],metadataLabels:{location:'Place'},defaults:{console:false}});
 const incoming=preset({imageMappings:{guide:'source',new:'new-image'},variants:[{id:'casual',label:'Source casual',images:{guide:'new-coat'}},{id:'work',label:'Work',images:{guide:'work'}}],theme:{...DEFAULT_PRESET.theme,accent:'#112233'}});
 const merged=validatePortraitPreset(preservePortraitMappings(incoming,current));assert.equal(merged.imageMappings.guide,'mine');assert.equal(merged.imageMappings.new,'new-image');assert.equal(merged.variants[0].images.guide,'coat');assert.equal(merged.variants[1].id,'work');assert.equal(merged.theme.accent,'#112233');assert.equal(merged.defaults.console,false);assert.equal(incoming.imageMappings.guide,'source');
 const other=preset({format:{kind:'community'}});assert.equal(preservePortraitMappings(other,current),other);
});
test('Preference migration preserves all chats for one identity, stable selections and undo; removed options fall back',()=>{
 const storage={},p=createPreferences({state:()=>storage,save:()=>{}}),state={visual:true,image:false,dialogue:true,console:false,variant:'casual'};
 for(const [id,chat]of [['a','one'],['a','two'],['b','one']])p.setPreset(id,chat,{signature:'old',state,previous:{...state,variant:'removed'}});
 p.setPreset('a','unrelated',{signature:'other',state,previous:null});p.migratePreset('a','old','new',['casual']);
 for(const chat of ['one','two']){assert.deepEqual(p.getPreset('a',chat,'new').state,state);assert.equal(p.getPreset('a',chat,'new').previous.variant,'original');}
 assert(p.getPreset('b','one','old'));assert(p.getPreset('a','unrelated','other'));assert.equal(p.getPreset('a','one','old'),null);
 p.migratePreset('a','new','removed',[]);assert.equal(p.getPreset('a','one','removed').state.variant,'original');assert.equal(p.getPreset('a','one','removed').state.image,false);
});

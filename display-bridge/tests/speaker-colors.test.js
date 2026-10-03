import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSceneText} from '../adapters/scene-text.js';
import {discoverProfile,validateProfile,portraitVersion} from '../core/profiles.js';
import {validatePortraitPreset} from '../adapters/portrait-dialogue.js';
import {createPreferences} from '../core/preferences.js';
import {detailedSceneRules} from './browser/scene-fixture.js';
const palette=()=>({version:1,speakers:{alex:{label:'Alex',color:'#83baff'},river:{label:'River',color:'#25202e'}},narrationTags:['log','plain']});
test('Speaker identity survives inline marks, adjacent speakers and neutral narration without altering text',()=>{
 const text='<text="alex">Hello <b>there</b>.</text><text="river">Good morning.</text><text="log">Sunrise.</text><text="unknown">Welcome.</text>',p=parseSceneText(text,true,palette());
 assert.equal(p.dialogue,parseSceneText(text,true).dialogue);assert.deepEqual(p.dialogueRuns.filter(r=>r.speaker==='alex').map(r=>r.text),['Hello ','there','.']);assert(p.dialogueRuns.some(r=>r.speaker==='river'&&r.text==='Good morning.'));assert(p.dialogueRuns.some(r=>r.kind==='narration'&&!r.speaker&&r.text==='Sunrise.'));assert(p.dialogueRuns.some(r=>r.speaker==='unknown'));
});
test('Portable palette requires adapter 14 and rejects executable CSS, conflicts and unbounded entries',()=>{
 const p=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules()}}).profile,s=p.adapters[0].source;s.speakerColors=palette();p.adapters[0].version=portraitVersion(s);assert.equal(p.adapters[0].version,14);assert.deepEqual(validateProfile(p),p);p.adapters[0].version=13;assert.throws(()=>validateProfile(p),/14/);
 for(const mutate of [c=>c.speakers.alex.color='url(https://invalid)',c=>c.speakers.alex.color='red',c=>c.narrationTags.push('alex'),c=>c.speakers.alex.css='x',c=>c.narrationTags=['log','log'],c=>c.version=2]){const candidate=structuredClone(s);mutate(candidate.speakerColors);assert.throws(()=>validatePortraitPreset(candidate),/Speaker colours/);}
});
test('Colour toggle persists with opacity and round-trips only through explicit preferences',()=>{
 const data={},p=createPreferences({state:()=>data,save(){}});p.setAppearance('one','chat',{dialogue:60,status:100,colors:false});const backup=p.exportFor('one');assert.equal(backup.schemaVersion,4);p.importFor('two',backup);assert.equal(p.getAppearance('two','chat').colors,false);assert.equal(p.getAppearance('one','other'),null);assert.throws(()=>p.importFor('two',{...backup,schemaVersion:3}));
});

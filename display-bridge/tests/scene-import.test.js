import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDisplaySource} from '../../v3-asset-sprites/display-handoff.js';
import {discoverProfile,validateProfile} from '../core/profiles.js';
import {initialStory,applyStory,parseStoryUpdates,storySnapshot} from '../adapters/scene-state.js';
import {sceneImportCard} from './fixtures/scene-import.js';
const discover=(card=sceneImportCard())=>discoverProfile(captureDisplaySource(card));

test('Source-only import assembles scene, drawer, music and typed state into a portable v9 profile',()=>{
 const r=discover();assert.ok(r.profile,JSON.stringify(r.notes));assert.equal(r.profile.adapters[0].version,9,JSON.stringify(r.notes));assert.equal(r.requiresReview,false,JSON.stringify(r.notes));
 const p=r.profile.adapters[0].source;assert.equal(p.sceneControls.roster.entities.length,2);assert.equal(p.sceneControls.music.tracks.length,2);assert.equal(p.sceneState.rules.length,4);
 assert.equal(p.sceneControls.music.volume,0.1,'Newly assembled scene profiles start at the lowest saved non-muted volume');
 assert.ok(r.discovery.effects.every(e=>e.status==='adapted'));assert.deepEqual(validateProfile(JSON.parse(JSON.stringify(r.profile))),r.profile);
 const old=structuredClone(r.profile);old.adapters[0].version=8;assert.throws(()=>validateProfile(old),/version 9/);
 const card=sceneImportCard();card.data.extensions.display_bridge_profile=r.profile;card.data.extensions.risuai.customScripts=[];
 assert.deepEqual(discover(card).profile,r.profile);assert.equal(discover(card).discovery.sceneAssembly,null);
});
test('Compiled annotations retain entity/case, finite values, integer deltas, track order and stop behavior',()=>{
 const s=discover().profile.adapters[0].source.sceneState;
 const source='<move_GUIDE_Library><❤guide+4><❤guide-1><관계=guide=Friend><BGM=@BGM_02_Morning>';
 const values=applyStory(initialStory(s),parseStoryUpdates(source,s),s);assert.equal(values.guide_loc,'Library');assert.equal(values.guide_p,8);assert.equal(values.guide_badge,'badge1');assert.equal(storySnapshot(values,s).track,'track2');
 const typo='<@BGM=@BGM_02_Morning>';assert.equal(parseStoryUpdates(typo,s).length,1);assert.equal(applyStory(values,parseStoryUpdates(typo,s),s).sceneTrack,'track2');
 const priorProfile={...s,literals:s.literals.filter(l=>!l.text.startsWith('<@BGM=')),strictPrefixes:['<BGM=@BGM_']};assert.equal(parseStoryUpdates(typo,priorProfile).length,1,'Existing profiles gain the compatibility alias at runtime');
 assert.equal(parseStoryUpdates('<@BGMoff>',s).length,1);assert.equal(applyStory(values,parseStoryUpdates('<@BGMoff>',s),s).sceneTrack,null);
 for(const bad of ['<BGM=@BGM_99_Morning>','<BGM=@BGM_02_Unknown>','<@BGM=@BGM_99_Morning>','<@BGM=@BGM_02_Unknown>','<관계=guide=Other>','<❤guide+1.5>','<❤guide+-2>','<move_guide_'])assert.throws(()=>parseStoryUpdates(bad,s),bad);
 assert.deepEqual(parseStoryUpdates('<MOVE_unknown_Library>',s),[],'Only declared characters receive location updates');
 assert.equal(parseStoryUpdates('`<BGM=@BGM_02_Morning>` \\<❤guide+7>',s).length,0);assert.equal(parseStoryUpdates('`<@BGM=@BGM_02_Morning>`',s).length,0);
});
test('Unknown source dependencies and missing assets require review without invented values',()=>{
 const card=sceneImportCard(),r=card.data.extensions.risuai;card.data.assets=[];r.defaultVariables=r.defaultVariables.replace('guide_p=5','guide_p=???');card.data.first_mes='{{getvar::fm}}';r.triggerscript.push({type:'start',effect:[{type:'v2Random'}]});
 const result=discover(card);assert.equal(result.requiresReview,true);assert.equal(result.profile.adapters[0].source.sceneState.variables.guide_p.initial,null);assert.ok(result.discovery.sceneAssembly.some(c=>c.feature==='Asset'&&c.status==='missing'));assert.ok(result.discovery.sceneAssembly.some(c=>c.feature==='Startup / prompt macros'));
 assert.equal(result.discovery.effects.at(-1).status,'not-run');
});
test('Ambiguous source assembly rolls back atomically and cannot retain successful coverage',()=>{
 const card=sceneImportCard();card.data.extensions.risuai.defaultVariables+='\nguide_p=77';const r=discover(card);assert.equal(r.requiresReview,true);assert.equal(r.profile.adapters[0].source.sceneState,undefined);assert.deepEqual(r.discovery.sceneAssembly.map(c=>c.status),['needs-review']);assert.ok(r.discovery.effects.every(e=>e.status==='not-run'));
});
test('Older transport requests reattachment and unsupported output transforms stay visible',()=>{
 const source=captureDisplaySource(sceneImportCard());delete source.sceneSourceVersion;const old=discoverProfile(source);assert.equal(old.requiresReview,true);assert.equal(old.discovery.sceneAssembly[0].status,'needs-source');
 const card=sceneImportCard();card.data.extensions.risuai.customScripts.push({type:'editoutput',in:'unknown',out:'unknown2'});assert.ok(discover(card).discovery.sceneAssembly.some(c=>c.feature==='Other input/output rules'));
});
test('An explicit portable profile cannot erase unresolved prompt-macro warnings',()=>{
 const card=sceneImportCard();card.data.extensions.display_bridge_profile=discover(card).profile;card.data.first_mes='{{getvar::fm}}';const r=discover(card);assert.deepEqual(r.profile,card.data.extensions.display_bridge_profile);assert.equal(r.requiresReview,true);assert.ok(r.discovery.sceneAssembly.some(c=>c.feature==='Startup / prompt macros'));
});

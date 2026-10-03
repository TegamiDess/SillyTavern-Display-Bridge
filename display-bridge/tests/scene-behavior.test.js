import test from 'node:test';
import assert from 'node:assert/strict';
import {behaviorSource,motionCSS} from './fixtures/scene-behavior.js';
import {sceneMessage} from './browser/scene-fixture.js';
import {discoverProfile,validateProfile,portraitVersion} from '../core/profiles.js';
import {parsePortraitDialogue,validatePortraitPreset} from '../adapters/portrait-dialogue.js';
import {compileSceneBehavior} from '../adapters/scene-behavior.js';
import {preservePortraitMappings} from '../adapters/portrait-mappings.js';
import {makePortableCard} from '../../v3-asset-sprites/portable-card.js';
const profile=()=>discoverProfile(behaviorSource()).profile;
test('Source history and motion compile into portable version 18 without the optional voice adapters',()=>{
 const p=profile(),s=p.adapters[0].source;
 assert.deepEqual(s.sceneBehavior,{version:1,maxMessageDepth:3,cloudFade:true,portraitBreathing:true,portraitEntrance:true});
 assert.equal(portraitVersion(s),18);assert.deepEqual(validateProfile(p),p);
 const card=makePortableCard({data:{name:'Observatory history'},profile:p,rules:[],assets:[]});
 assert.deepEqual(discoverProfile({sourceVersion:1,profile:card.data.extensions.display_bridge_profile}).profile,p);
 p.adapters[0].version=14;assert.throws(()=>validateProfile(p),/version 18/);
 for(const version of [15,16,17]){p.adapters[0].version=version;assert.throws(()=>validateProfile(p),/unsupported/);}
});
test('Inclusive history boundary preserves dialogue and source spans at depth 4; zero and unlimited work',()=>{
 const s=profile().adapters[0].source,text=sceneMessage();
 const parse=depth=>parsePortraitDialogue(text,s,[],depth).blocks[0];
 for(const depth of [0,1,3])assert.equal(parse(depth).historyTextOnly,undefined);
 const old=parse(4),recent=parse(3);assert.equal(old.historyTextOnly,true);assert.equal(old.dialogue,recent.dialogue);assert.deepEqual(old.dialogueRuns,recent.dialogueRuns);assert.equal(old.start,recent.start);assert.equal(old.end,recent.end);
 s.sceneBehavior.maxMessageDepth=0;assert.equal(parse(0).historyTextOnly,undefined);assert.equal(parse(1).historyTextOnly,true);
 delete s.sceneBehavior.maxMessageDepth;assert.equal(parse(1000).historyTextOnly,undefined);
});
test('Conflicting, dynamic and invalid recency never silently impose a history cutoff',()=>{
 for(const mutate of [s=>s.risuai.customScripts[0].out=s.risuai.customScripts[0].out.replace('getvar::remove','getvar::other'),s=>s.risuai.customScripts[0].out=s.risuai.customScripts[0].out.replace(/^.*?(<img)/,'$1'),s=>s.risuai.triggerscript=[{effect:[{type:'v2SetVar',var:'remove',value:'8'}]}]]){
  const s=behaviorSource();mutate(s);const result=compileSceneBehavior(s,{remove:'3'});assert.equal(result.behavior.maxMessageDepth,undefined);assert(result.coverage.some(c=>c.feature==='Scene history'&&c.status==='partial'));
 }
 for(const value of ['-1','101','3.5','{{calc::3}}',undefined])assert.equal(compileSceneBehavior(behaviorSource(),{remove:value}).behavior.maxMessageDepth,undefined);
});
test('Motion requires reviewed keyframes and class/timing bindings, never names alone',()=>{
 for(const css of ['.fullBgImage3{animation-name:fadeEffect}',motionCSS.replaceAll('120s','2s').replaceAll('0.7s,4s','1s,1s'),motionCSS.replace('opacity:0.5','opacity:0.2').replaceAll('scaleY(1.01)','scaleY(2)').replace('translateY(40px)','translateY(90px)')]){
  const s=behaviorSource();s.risuai.backgroundHTML=css;const b=compileSceneBehavior(s,{remove:'3'}).behavior;assert.equal(b.cloudFade,undefined);assert.equal(b.portraitBreathing,undefined);assert.equal(b.portraitEntrance,undefined);
 }
});
test('Behavior validation and rescan retain an explicit unlimited, motion-disabled choice',()=>{
 const s=profile().adapters[0].source;
 for(const value of [{version:2},{version:1,maxMessageDepth:-1},{version:1,maxMessageDepth:3.1},{version:1,cloudFade:'yes'},{version:1,css:'animation:foo'}])assert.throws(()=>validatePortraitPreset({...s,sceneBehavior:value}),/Scene behavior/);
 const current={...s,sceneBehavior:{version:1,cloudFade:false,portraitBreathing:false,portraitEntrance:false}};
 assert.deepEqual(preservePortraitMappings(s,current).sceneBehavior,current.sceneBehavior);
});

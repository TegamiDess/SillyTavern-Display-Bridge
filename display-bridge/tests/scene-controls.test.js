import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneControls,sceneSnapshot,suffix,neutralWav} from './fixtures/scene-controls.js';
import {validateSceneControls,validateSceneSnapshot} from '../adapters/scene-controls.js';
import {validatePortraitPreset,parsePortraitDialogue,portraitActions} from '../adapters/portrait-dialogue.js';
import {discoverProfile,validateProfile,portraitVersion} from '../core/profiles.js';
import {detailedSceneRules,sceneMessage} from './browser/scene-fixture.js';
import {createSceneAudio} from '../core/scene-audio.js';
import {createPreferences} from '../core/preferences.js';
import {initialState,reduceAction} from '../core/actions.js';
import {resolveAudio} from '../integrations/assets.js';
import {audioAssets,sniffAudio,localAudioURL} from '../../v3-asset-sprites/audio-assets.js';
import {packageAudio} from '../../v3-asset-sprites/portable-card.js';
const clone=x=>structuredClone(x),config=()=>validatePortraitPreset({...discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules()}}).profile.adapters[0].source,sceneControls:clone(sceneControls)});
test('Scene control profile v7 bounds entities, tracks and badge tables; old versions reject new controls',()=>{
 const c=config();assert.equal(portraitVersion(c),7);const profile={kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:7,source:c}]};assert.deepEqual(validateProfile(profile),profile);profile.adapters[0].version=6;assert.throws(()=>validateProfile(profile));
 for(const mutate of [c=>c.roster.entities.push(c.roster.entities[0]),c=>c.roster.entities[0].id='__proto__',c=>c.music.tracks[0].script='x',c=>c.music.volume=Infinity,c=>c.version=2]){const bad=clone(sceneControls);mutate(bad);assert.throws(()=>validateSceneControls(bad));}
});
test('Scene snapshots stay on their own source ranges, preserve unknowns and never inherit another scene',()=>{
 const c=config(),first=sceneMessage()+suffix(sceneSnapshot),second=sceneMessage('four','2',1)+suffix({roster:[{id:'alex',score:99}],track:null}),third=sceneMessage('four','3',0);
 const parsed=parsePortraitDialogue(first+'\n'+second+'\n'+third,c);assert.equal(parsed.blocks.length,3);assert.deepEqual(parsed.blocks[0].sceneSnapshot,sceneSnapshot);assert.equal(parsed.blocks[1].sceneSnapshot.roster[0].score,99);assert.equal(parsed.blocks[2].sceneSnapshot,undefined);assert.equal(parsed.blocks[0].end,first.length);assert.equal(sceneSnapshot.roster[1].score,null);
});
test('Invalid, partial and unsupported snapshots stay in original text; prototype and nonfinite values reject',()=>{
 const c=config();for(const data of [{roster:[{id:'absent'}]},{roster:[{id:'alex',score:NaN}]},{roster:[{id:'alex',badge:'other'}]},{track:'other'},{script:'x'}])assert.throws(()=>validateSceneSnapshot(data,c.sceneControls));
 for(const tail of ['<scene-state>{','<scene-state>{"track":"other"}</scene-state>']){const source=sceneMessage()+tail,p=parsePortraitDialogue(source,c);assert.equal(p.blocks.length,1);assert.equal(p.blocks[0].end,sceneMessage().length);assert.ok(p.blocks[0].snapshotIssue);}
});
test('Music preferences persist independently, reset correctly, and reject malformed volume imports',()=>{
 const state={};const p=createPreferences({state:()=>state,save(){}}),def=portraitActions(config());let view=initialState(def);view=reduceAction(def,view,'volume-8');view=reduceAction(def,view,'music');p.setPreset('card','chat',{signature:'v7',state:view,previous:null});assert.equal(p.getPreset('card','chat','v7').state.volume,8);assert.equal(p.getPreset('card','other','v7'),null);assert.equal(reduceAction(def,view,'reset').volume,2);const exported=p.exportFor('card');exported.chats[0].preset.state.volume=11;assert.throws(()=>p.importFor('card',exported));
});
function fake(){return {paused:true,attrs:{},volume:1,events:{},plays:0,pauses:0,addEventListener(n,f){this.events[n]=f;},set src(v){this.attrs.src=v;},getAttribute(k){return this.attrs[k];},removeAttribute(k){delete this.attrs[k];},load(){},pause(){this.paused=true;this.pauses++;},async play(){this.plays++;this.paused=false;}};}
test('Single audio owner stops on invalidation, does not restart on sweeps and never autoplays from state',async()=>{
 const player=fake(),audio=createSceneAudio({createAudio:()=>player});let valid=true;const owner={key:'a',url:'/user/files/a.wav',volume:.2,loop:true,valid:()=>valid};audio.sweep();assert.equal(player.plays,0);await audio.play(owner);audio.sweep();audio.sweep();assert.equal(player.plays,1);assert.equal(player.volume,.2);await audio.play({...owner,key:'b'});assert.equal(audio.status('a').playing,false);assert.equal(audio.status('b').playing,true);valid=false;audio.sweep();assert.equal(player.attrs.src,undefined);assert.equal(audio.status('b').playing,false);
});
test('Late audio play promises cannot revive a retired owner and blocked playback is reported',async()=>{
 const player=fake();let finish;player.play=()=>new Promise(r=>finish=r);const audio=createSceneAudio({createAudio:()=>player}),owner={key:'a',url:'/user/files/a.wav',volume:.2,loop:false,valid:()=>true};const pending=audio.play(owner);audio.stop();finish();assert.equal(await pending,false);assert.equal(player.attrs.src,undefined);player.play=async()=>{throw Error('blocked');};await audio.play(owner);assert.match(audio.status('a').error,/unavailable/);
});
test('State-driven music transitions require prior Play, preserve intent through suspension and respect Pause',async()=>{
 const player=fake();player.pause=function(){const playing=!this.paused;this.paused=true;if(playing)this.events.pause?.();};player.play=async function(){this.paused=false;this.plays++;this.events.play?.();};
 const audio=createSceneAudio({createAudio:()=>player}),owner={key:'a',url:'/user/files/a.wav',volume:.2,loop:false,valid:()=>true,autoTransition:true};
 audio.bind(owner);assert.equal(player.plays,0);await player.play();audio.suspend();audio.bind({...owner,key:'b',url:'/user/files/b.wav'});assert.equal(player.plays,2);
 player.pause();audio.bind({...owner,key:'c',url:'/user/files/c.wav'});assert.equal(player.plays,2);await player.play();audio.stop();audio.bind(owner);assert.equal(player.plays,3);
});

test('Cancelled internal pause events do not consume the next real native Pause',async()=>{
 const player=fake();player.play=async function(){this.paused=false;this.plays++;this.events.play?.();};
 const audio=createSceneAudio({createAudio:()=>player}),owner={key:'a',url:'/user/files/a.wav',volume:.2,loop:false,valid:()=>true,autoTransition:true};
 audio.bind(owner);await player.play();audio.suspend();audio.bind({...owner,key:'b'});assert.equal(player.plays,2);
 player.events.pause();assert.equal(player.paused,false); // A late internal event during new playback.
 player.pause();player.events.pause();audio.bind({...owner,key:'c'});assert.equal(player.plays,2);
});
test('Audio validation accepts local typed assets and rejects remote paths, malformed bytes and image confusion',()=>{
 assert.equal(sniffAudio(neutralWav()),'wav');assert.equal(sniffAudio(new TextEncoder().encode('<html>not audio</html>')),null);assert.equal(localAudioURL('user/files/a b.wav'),'/user/files/a%20b.wav');for(const p of ['https://example/a.mp3','//host/a.wav','user/files/../a.wav','user/files/x.svg'])assert.equal(localAudioURL(p),null);
 const mp3=new Uint8Array(32);mp3.set([255,251,144,0]);assert.equal(sniffAudio(mp3),'mp3');const tagged=new Uint8Array(48);tagged.set([73,68,51,4,0,0,0,0,0,0]);tagged.set(mp3,10);assert.equal(sniffAudio(tagged),'mp3');tagged.fill(0,10);assert.equal(sniffAudio(tagged),null);
 const ogg=new Uint8Array(64);ogg.set(new TextEncoder().encode('OggS'));ogg[26]=1;ogg[27]=19;ogg.set(new TextEncoder().encode('OpusHead'),28);assert.equal(sniffAudio(ogg),'ogg');ogg.fill(0,28);assert.equal(sniffAudio(ogg),null);assert.equal(sniffAudio(new Uint8Array(32_000_001)),null);
 assert.equal(localAudioURL('user/images/Card/a.mp3'),'/user/images/Card/a.mp3');assert.equal(audioAssets([{name:'a',ext:'mp3'},{name:'b',ext:'png'},{name:'c',ext:'exe'}]).length,1);for(const url of ['https://example/a.mp3','/user/files/%2e%2e/a.mp3','/user/files/a.mp3?x'])assert.equal(resolveAudio('a','b',{audioApiVersion:1,resolveAudio:()=>({status:'resolved',url})}).status,'invalid-url');
});
test('Portable audio deduplicates bytes, retains exact names and reports missing files',async()=>{
 const bytes=neutralWav(),items=[{asset:{name:'evening'},path:'/user/files/a.wav'},{asset:{name:'alias'},path:'/user/files/a.wav'},{asset:{name:'missing'},path:null}];let reads=0;const p=await packageAudio(items,{readImage:async()=>{reads++;return bytes;}});assert.equal(reads,1);assert.equal(p.files.length,1);assert.equal(p.assets.length,2);assert.equal(p.assets[0].type,'x-risu-asset');assert.match(p.assets[0].uri,/assets\/other\/audio\/1.wav/);assert.deepEqual(p.missing,['missing']);assert.deepEqual(p.files[0].bytes,bytes);await assert.rejects(()=>packageAudio(items,{readImage:async()=>bytes,maxBytes:4}));
});

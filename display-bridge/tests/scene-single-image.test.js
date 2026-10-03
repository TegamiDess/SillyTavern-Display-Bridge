import test from 'node:test';
import assert from 'node:assert/strict';
import {singleSource,singleMessage} from './fixtures/single-image.js';
import {sceneMessage} from './browser/scene-fixture.js';
import {discoverProfile,validateProfile,portraitVersion} from '../core/profiles.js';
import {parsePortraitDialogue,validatePortraitPreset} from '../adapters/portrait-dialogue.js';
import {cleanSceneRequestText} from '../adapters/scene-request-cleanup.js';
import {compileSingleImage,validateSingleImage} from '../adapters/scene-single-image.js';
import {makePortableCard} from '../../v3-asset-sprites/portable-card.js';
const preset=()=>discoverProfile(singleSource()).profile.adapters[0].source;
test('Reviewed single-image source compiles to a portable bounded layout with history/motion retained',()=>{
 const d=discoverProfile(singleSource()),p=d.profile,s=p.adapters[0].source;
 assert.deepEqual(s.format.singleImage,{version:1,marker:'_ev_lying_',suffix:'.png',width:74,height:74});assert.equal(s.sceneBehavior.maxMessageDepth,3);assert.equal(p.adapters[0].version,20);assert(d.notes.some(n=>n.includes('Single-image portrait layout: ready')));
 const card=makePortableCard({data:{name:'SFW reading layout'},profile:p,rules:[],assets:[]});assert.deepEqual(discoverProfile({sourceVersion:1,profile:card.data.extensions.display_bridge_profile}).profile,p);
 p.adapters[0].version=19;assert.throws(()=>validateProfile(p),/version 20/);
});
test('Single-image tuple uses image-field offset, never a hover path or unused caption-field offset',()=>{
 const s=preset();for(const offset of ['60%','-10%','120px']){const r=parsePortraitDialogue(singleMessage(offset),s);assert.equal(r.blocks.length,1);const p=r.blocks[0].portraits[0];assert.equal(p.image,'guide_ev_lying_reading.png');assert.equal(p.hover,undefined);assert.equal(p.geometry,'single-image');assert.equal(p.offset.value,parseFloat(offset));assert.equal(p.tooltips,undefined);}
 const ordinary=parsePortraitDialogue(sceneMessage(),s).blocks[0];assert.equal(ordinary.portraits[0].hover,'guide-smile');assert.equal(ordinary.portraits[0].singleImage,undefined);
});
test('Ambiguous single-image names, invalid offsets and multi-cast special layouts remain unsupported',()=>{
 const s=preset();for(const text of [singleMessage('portrait.png'),singleMessage('101%'),singleMessage('calc(20%)'),singleMessage('20%','guide.png'),singleMessage('20%','guide_ev_lying_reading_ev_lying_rest.png'),singleMessage().replace('<1><img=','<2><img=')])assert.equal(parsePortraitDialogue(text,s).blocks.length,0);
 const legacy=structuredClone(s);delete legacy.format.singleImage;assert.equal(parsePortraitDialogue(singleMessage(),legacy).blocks.length,0);
 for(const text of ['```\n'+singleMessage()+'\n```','\\'+singleMessage()])assert.equal(parsePortraitDialogue(text,s).blocks.length,0);
});
test('Single-image scenes participate in history cutoff and outgoing cleanup without losing dialogue',()=>{
 const s=preset();s.sceneBehavior.cleanupOutgoing=true;assert(parsePortraitDialogue(singleMessage(),s,[],4).blocks[0].historyTextOnly);
 const c=cleanSceneRequestText(singleMessage(),s);assert.equal(c.scenes,1);assert(c.text.includes('Welcome to the observatory.'));assert(!c.text.includes('<img'));assert(!c.text.includes('guide_ev_lying'));
});
test('Single-image discovery rejects altered CSS, handlers, bindings, flags and gates',()=>{
 for(const mutate of [s=>s.risuai.backgroundHTML+='.character-clipperEV{width:50%}',s=>s.risuai.backgroundHTML=s.risuai.backgroundHTML.replace('width:74%','width:120%'),s=>s.risuai.customScripts[0].out=s.risuai.customScripts[0].out.replace('loading="lazy"','onclick="run()"'),s=>s.risuai.customScripts[0].out=s.risuai.customScripts[0].out.replace('top: $3','top: $4'),s=>{s.risuai.customScripts[0].ableFlag=true;s.risuai.customScripts[0].flag='i';},s=>s.risuai.customScripts[0].out=s.risuai.customScripts[0].out.replace('getvar::remove','getvar::other')]){
  const s=singleSource();mutate(s);const d=discoverProfile(s);assert.equal(d.profile.adapters[0].source.format.singleImage,undefined,String(mutate));assert(d.notes.some(n=>n.includes('Single-image portrait layout: needs-review')));
 }
 assert.equal(compileSingleImage({risuai:{customScripts:[]}},null).layout,null);
});
test('Explicit single-image contracts reject unsafe values and incompatible cast families',()=>{
 const s=preset();assert.equal(portraitVersion(s),20);
 for(const change of [{width:0},{height:Infinity},{marker:'x.*'},{suffix:'.svg'},{unknown:true}])assert.throws(()=>validateSingleImage({...s.format.singleImage,...change}),/Single-image/);
 s.format.castFields=2;assert.throws(()=>validatePortraitPreset(s),/four cast fields/);
});

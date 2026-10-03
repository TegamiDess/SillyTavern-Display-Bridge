import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSceneRequestText,projectSceneRequest} from '../adapters/scene-request-cleanup.js';
import {behaviorSource} from './fixtures/scene-behavior.js';
import {sceneMessage,detailedSceneRules} from './browser/scene-fixture.js';
import {discoverProfile,validateProfile,portraitVersion} from '../core/profiles.js';
import {validatePortraitPreset} from '../adapters/portrait-dialogue.js';
import {makePortableCard} from '../../v3-asset-sprites/portable-card.js';
const preset=()=>{const s=discoverProfile(behaviorSource()).profile.adapters[0].source;s.sceneBehavior.cleanupOutgoing=true;return s;};
const msg=(mes,is_user=false,extra={})=>({mes,is_user,is_system:false,name:is_user?'Visitor':'Guide',extra});
const nativeCopy=chat=>chat.filter(m=>!m.is_system).map((m,index)=>({...m,index}));

test('Cleanup removes only recognized scene markup and retains named dialogue, narration, inline content and explicit metadata',()=>{
 const s=preset();s.speakerColors={version:1,speakers:{alex:{label:'Alex',color:'#abcdef'}},narrationTags:['narration']};
 const message=sceneMessage().replace('<text="dialogue">Welcome to the observatory.</text>','<text="alex">Hello <strong>there</strong> &amp; welcome.</text><text="river">반갑습니다.</text>');
 const before='Unrelated <div>example</div>\n',after='\nKeep <MOVE_alex_library>.';
 const result=cleanSceneRequestText(before+message+after,s);
 assert.equal(result.scenes,1);assert(result.text.startsWith(before));assert(result.text.endsWith(after));
 assert.match(result.text,/Alex: Hello there & welcome\./);assert.match(result.text,/river: 반갑습니다\./);assert.match(result.text,/The guides prepare the telescope/);assert.match(result.text,/Time: 18:30/);
 assert.doesNotMatch(result.text,/<img|<ct|<text|tn=|guide-smile|weather/);
 const legacy=structuredClone(s);delete legacy.format.details;assert.match(cleanSceneRequestText(message,legacy).text,/Alex: Hello there & welcome/);
 const five=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules('five')}}).profile.adapters[0].source;
 assert.match(cleanSceneRequestText(sceneMessage('five'),five).text,/Date: 2026-09-22; Time: 18:30; Location: Observatory/);
});
test('Depth 3 is unchanged, depth 4 is cleaned, all saved fields and recent/user messages stay intact',()=>{
 const s=preset(),chat=[msg(sceneMessage()),msg(sceneMessage()),msg('Later',true),msg('Later',true),msg('Latest',true)];chat[0].extra.display_text='alternate display';chat[0].swipes=[chat[0].mes];
 const saved=JSON.stringify(chat),copy=nativeCopy(chat),result=projectSceneRequest(copy,s,chat);
 assert.equal(result.report.messages,1);assert.equal(result.report.scenes,1);assert(result.report.charactersRemoved>150);assert.doesNotMatch(result.messages[0].mes,/<img/);assert.equal(result.messages[1],copy[1]);assert.equal(result.messages[4],copy[4]);assert.equal(JSON.stringify(chat),saved);assert.notEqual(result.messages[0],chat[0]);assert.equal(result.messages[0].extra,chat[0].extra);
 assert.throws(()=>projectSceneRequest(chat,s,chat),/live history/);
 assert.deepEqual(projectSceneRequest(result.messages,s,chat).messages,result.messages,'Repeated intercept changed already-cleaned text');
});
test('Filtered hidden entries, duplicate text and prompt-regex edits map to full history; unknown entries are not guessed',()=>{
 const s=preset(),chat=[msg(sceneMessage()),msg('Same',true),{...msg('hidden'),is_system:true},msg('Same',true),msg('Same',true)];
 let result=projectSceneRequest(nativeCopy(chat),s,chat);assert.equal(result.report.messages,1,'Hidden entry did not count');
 chat.forEach((m,i)=>{m.send_date='date-'+i;delete m.extra;});const copy=nativeCopy(chat);copy[0].mes+='\nAppended attachment';assert.equal(projectSceneRequest(copy,s,chat).report.messages,1);
 const unfamiliar=msg(sceneMessage()+' Extra');assert.equal(projectSceneRequest([unfamiliar],s,chat).messages[0],unfamiliar);
});
test('Swipe omits its replacement target from age; continue and normal retain the full current window',()=>{
 const s=preset(),chat=[msg(sceneMessage()),msg('A',true),msg('B'),msg('C',true),msg('Being replaced')],copy=nativeCopy(chat).slice(0,-1);
 assert.equal(projectSceneRequest(copy,s,chat,{type:'swipe'}).report.messages,0);
 assert.equal(projectSceneRequest(nativeCopy(chat),s,chat,{type:'continue'}).report.messages,1);
 chat.pop();assert.equal(projectSceneRequest(nativeCopy(chat),s,chat,{type:'regenerate'}).report.messages,0);
});
test('Malformed/specialized scenes, escaped/code examples and structured state remain intact; multiple valid scenes clean independently',()=>{
 const s=preset(),message=sceneMessage();
 for(const text of ['```html\n'+message+'\n```','`'+message+'`','\\'+message,message.replace('"guide-smile"','"25%"'),message.replace('</div></div>',''),message.replace('Welcome to the observatory.','<unknown>Keep me</unknown>')])assert.equal(cleanSceneRequestText(text,s).text,text);
 const snapshot='<scene-state>{"roster":[{"id":"guide","score":10}]}</scene-state>';s.sceneControls={version:1,roster:{title:'Guides',entities:[{id:'guide',label:'Guide'}]}};
 assert(cleanSceneRequestText(message+snapshot,s).text.endsWith(snapshot));
 const twice=cleanSceneRequestText(message+'\nBetween\n'+message,s);assert.equal(twice.scenes,2);assert(twice.text.includes('\nBetween\n'));
});
test('Outgoing cleanup is explicit, portable as adapter 19, and needs a bounded depth',()=>{
 const s=preset(),chat=[msg(sceneMessage()),...Array.from({length:4},()=>msg('User',true))],copy=nativeCopy(chat);
 delete s.sceneBehavior.cleanupOutgoing;assert.equal(projectSceneRequest(copy,s,chat).messages,copy);s.sceneBehavior.cleanupOutgoing=true;
 assert.equal(portraitVersion(s),19);const p={kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:19,source:s}]};assert.deepEqual(validateProfile(p),p);
 const card=makePortableCard({data:{name:'SFW cleanup fixture'},profile:p,rules:[],assets:[]});assert.deepEqual(discoverProfile({sourceVersion:1,profile:card.data.extensions.display_bridge_profile}).profile,p);
 p.adapters[0].version=18;assert.throws(()=>validateProfile(p),/version 19/);
 delete s.sceneBehavior.maxMessageDepth;assert.throws(()=>validatePortraitPreset(s),/requires a history depth/);
 s.sceneBehavior.cleanupOutgoing='yes';assert.throws(()=>validatePortraitPreset(s),/must be boolean/);
});

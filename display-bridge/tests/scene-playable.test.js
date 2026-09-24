import test from 'node:test';
import assert from 'node:assert/strict';
import {scenePlayableCard} from './fixtures/scene-playable.js';
import {captureDisplaySource} from '../../v3-asset-sprites/display-handoff.js';
import {discoverProfile,validateProfile} from '../core/profiles.js';
import {parsePortraitDialogue} from '../adapters/portrait-dialogue.js';
import {createStoryState} from '../integrations/story-state.js';
import {projectSourceRequest,sourceMarkerRanges} from '../adapters/scene-source-context.js';
import {normalizeSceneAsset} from '../adapters/scene-normalization.js';
import {sceneAnnotationRanges} from '../adapters/scene-normalization.js';
import {makePlan} from '../core/pipeline.js';
const discover=(c=scenePlayableCard())=>discoverProfile(captureDisplaySource(c));
const msg=mes=>({mes,is_user:false,swipes:[mes],swipe_id:0});

test('Context-wrapper source compiles to portable v10 without importing history edits',()=>{
 const c=scenePlayableCard(),r=discover(c),a=r.profile.adapters[0];assert.equal(a.version,10);assert.equal(r.requiresReview,false,JSON.stringify(r.notes));
 assert.equal(a.source.sceneState.version,3);assert.match(a.source.sceneState.request.template,/\{guide_p\}/);assert.ok(!JSON.stringify(a.source).includes('v2ModifyChat'));
 assert.deepEqual(validateProfile(r.profile),r.profile);const old=structuredClone(r.profile);old.adapters[0].version=9;assert.throws(()=>validateProfile(old),/version 10/);
 c.data.extensions.display_bridge_profile=r.profile;assert.equal(discover(c).requiresReview,undefined);
});
test('Every altered context instruction and unresolved macro keeps the source under review',()=>{
 const count=scenePlayableCard().data.extensions.risuai.triggerscript.at(-2).effect.length;
 for(let i=0;i<count;i++){const c=scenePlayableCard();c.data.extensions.risuai.triggerscript.at(-2).effect[i].indent=99;const r=discover(c);assert.equal(r.profile.adapters[0].source.sceneState.request,undefined,'effect '+i);assert.ok(r.requiresReview);}
 for(const change of [c=>c.data.description='{{getvar::fm}}',c=>c.data.system_prompt='{{getvar::missing}}',c=>c.data.post_history_instructions='{{getvar::missing}}',c=>c.data.first_mes+='{{getvar::other}}',c=>c.data.extensions.risuai.defaultVariables+='{{getvar::unknown}}']){
  const c=scenePlayableCard();change(c);assert.ok(discover(c).requiresReview);
 }
 const s=captureDisplaySource(scenePlayableCard());delete s.contextSourceVersion;assert.equal(discoverProfile(s).profile.adapters[0].source.sceneState.request,undefined);
});
test('Normalization fixes only typed fields while retaining source positions and literal prose',()=>{
 const c=scenePlayableCard(),p=discover(c).profile.adapters[0].source,text=c.data.first_mes.replace('Welcome to the observatory.','The helper says <5> is a count.'),r=parsePortraitDialogue(text,p);
 // Unknown markup still falls back without consuming source.
 assert.equal(r.blocks.length,0);
 const valid=c.data.first_mes.replace('Welcome to the observatory.','The helper says hello.'),b=parsePortraitDialogue(valid,p).blocks[0];
 assert.equal(b.background,'BG_observatory.png');assert.equal(b.portraits[0].image,'guide');assert.equal(b.portraits[0].hover,'guide-smile');assert.match(b.dialogue,/helper/);assert.equal(valid.slice(b.start,b.end),valid.slice(valid.indexOf('<#1>')));
 assert.equal(parsePortraitDialogue(c.data.first_mes.replace('<5>','<4>'),p).blocks.length,0,'Incomplete count was guessed');
 assert.equal(parsePortraitDialogue(c.data.first_mes.replace('"helper-smile"','"50%"'),p).blocks.length,0,'Single-image/offset tuple was misread as a hover pair');
 assert.equal(parsePortraitDialogue('```\n'+c.data.first_mes+'\n```',p).blocks.length,0);
});
test('Literal substitutions run once per rule and have bounded expansion',()=>{
 assert.equal(normalizeSceneAsset('a_b',{assets:[{from:['a','b'],to:'b'}]}),'b_b');
 assert.throws(()=>normalizeSceneAsset('a'.repeat(256),{assets:[{from:['a'],to:'a'.repeat(100)}]}),/limit/);
 const c=scenePlayableCard();c.data.extensions.risuai.customScripts.push({type:'editoutput',in:'<5>',out:'<4>',ableFlag:false});const r=discover(c);assert.equal(r.profile.adapters[0].source.format.normalization,undefined);assert.ok(r.requiresReview,'Conflicting normalization did not roll back');
});
test('Declared zero-cast closure permits a background-only greeting without consuming following narration',()=>{
 const c=scenePlayableCard();c.data.extensions.risuai.customScripts.find(r=>r.in==='<0>').out='</div>';
 const p=discover(c).profile.adapters[0].source,source='<#1><img src="room"_"sky"_"weather"_"18:30"><0>\nPlain narration.';
 const b=parsePortraitDialogue(source,p).blocks[0];assert.equal(b.backgroundOnly,true);assert.equal(b.dialogue,'');assert.equal(source.slice(b.end),'\nPlain narration.');
 delete p.format.normalization.emptyZero;assert.equal(parsePortraitDialogue(source,p).blocks.length,0);
});
test('Missing background destinations are reported and never guessed',()=>{
 const c=scenePlayableCard(),rule=c.data.extensions.risuai.customScripts.find(r=>r.in.includes('(observatory)'));rule.in=rule.in.replace('(observatory)','(observatory|missing)');
 const r=discover(c);assert.ok(r.requiresReview);assert.match(r.discovery.sceneAssembly.find(c=>c.feature==='Scene normalization'&&c.status==='partial').reason,/1 background/);
 assert.equal(normalizeSceneAsset('BG_missing_night.png',r.profile.adapters[0].source.format.normalization,true),'BG_missing_night.png');
});
test('Request-only projection preserves user messages, code examples, shared objects and saved history',async()=>{
 const config=discover().profile.adapters[0].source,chat=[msg('{{getvar::fm}}&&& Hello. `&&&` \\&&&'),{is_user:true,mes:'&&& user text'}],ctx={chat,chatId:'qa',chatMetadata:{},onlineStatus:'connected',saveChat:async()=>{}};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'qa',config})});await host.rebuild();const before=JSON.stringify(ctx.chat);const copy=[...chat];host.intercept(copy,0,()=>assert.fail());assert.equal(copy[0].mes,' Hello. `&&&` \\&&&');assert.equal(copy[1],chat[1]);assert.equal(JSON.stringify(ctx.chat),before);
 let aborted=false;assert.throws(()=>host.intercept(chat,0,()=>aborted=true),/live history/);assert.ok(aborted);
 const projected=projectSourceRequest([msg('&&&')],config.sceneState.request);assert.equal(projected[0].mes,'');assert.equal(sourceMarkerRanges('`&&&`',config.sceneState.request).length,0);
});
test('Request context follows accepted output and swipe parents; cancellation never advances it',async()=>{
 const config=discover().profile.adapters[0].source,ctx={chat:[msg('Start')],chatId:'qa',chatMetadata:{},onlineStatus:'connected',saveChat:async()=>{}},host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'qa',config})});
 let aborted=false;assert.throws(()=>host.intercept([...ctx.chat],0,()=>aborted=true),/Initialize/);assert.ok(aborted);await host.rebuild();assert.match(host.context(),/score=5/);
 host.begin('normal',{},false);ctx.chat.push(msg('<❤guide+3><MOVE_guide_Library>'));await host.received(1,'normal');host.end();assert.match(host.context(),/score=8 \/ location=Library/);
 const m=ctx.chat[1];m.swipe_id=1;host.begin('swipe',{},false);assert.match(host.context(),/score=5 \/ location=Observatory/);host.cancel();await host.received(1,'swipe');m.swipe_id=0;host.invalidate();assert.match(host.context(),/score=8/);
});
test('Apostrophes in finite music labels are literal data, not expressions',()=>{
 const c=scenePlayableCard(),rule=c.data.extensions.risuai.customScripts.find(r=>r.in.includes('(Evening|Morning)'));rule.in=rule.in.replace('(Evening|Morning)',"(Evening|Morning|Guide's_Hop)");const r=discover(c);assert.equal(r.requiresReview,false);assert.ok(r.profile.adapters[0].source.sceneState.literals.some(l=>l.text==="<BGM=@BGM_02_Guide's_Hop>"));
});
test('Reviewed annotation cleanup is portable, display-only and protects code and ordinary prose',()=>{
 const c=scenePlayableCard();c.data.extensions.risuai.customScripts.push({type:'editdisplay',in:'!!(.+?)!!',out:'',ableFlag:false},{type:'editdisplay',in:'!히로인:(.+?)!',out:'',ableFlag:false});
 const p=discover(c).profile,a=p.adapters[0];assert.equal(a.version,11);assert.deepEqual(validateProfile(p),p);
 const old=structuredClone(p);old.adapters[0].version=10;assert.throws(()=>validateProfile(old),/version 11/);
 const source='Ordinary prose! !!Setup note!!\n!히로인:[guide/score:5]!\n`!!Example!!`\n\\!!Escaped!!\n!!Unclosed';
 const ranges=sceneAnnotationRanges(source,a.source.format.normalization);assert.deepEqual(ranges.map(([s,e])=>source.slice(s,e)),['!!Setup note!!','!히로인:[guide/score:5]!']);
 const plan=makePlan(source,{stream:false,portrait:a.source});assert.equal(plan.items.filter(i=>i.type==='story-cleanup').length,2);assert.ok(plan.source.includes('Ordinary prose!'));assert.ok(plan.source.includes('`!!Example!!`'));
 assert.equal(projectSourceRequest([msg(source)],a.source.sceneState.request)[0].mes,source,'Display cleanup changed model context');
 const other=scenePlayableCard();other.data.extensions.risuai.customScripts.push({type:'editdisplay',in:'!!(.+?)!!',out:'replacement',ableFlag:false});assert.equal(discover(other).profile.adapters[0].source.format.normalization.displayCleanup,undefined);
});

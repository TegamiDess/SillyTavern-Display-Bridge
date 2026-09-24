import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSceneState,parseStoryUpdates,applyStory,initialStory,storySnapshot,storyContext} from '../adapters/scene-state.js';
import {createStoryJournal,MESSAGE_KEY} from '../core/story-journal.js';
import {sceneStory as s} from './fixtures/scene-story.js';
import {sceneControls} from './fixtures/scene-controls.js';
const format={kind:'scene-fragments',backgrounds:['numbered-four'],counts:[0,1,2,3,4],castFields:4,dialogueOpeners:['double'],textTags:true};
import {createStoryState} from '../integrations/story-state.js';
const fresh=()=>structuredClone(s),msg=text=>({mes:text,is_user:false,swipe_id:0,swipes:[text]});
const make=saved=>createStoryJournal({config:s,owner:['character','chat'],saved});
test('State registry validates types, bounds, bindings and rejects executable or ambiguous configuration',()=>{
 assert.deepEqual(validateSceneState(s,sceneControls),s);
 for(const change of [x=>x.variables.score.initial=101,x=>x.roster[0].score='missing',x=>x.rules[0].template='{entity}{value}',x=>x.rules[0].code='evil()',x=>x.track='place',x=>x.roster[0].badge='place']){const x=fresh();change(x);assert.throws(()=>validateSceneState(x,sceneControls));}
});
test('Literal source templates preserve order, skip code and escapes, reject unknown entities atomically',()=>{
 const source='<❤alex+4><MOVE_alex_Library><relationship=alex=Friend><❤alex-2>';
 const ops=parseStoryUpdates(source,s),v=applyStory(initialStory(s),ops,s);assert.equal(v.score,12);assert.equal(v.place,'Library');assert.equal(v.badge,'friend');assert.equal(storySnapshot(v,s).roster[0].score,12);assert.match(storyContext(v,s),/Alex location: Library/);
 assert.equal(parseStoryUpdates('`<❤alex+99>` \\<❤alex+99>',s).length,0);
 assert.throws(()=>parseStoryUpdates('<❤unknown+1>',s));assert.throws(()=>applyStory(initialStory(s),parseStoryUpdates('<❤alex+91>',s),s));assert.equal(initialStory(s).score,10);
 assert.equal(storySnapshot({...v,track:null},s,'room').track,null,'A later track assignment must not be overwritten by the scene background while rendering');
});
test('Journal commits once, restores swipes, detects edits and preserves historical snapshots on reload',()=>{
 const chat=[msg('Start'),msg('<❤alex+4>')],j=make();j.rebuild(chat);assert.equal(j.read(chat).values.score,14);assert.equal(j.accept(chat,1),false);
 chat[1].swipes.push('<❤alex+8>');chat[1].swipe_id=1;chat[1].mes=chat[1].swipes[1];j.accept(chat,1);assert.equal(j.read(chat).values.score,18);
 chat[1].swipe_id=0;chat[1].mes=chat[1].swipes[0];assert.equal(j.read(chat).values.score,14);
 chat.push(msg('<❤alex+1>'));j.accept(chat,2);assert.equal(j.read(chat).views.get(chat[1]).after.score,14);
 const reloaded=make(j.save()),copy=structuredClone(chat);assert.equal(reloaded.read(copy).values.score,15);
 copy[1].mes='<❤alex+2>';assert.match(reloaded.read(copy).issue,/Message 1/);assert.throws(()=>reloaded.accept(copy,2));
 reloaded.rebuild(copy);assert.equal(reloaded.read(copy).values.score,13);
});
test('Saved state rejects another owner, changed semantics, corruption and unknown arithmetic bases',()=>{
 const chat=[msg('<❤alex+1>')],j=make();j.rebuild(chat);const saved=j.save();
 assert.throws(()=>createStoryJournal({config:s,owner:['other','chat'],saved}));
 const changed=fresh();changed.variables.score.initial=5;assert.throws(()=>createStoryJournal({config:changed,owner:['character','chat'],saved}));
 saved.records[0].updates[0].value=90;assert.throws(()=>make(saved));
 const unknown=fresh();unknown.variables.score.initial=null;assert.throws(()=>applyStory(initialStory(unknown),parseStoryUpdates('<❤alex+1>',unknown),unknown));
});
test('State history excludes pending swipe slots and is not merged with a different parent',()=>{
 const chat=[msg('Start'),msg('<❤alex+2>'),msg('<❤alex+3>')],j=make();j.rebuild(chat);const id=chat[1][MESSAGE_KEY];
 chat[1].swipe_id=1;assert.throws(()=>j.accept(chat,1));chat[1].swipes.push('<❤alex+4>');chat[1].mes=chat[1].swipes[1];j.accept(chat,1);assert.equal(chat[1][MESSAGE_KEY],id);assert.match(j.read(chat).issue,/Message 2/);
});
test('Host state requires initialization, saves changes, rejects cancelled output and keeps render pure',async()=>{
 const config={format,sceneState:s},ctx={chat:[msg('Start')],chatId:'chat',chatMetadata:{},saveChat:async()=>{},onlineStatus:'connected'};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});assert.match(host.read().issue,/Initialize/);await host.rebuild();
 host.begin('normal',{},false);ctx.chat.push(msg('<❤alex+3>'));host.cancel();await host.received(1,'normal');assert.equal(host.read().values.score,10);assert.ok(host.read().issue);
 ctx.chat.pop();host.invalidate();host.begin('normal',{},false);ctx.chat.push(msg('<❤alex+3>'));await host.received(1,'normal');host.end();assert.equal(host.read().values.score,13);
 const before=JSON.stringify(ctx.chatMetadata);host.read();host.read();assert.equal(JSON.stringify(ctx.chatMetadata),before);
});
test('Host rolls back journal on failed save and startup writes only the selected greeting',async()=>{
 const config={format,sceneState:{...fresh(),startup:{marker:'<scene-start>',choices:[{id:'library',label:'Library',text:'Welcome to the library.',values:{place:'Library'}},{id:'park',label:'Park',text:'Welcome to the park.',values:{place:'Park'}}]}}};
 const ctx={chat:[msg('<scene-start>')],chatId:'chat',chatMetadata:{},saveChat:async()=>{throw Error('disk');}};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});await assert.rejects(host.rebuild('library'),/disk/);assert.equal(ctx.chat[0].mes,'<scene-start>');assert.deepEqual(ctx.chatMetadata,{});
 ctx.saveChat=async()=>{};await host.rebuild('library');assert.equal(ctx.chat[0].mes,'Welcome to the library.');assert.equal(host.read().values.place,'Library');assert.ok(!JSON.stringify(ctx.chat).includes('Welcome to the park'));await assert.rejects(host.rebuild('park'),/fresh chat/);
});
test('Pending swipe request sees its parent state and successful replacement is applied once',async()=>{
 const config={format,sceneState:s},ctx={chat:[msg('Start'),msg('<❤alex+3>')],chatId:'chat',chatMetadata:{},saveChat:async()=>{},onlineStatus:'connected'};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});await host.rebuild();const m=ctx.chat[1];m.swipe_id=1;
 host.begin('swipe',{},false);assert.match(host.context(),/Alex score: 10/);
 m.mes='<❤alex+8>';m.swipes.push(m.mes);await host.received(1,'swipe');host.end();assert.equal(host.read().values.score,18);
 host.invalidate();assert.equal(host.read().values.score,18);m.swipe_id=0;m.mes=m.swipes[0];host.invalidate();assert.equal(host.read().values.score,13);
});

test('Failed swipe rollback refreshes cached state without a second host swipe event',async()=>{
 const config={format,sceneState:s},ctx={chat:[msg('Start'),msg('<❤alex+3>')],chatId:'chat',chatMetadata:{},saveChat:async()=>{},onlineStatus:'connected'};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});await host.rebuild();const m=ctx.chat[1],saved=JSON.stringify(ctx.chatMetadata);
 m.swipe_id=1;host.begin('swipe',{},false);m.mes='...';host.end();assert.match(host.read().issue,/Message 1/);
 m.swipe_id=0;m.mes=m.swipes[0];assert.equal(host.read().issue,null);assert.equal(host.read().values.score,13);assert.equal(JSON.stringify(ctx.chatMetadata),saved);
 m.mes='<❤alex+8>';assert.ok(host.read().issue,'An uncommitted edit cannot reuse accepted state');m.mes=m.swipes[0];assert.equal(host.read().values.score,13);
 host.begin('normal',{},false);assert.match(host.context(),/Alex score: 13/);host.cancel();
});
test('Streamed swipe accepts tooltip score captions without treating them as deltas',async()=>{
 const state=fresh();state.rules.push({template:'"❤{entity}+{value}"',op:'add',targets:{alex:'score'}});
 const config={format,sceneState:state},ctx={chat:[msg('Start'),msg('<❤alex+3>')],chatId:'chat',chatMetadata:{},saveChat:async()=>{},onlineStatus:'connected'};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});await host.rebuild();const m=ctx.chat[1];m.swipe_id=1;
 host.begin('swipe',{},false);ctx.streamingProcessor={isStopped:false,isFinished:true,abortController:new AbortController()};
 m.mes='<ct="@alex"_"Happy"_"❤alex:-5"_"Ready"><❤alex+2>';m.swipes.push(m.mes);
 await host.received(1,'swipe');host.end();assert.equal(host.read().issue,null);assert.equal(host.read().values.score,12);
 m.swipe_id=0;m.mes=m.swipes[0];host.invalidate();assert.equal(host.read().values.score,13);
 for(const invalid of ['"❤alex:5"','<ct="@alex"_"Happy"_"❤alex+oops"_"Ready">']){
  m.swipe_id=1;m.mes=invalid;host.invalidate();host.begin('swipe',{},false);await assert.rejects(host.received(1,'swipe'));host.end();
 }
 m.mes='<ct="@alex"_"Happy"_"❤alex+4"_"Ready">';host.invalidate();host.begin('swipe',{},false);await host.received(1,'swipe');host.end();assert.equal(host.read().values.score,14);
});
test('Malformed annotations and macro-like values cannot enter a state context',()=>{
 for(const source of ['<❤alex+','<❤alex+oops>','<MOVE_alex_{{setvar::secret::1}}>'])assert.throws(()=>parseStoryUpdates(source,s));
 const x=fresh();x.variables.place.initial='{{getvar::secret}}';assert.throws(()=>validateSceneState(x,sceneControls));
});

test('Untracked roster locations are skipped without discarding valid updates',()=>{
 const ignored=[],source='<MOVE_guest_Hall><MOVE_alex_Library><❤alex+2>';
 const updates=parseStoryUpdates(source,s,[],d=>ignored.push(d));
 assert.equal(updates.length,2);assert.equal(ignored.length,1);assert.equal(ignored[0].entity,'guest');
 const values=applyStory(initialStory(s),updates,s);assert.equal(values.place,'Library');assert.equal(values.score,12);assert.equal(Object.hasOwn(values,'guest'),false);
 assert.equal(parseStoryUpdates('`<MOVE_guest_Hall>` \\<MOVE_guest_Hall>',s,[],()=>assert.fail('code must stay inert')).length,0);
 for(const text of ['<MOVE_guest_{{bad}}>','<MOVE_{{bad}}_Hall>','<MOVE_guest_','<❤guest+1>','<relationship=guest=Friend>'])assert.throws(()=>parseStoryUpdates(text,s));
 const unbound=fresh();delete unbound.roster;assert.throws(()=>parseStoryUpdates('<MOVE_guest_Hall>',unbound));
 const nested=fresh();nested.rules.push({template:'"❤{entity}+{value}"',op:'add',targets:{alex:'score'}});
 assert.throws(()=>parseStoryUpdates('<MOVE_guest_"❤alex+2">',nested),/overlapping/);
 assert.throws(()=>parseStoryUpdates('<MOVE_guest_Hall>'.repeat(257),s),/too many/);
});

test('Ignored location diagnostics are console-only, deduplicated and absent from render/reload',async t=>{
 const warnings=[];t.mock.method(console,'warn',(...args)=>warnings.push(args.join(' ')));
 const config={format,sceneState:s},ctx={chat:[msg('Start')],chatId:'chat',chatMetadata:{},saveChat:async()=>{},onlineStatus:'connected'};
 const makeHost=()=>createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});
 const host=makeHost();await host.rebuild();host.begin('normal',{},false);
 ctx.chat.push(msg('<MOVE_guest_Private location><MOVE_alex_Library><❤alex+2>'));await host.received(1,'normal');host.end();
 assert.equal(host.read().issue,null);assert.equal(host.read().values.score,12);assert.equal(warnings.length,1);assert.match(warnings[0],/guest/);assert.ok(!warnings[0].includes('Private location'));
 const view=host.read().views.get(ctx.chat[1]);assert.equal(view.updates.length,2);assert.equal(view.cleanup.length,3);assert.ok(ctx.chat[1].mes.includes('<MOVE_guest_Private location>'),'Display cleanup preserves original message text');
 host.invalidate();host.read();makeHost().read();assert.equal(warnings.length,1);
 host.begin('normal',{},false);ctx.chat.push(msg('<MOVE_guest_Other>'));await host.received(2,'normal');host.end();assert.equal(warnings.length,1);assert.equal(host.read().issue,null);
 const m=ctx.chat[1];m.swipes.push('<MOVE_guest_Hall><❤alex+4>');m.swipe_id=1;m.mes=m.swipes[1];ctx.chat.pop();host.invalidate();host.begin('swipe',{},false);await host.received(1,'swipe');host.end();assert.equal(host.read().values.score,14);assert.equal(warnings.length,1);
 m.swipe_id=0;m.mes=m.swipes[0];host.invalidate();assert.equal(host.read().values.score,12);assert.equal(makeHost().read().values.place,'Library');
});

test('Native first-message reload cannot deadlock the initialization save queue',async()=>{
 const config={format,sceneState:{...fresh(),startup:{marker:'<scene-start>',choices:[{id:'library',label:'Library',text:'Welcome.',values:{place:'Library'}}]}}};
 const ctx={chat:[msg('<scene-start>')],chatId:'chat',chatMetadata:{},saveChat:async()=>{}};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});
 ctx.reloadCurrentChat=async()=>{host.switched();await host.received(0,'first_message');};
 await host.rebuild('library');assert.equal(host.read().values.place,'Library');
});

test('Invalid context aborts a native request even when its event emitter catches errors; dry run stays quiet',()=>{
 let stopped=0,prompt='old';const config={format,sceneState:s},ctx={chat:[msg('Start')],chatId:'chat',chatMetadata:{},setExtensionPrompt:(_id,value)=>prompt=value,stopGeneration:()=>stopped++};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});
 host.prepare('normal',{},true);assert.equal(stopped,0);assert.equal(prompt,'');assert.throws(()=>host.prepare('normal',{},false),/Initialize/);assert.equal(stopped,1);
});

test('Localized and compound source aliases use declared targets without ambiguity',()=>{
 const x=fresh();x.rules=[{template:'<MOVE_{entity}_{value}>',op:'set',targets:{'알렉스':'place','Alex_Smith':'place'}}];validateSceneState(x,sceneControls);
 assert.equal(applyStory(initialStory(x),parseStoryUpdates('<MOVE_알렉스_도서관>',x),x).place,'도서관');
 assert.equal(applyStory(initialStory(x),parseStoryUpdates('<MOVE_Alex_Smith_Library>',x),x).place,'Library');
});

test('Explicit per-scene snapshots cannot contradict persisted state and model context',async()=>{
 const config={format,sceneControls,sceneState:s},ctx={chat:[msg('<#1><img src="room"_"sky"_"weather"_"18:30"><0><div><div tn="1">Hello</div></div><scene-state>{"track":null}</scene-state>')],chatId:'chat',chatMetadata:{},saveChat:async()=>{}};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});await assert.rejects(host.rebuild(),/explicit snapshots/);assert.deepEqual(ctx.chatMetadata,{});
});

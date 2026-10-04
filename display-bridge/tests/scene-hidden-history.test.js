import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryJournal,MESSAGE_KEY,STORY_KEY} from '../core/story-journal.js';
import {createStoryState} from '../integrations/story-state.js';
import {sceneStory} from './fixtures/scene-story.js';

const msg=mes=>({mes,is_user:false,is_system:false,swipe_id:0,swipes:[mes]});
const make=saved=>createStoryJournal({config:sceneStory,owner:['character','chat'],saved});
const hidden=m=>{m.is_system=true;m.is_hidden=true;};

test('Hiding accepted history preserves totals, lineage and saved sources across reload',()=>{
 const chat=[msg('<❤alex+4>'),msg('We choose a book.'),msg('<❤alex+2>')],j=make();j.rebuild(chat);
 const saved=JSON.stringify(j.save()),texts=chat.map(m=>m.mes),expected=j.read(chat).values;
 hidden(chat[0]);assert.deepEqual(j.read(chat).values,expected);assert.equal(j.read(chat).issue,null);
 chat.forEach(hidden);assert.deepEqual(j.read(chat).values,expected);assert.equal(j.read(chat).views.size,3);
 const copy=structuredClone(chat),reloaded=make(j.save());assert.deepEqual(reloaded.read(copy).values,expected);
 assert.equal(reloaded.read(copy).issue,null);assert.equal(reloaded.accept(copy,2),false);
 assert.equal(JSON.stringify(j.save()),saved);assert.deepEqual(chat.map(m=>m.mes),texts);
 chat.forEach(m=>{m.is_system=false;delete m.is_hidden;});assert.deepEqual(j.read(chat).values,expected);
});

test('Hidden accepted edits reject stale state and an explicit rebuild replays every retained message',()=>{
 const chat=[msg('<❤alex+4>'),msg('<❤alex+2>')],j=make();j.rebuild(chat);chat.forEach(hidden);
 chat[0].mes='<❤alex+7>';assert.match(j.read(chat).issue,/Message 0/);
 assert.throws(()=>j.accept(chat,1),/Message 0/);
 j.rebuild(chat);assert.equal(j.read(chat).values.score,19);assert.equal(j.read(chat).issue,null);
 assert.equal(make(j.save()).read(chat).values.score,19);assert.ok(chat.every(m=>m.is_system));
});

test('Hidden swipes replace rather than accumulate and pending swipes cannot commit',()=>{
 const chat=[msg('<❤alex+4>')],j=make();j.rebuild(chat);hidden(chat[0]);
 chat[0].swipe_id=1;assert.throws(()=>j.accept(chat,0),/pending swipe/);
 chat[0].swipes.push('<❤alex+8>');chat[0].mes=chat[0].swipes[1];assert.equal(j.accept(chat,0),true);
 assert.equal(j.read(chat).values.score,18);assert.equal(j.accept(chat,0),false);
 chat[0].swipe_id=0;chat[0].mes=chat[0].swipes[0];assert.equal(j.read(chat).values.score,14);
});

test('Deleting hidden history does not replay orphan records and requires review for surviving descendants',()=>{
 const chat=[msg('<❤alex+4>'),msg('<❤alex+2>')],j=make();j.rebuild(chat);chat.forEach(hidden);
 const tail=chat.pop();assert.equal(j.read(chat).values.score,14);assert.equal(j.read(chat).issue,null);
 chat.push(tail);chat.shift();assert.match(j.read(chat).issue,/Message 0/);
 j.rebuild(chat);assert.equal(j.read(chat).values.score,12);assert.equal(j.save().records.length,1);
 chat.pop();assert.equal(j.read(chat).values.score,10);assert.equal(j.read(chat).issue,null);
});

test('Unaccepted system messages and user annotations remain excluded',()=>{
 const chat=[{...msg('<❤alex+90>'),is_system:true,extra:{type:'system'}},
  {...msg('<❤alex+90>'),is_user:true},msg('<❤alex+4>')],j=make();j.rebuild(chat);
 chat.forEach(hidden);assert.equal(j.read(chat).values.score,14);assert.equal(j.save().records.length,1);
 assert.equal(j.accept(chat,0),false);assert.equal(j.accept(chat,1),false);
});

test('Lost hidden journal records fail visibly instead of silently reverting to defaults',()=>{
 const chat=[msg('<❤alex+4>')],j=make();j.rebuild(chat);hidden(chat[0]);
 const lost=make();assert.match(lost.read(chat).issue,/Hidden message 0 has no saved state/);
 assert.throws(()=>lost.rebuild(chat),/unhide/);assert.equal(lost.save().records.length,0);
 chat[0].is_system=false;delete chat[0].is_hidden;lost.rebuild(chat);assert.equal(lost.read(chat).values.score,14);
});

test('A failed rebuild restores both journal data and hidden-message provenance',()=>{
 const chat=[msg('<❤alex+4>'),msg('<❤alex+2>')],j=make();j.rebuild(chat);chat.forEach(hidden);
 const before=JSON.stringify(j.save());chat[1].mes='<❤alex+999>';
 assert.throws(()=>j.rebuild(chat));assert.equal(JSON.stringify(j.save()),before);
 chat[1].mes=chat[1].swipes[0];assert.equal(j.read(chat).values.score,16);assert.equal(j.read(chat).issue,null);
});

test('A hidden message with an unrelated journal marker is not trusted',()=>{
 const chat=[msg('<❤alex+4>')],j=make();j.rebuild(chat);
 chat.push({...msg('<❤alex+30>'),is_system:true,[MESSAGE_KEY]:'unaccepted-id'});
 assert.match(j.read(chat).issue,/Hidden message 1/);assert.equal(j.save().records.length,1);
});

test('Latest-user append includes inactive roster members after hiding and does not change saved text',async()=>{
 const state=structuredClone(sceneStory);
 state.variables.riverScore={type:'number',initial:25,min:0,max:100};
 state.rules[0].targets.river='riverScore';state.roster.push({id:'river',score:'riverScore'});
 state.request={version:1,greetingVariable:'fm',marker:'&&&',template:'Current scene facts\nAlex affection: {score}\nRiver affection: {riverScore}'};
 const config={format:{kind:'scene-fragments',backgrounds:['numbered-four'],counts:[0,1,2,3,4],castFields:4,dialogueOpeners:['double'],textTags:true},sceneState:state},ctx={chat:[msg('<❤river+3>'),msg('<❤alex+4>'),{mes:'Choose the next book.',is_user:true}],
  chatId:'chat',chatMetadata:{},saveChat:async()=>{},setExtensionPrompt:()=>{},onlineStatus:'connected'};
 const scope=()=>({identity:'character',config}),host=createStoryState({getContext:()=>ctx,scope});
 await host.rebuild();const metadata=JSON.stringify(ctx.chatMetadata),text=ctx.chat.map(m=>m.mes);
 ctx.chat.slice(0,2).forEach(hidden);host.invalidate();host.begin('normal',{},false);
 const request=ctx.chat.filter(m=>!m.is_system).map(m=>({...m}));host.intercept(request);host.intercept(request);
 assert.equal(request.length,1);assert.equal(request[0].is_user,true);
 assert.equal(request[0].mes,'Choose the next book.\n\nCurrent scene facts\nAlex affection: 14\nRiver affection: 28');
 assert.deepEqual(ctx.chat.map(m=>m.mes),text);assert.equal(JSON.stringify(ctx.chatMetadata),metadata);
 host.end();const reloaded=createStoryState({getContext:()=>ctx,scope});assert.equal(reloaded.read().values.riverScore,28);
 assert.equal(ctx.chatMetadata[STORY_KEY].records.length,2);
 await reloaded.rebuild();assert.equal(reloaded.read().values.riverScore,28);assert.equal(reloaded.read().values.score,14);
 assert.ok(ctx.chat.slice(0,2).every(m=>m.is_system));assert.deepEqual(ctx.chat.map(m=>m.mes),text);
});

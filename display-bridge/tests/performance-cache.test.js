import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoundedParseCache} from '../core/bounded-parse-cache.js';
import {planRecency} from '../core/plan-recency.js';
import {createStoryState} from '../integrations/story-state.js';
import {STORY_KEY} from '../core/story-journal.js';
import {sceneStory} from './fixtures/scene-story.js';

test('Parsing cache is bounded, scope-aware, isolated from mutation and never caches errors',()=>{
 let calls=0;const cache=createBoundedParseCache(text=>{calls++;if(text==='bad')throw Error('bad');return [{value:text}];},{maxEntries:2,maxSize:100});
 const result=cache.read('a','one');result[0].value='tampered';assert.equal(cache.read('a','one')[0].value,'a');assert.equal(calls,1);
 cache.read('b','one');cache.read('a','one');cache.read('c','one');cache.read('b','one');assert.equal(calls,4);
 cache.read('b','two');assert.equal(calls,5);
 for(let i=0;i<2;i++)assert.throws(()=>cache.read('bad','two'),/bad/);assert.equal(calls,7);
 cache.read('x'.repeat(100),'two');cache.read('x'.repeat(100),'two');assert.equal(calls,9);
 cache.clear();cache.read('b','two');assert.equal(calls,10);
});

test('Presentation cache changes only at the supported depth and controller boundaries',()=>{
 const portrait={format:{kind:'scene-fragments'},sceneBehavior:{maxMessageDepth:3}},key=(depth,latestAssistant=false)=>planRecency({depth,latestAssistant,portrait});
 assert.equal(key(1),key(3));assert.notEqual(key(3),key(4));assert.equal(key(4),key(500));
 assert.notEqual(key(0,true),key(1,true));assert.notEqual(key(1,true),key(1,false));
 const tagged={format:{kind:'tagged',entries:[{recent:2},{recent:6}]}};
 const tk=depth=>planRecency({depth,portrait:tagged,latestAssistant:false});
 assert.notEqual(tk(1),tk(2));assert.equal(tk(2),tk(5));assert.notEqual(tk(5),tk(6));assert.equal(tk(6),tk(900));
 const wk=depth=>planRecency({depth,witchcure:{}});assert.notEqual(wk(1),wk(2));assert.notEqual(wk(5),wk(6));assert.equal(wk(6),wk(900));
});

test('Cached source parsing still rejects tampered records and notices in-place rule changes',async()=>{
 const config={format:{kind:'scene-fragments',backgrounds:['numbered-four'],counts:[0,1,2,3,4],castFields:4,dialogueOpeners:['double'],textTags:true},sceneState:structuredClone(sceneStory)};
 const ctx={chat:[{mes:'<❤alex+2>',is_user:false}],chatId:'performance',chatMetadata:{},saveChat:async()=>{}};
 const host=createStoryState({getContext:()=>ctx,scope:()=>({identity:'character',config})});
 await host.rebuild();assert.equal(host.read().values.score,12);
 const saved=structuredClone(ctx.chatMetadata[STORY_KEY]);ctx.chatMetadata[STORY_KEY].records[0].updates[0].value=20;host.invalidate();assert.match(host.read().issue,/saved updates/);
 ctx.chatMetadata[STORY_KEY]=saved;host.invalidate();assert.equal(host.read().values.score,12);
 config.sceneState.rules[0].op='subtract';await host.rebuild();assert.equal(host.read().values.score,8,'A changed grammar must not reuse old updates');
});

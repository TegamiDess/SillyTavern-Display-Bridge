import test from 'node:test';
import assert from 'node:assert/strict';
import { compileActions, createActionStore, initialState, reduceAction } from '../core/actions.js';
const raw = () => ({schemaVersion:1,namespace:'test',variables:{open:{type:'boolean',default:false},count:{type:'number',min:0,max:10,default:0},mode:{type:'enum',values:['a','b'],default:'a'},text:{type:'string',maxLength:8,default:''}},actions:{toggle:[{op:'toggle',variable:'open'}],add:[{op:'increment',variable:'count',value:1}],reset:[{op:'reset',variable:'count'}]}});
test('Typed actions, expression dependencies and reset',()=>{
    const source=raw(); source.actions.calculate=[{op:'set',variable:'count',value:{op:'add',args:[{var:'count'},2]}}];
    const def=compileActions(source); let state=initialState(def);
    state=reduceAction(def,state,'toggle'); assert.equal(state.open,true);
    state=reduceAction(def,state,'calculate'); assert.equal(state.count,2); assert.deepEqual(def.dependencies,['count']);
    assert.equal(reduceAction(def,state,'reset').count,0);
});
test('Atomic multi-operation failures leave state and notifications unchanged',()=>{
    const source=raw();source.actions.bad=[{op:'toggle',variable:'open'},{op:'set',variable:'count',value:11}];
    let notifications=0;const store=createActionStore({onChange:()=>notifications++}),handle=store.bind(compileActions(source),'a');
    assert.throws(()=>handle.dispatch('bad'));assert.equal(handle.read().open,false);assert.equal(notifications,0);
});
test('Invalid declarations, unresolved controls and incompatible expressions fail compilation',()=>{
    for(const mutate of [d=>d.variables.count.min=undefined,d=>d.variables.mode.default='c',d=>d.actions.bad=[{op:'toggle',variable:'count'}],d=>d.actions.bad=[{op:'set',variable:'open',value:{var:'missing'}}],d=>d.bindings={x:{event:'activate',action:'absent'}},d=>d.actions.bad=[{op:'set',variable:'count',value:{op:'add',args:[true,1]}}]]) {
        const d=raw();mutate(d);assert.throws(()=>compileActions(d));
    }
});
test('Bounds, divide by zero and unknown actions cannot commit',()=>{
    const d=raw();d.actions.zero=[{op:'set',variable:'count',value:{op:'divide',args:[1,0]}}];d.actions.long=[{op:'set',variable:'text',value:'too long a value'}];d.actions.enum=[{op:'set',variable:'mode',value:'c'}];
    const def=compileActions(d),state=initialState(def);for(const name of ['zero','long','enum','missing'])assert.throws(()=>reduceAction(def,state,name));
});
test('Scopes isolate state; shared scope synchronizes; stale events are rejected',()=>{
    const store=createActionStore(),def=compileActions(raw());let active=true;
    const a=store.bind(def,'avatar-a/chat-one',()=>active),shared=store.bind(def,'avatar-a/chat-one'),b=store.bind(def,'avatar-b/chat-one');
    a.dispatch('toggle');assert.equal(shared.read().open,true);assert.equal(b.read().open,false);
    active=false;assert.equal(a.dispatch('toggle'),false);assert.equal(a.read().open,true);
    store.clear();assert.equal(a.read().open,false);
});
test('Rapid actions commit once each and definitions cannot mutate after validation',()=>{
    let changes=0;const store=createActionStore({onChange:()=>changes++}),d=raw(),def=compileActions(d),handle=store.bind(def,'a');
    d.actions.add[0].value=999;for(let i=0;i<10;i++)handle.dispatch('add');assert.equal(handle.read().count,10);assert.equal(changes,10);
    assert.throws(()=>handle.dispatch('add'));assert.equal(changes,10);assert.throws(()=>def.variables.count.max=100);
});

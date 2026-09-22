import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreferences } from '../core/preferences.js';
import { createCharacterLifecycle } from '../core/character-lifecycle.js';

test('Saved choices survive serialization, stay isolated, and reset by chat or card',()=>{
    let state={},saves=0;const make=()=>createPreferences({state:()=>state,save:()=>saves++});let p=make();
    p.set('a','chat','report');p.set('a','branch','roster');p.set('b','chat','roster');
    state=JSON.parse(JSON.stringify(state));p=make();assert.equal(p.get('a','chat'),'report');assert.equal(p.get('a','new'),'auto');assert.equal(p.get('b','chat'),'roster');
    p.reset('a','chat');assert.equal(p.get('a','chat'),'auto');assert.equal(p.get('a','branch'),'roster');
    p.reset('a');assert.equal(p.get('a','branch'),'auto');assert.equal(p.get('b','chat'),'roster');assert.ok(saves>0);
});
test('Preference import rejects invalid files atomically and exports no runtime identity',()=>{
    const state={};const p=createPreferences({state:()=>state,save:()=>{}});p.set('a','chat','report');
    const exported=p.exportFor('a');p.importFor('b',exported);assert.equal(p.get('b','chat'),'report');
    const before=JSON.stringify(state);
    for(const bad of [{...exported,schemaVersion:3},{...exported,chats:[{chat:'chat',mode:'execute'}]},{...exported,chats:[{chat:'new',mode:'auto'},{chat:'new',mode:'report'}]},{...exported,script:'no'}])assert.throws(()=>p.importFor('a',bad));
    assert.equal(JSON.stringify(state),before);assert.deepEqual(Object.keys(exported).sort(),['chats','kind','schemaVersion']);
    assert.equal(p.set('a','','report'),false);assert.equal(p.set('a','chat','script'),false);
});
test('Preference storage remains bounded',()=>{
    const state={};const p=createPreferences({state:()=>state,save:()=>{}});
    for(let i=0;i<205;i++)p.set('a','chat-'+i,'report');assert.equal(Object.keys(state.chats).length,200);assert.equal(p.get('a','chat-204'),'report');
});
test('Native identity preserves edits and renames, retires deletion/replacement, and blocks stale filenames',()=>{
    let state={},n=0;const retired=[],moves=[];
    const make=()=>createCharacterLifecycle({state:()=>state,save:()=>{},uuid:()=>String(++n),retire:(...x)=>retired.push(x),rename:(...x)=>moves.push(x)});let l=make();
    const card={avatar:'a.png',create_date:'first'};const id=l.ensure(card).id;
    state=JSON.parse(JSON.stringify(state));l=make();assert.equal(l.ensure({...card,name:'Edited'}).id,id);
    l.move('a.png','b.png');assert.equal(l.ensure({...card,avatar:'b.png'}).id,id);assert.equal(l.ensure(card).active,false);assert.equal(moves.length,1);
    const replacement=l.ensure({...card,create_date:'second'});assert.ok(replacement.active);assert.notEqual(replacement.id,id);
    l.remove({...card,avatar:'b.png'});assert.equal(l.ensure({...card,avatar:'b.png'}).active,false);
    const newest=l.ensure({avatar:'b.png',create_date:'new'});assert.ok(newest.active);assert.ok(retired.length>=3);
    const count=retired.length;l.remove({...card,avatar:'b.png'});assert.equal(retired.length,count);assert.equal(l.ensure({avatar:'b.png',create_date:'new'}).id,newest.id);
});
test('Legacy identity can bind its native stamp without retiring settings; adversarial avatar keys are ordinary own keys',()=>{
    const state={};let retires=0;
    const l=createCharacterLifecycle({state:()=>state,save:()=>{},retire:()=>retires++,rename:()=>{},uuid:()=> 'identity'});
    const first=l.ensure({avatar:'__proto__'});assert.equal(l.ensure({avatar:'__proto__',create_date:'native'}).id,first.id);assert.equal(retires,0);assert.ok(Object.hasOwn(state.entries,'__proto__'));
});
test('A rename round trip preserves identity and does not retire its own redirect',()=>{
    const state={},retired=[],moves=[];
    const l=createCharacterLifecycle({state:()=>state,save:()=>{},retire:(...x)=>retired.push(x),rename:(...x)=>moves.push(x),uuid:()=> 'same-card'});
    const first=l.ensure({avatar:'original.png',create_date:'stamp'});l.move('original.png','renamed.png');l.move('renamed.png','original.png');
    assert.equal(l.ensure({avatar:'original.png',create_date:'stamp'}).id,first.id);assert.equal(retired.length,0);assert.equal(moves.length,2);
});

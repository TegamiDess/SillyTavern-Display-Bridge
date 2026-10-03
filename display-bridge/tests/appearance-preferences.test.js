import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreferences} from '../core/preferences.js';
test('Appearance preferences persist per character/chat and round-trip without changing other views',()=>{
    const data={};const make=()=>createPreferences({state:()=>data,save(){}});const p=make();p.set('card','one','report');
    assert.equal(p.setAppearance('card','one',{dialogue:62,status:100}),true);
    assert.deepEqual(make().getAppearance('card','one'),{dialogue:62,status:100});assert.equal(p.get('card','one'),'report');
    assert.equal(p.getAppearance('card','two'),null);assert.equal(p.getAppearance('another','one'),null);
    const exported=p.exportFor('card');assert.equal(exported.schemaVersion,3);p.importFor('copy',exported);assert.deepEqual(p.getAppearance('copy','one'),{dialogue:62,status:100});
    p.setAppearance('card','one',null);assert.equal(p.getAppearance('card','one'),null);assert.equal(p.get('card','one'),'report');assert.equal(p.exportFor('card').schemaVersion,1);
});
test('Appearance rejects invalid imports atomically and accepts legacy preference files',()=>{
    const data={},p=createPreferences({state:()=>data,save(){}});p.setAppearance('card','one',{dialogue:0,status:100});
    for(const value of [{dialogue:-1,status:92},{dialogue:50,status:101},{dialogue:50.5,status:92},{dialogue:'50',status:92},{dialogue:50,status:92,css:'x'}]){
        assert.equal(p.setAppearance('card','one',value),false);assert.throws(()=>p.importFor('card',{kind:'display-bridge-preferences',schemaVersion:3,chats:[{chat:'one',mode:'auto',appearance:value}]}));assert.deepEqual(p.getAppearance('card','one'),{dialogue:0,status:100});
    }
    p.importFor('card',{kind:'display-bridge-preferences',schemaVersion:1,chats:[{chat:'old',mode:'roster'}]});assert.equal(p.get('card','old'),'roster');assert.equal(p.getAppearance('card','old'),null);
});

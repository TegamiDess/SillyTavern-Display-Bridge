import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {portableRules,makePortableCard,packageImages}=await import('../../v3-asset-sprites/portable-card.js');
const rule={id:'v3s-card-0',name:'Image',source:'<img=(.*?)>',flags:'g',output:'<img src="$1">',disabled:true};

test('Portable rules preserve disabled choices and reject unknown versions, duplicate IDs and execution fields',()=>{
    assert.equal(portableRules(undefined),null);
    assert.deepEqual(portableRules({version:1,rules:[]}),[]);
    assert.deepEqual(portableRules({version:1,rules:[rule]}),[rule]);
    for(const value of [{version:2,rules:[]},{version:1,rules:[rule,rule]},...['disabled','source','flags','output'].map(k=>({version:1,rules:[{...rule,[k]:null}]})),{version:1,rules:[{...rule,id:'unrelated'}]},{version:1,rules:[{...rule,approved:true}]},{version:1,rules:[{...rule,flags:'gg'}]}])assert.throws(()=>portableRules(value));
});
test('CCV3 export includes portable card fields and applied profile without ST session fields',()=>{
    const data={name:'Neutral',description:'Description',first_mes:'Hello',group_only_greetings:['Group'],character_book:{entries:[]},source:['Original author'],chat:'private',avatar:'local.png',extensions:{fav:true,world:'Book',regex_scripts:[{id:'other'}],display_bridge_profile:{stale:true},v3_asset_sprites:{version:99}}};
    const before=JSON.stringify(data),profile={kind:'display-bridge-profile',schemaVersion:1,adapters:[]};
    const card=makePortableCard({data,profile,rules:[rule],assets:[]});
    assert.equal(card.spec,'chara_card_v3');assert.equal(card.spec_version,'3.0');
    assert.equal(card.data.first_mes,'Hello');assert.deepEqual(card.data.group_only_greetings,['Group']);assert.deepEqual(card.data.source,data.source);
    assert.deepEqual(card.data.extensions.display_bridge_profile,profile);assert.deepEqual(card.data.extensions.regex_scripts,[{id:'other'}]);
    assert.equal(card.data.chat,undefined);assert.equal(card.data.avatar,undefined);assert.equal(card.data.extensions.fav,undefined);assert.equal(JSON.stringify(data),before);
});
test('Image packaging keeps exact names, deduplicates paths and uses ASCII archive filenames',async()=>{
    let reads=0;
    const result=await packageImages([{asset:{name:'의상 A',type:'emotion'},path:'/one'},{asset:{name:'__proto__'},path:'/one'},{asset:{name:'Missing'},path:null}],{readImage:async()=>{reads++;return new Uint8Array([1,2]);},sniffImage:()=> 'png'});
    assert.equal(reads,1);assert.equal(result.files.length,1);assert.equal(result.totalBytes,2);assert.deepEqual(result.missing,['Missing']);
    assert.equal(result.assets[0].name,'의상 A');assert.equal(result.assets[1].name,'__proto__');assert.equal(result.assets[0].uri,result.assets[1].uri);assert.match(result.assets[0].uri,/^embeded:\/\/assets\/other\/images\/1.png$/);
});
test('Image packaging reports invalid bytes, rejects duplicate names and bounds total memory',async()=>{
    const options={readImage:async()=>new Uint8Array(10),sniffImage:()=> 'png',maxBytes:9};
    await assert.rejects(packageImages([{asset:{name:'a'},path:'/one'}],options),/exceeds/);
    await assert.rejects(packageImages([{asset:{name:'a'}},{asset:{name:'a'}}],options),/distinct/);
    const result=await packageImages([{asset:{name:'broken'},path:'/one'}],{...options,sniffImage:()=>null});assert.deepEqual(result.missing,['broken']);
});
test('Named images use the Risu asset-library role without duplicating bytes or changing special roles',async()=>{
    const types=[undefined,'','image',' Image ','asset','other','x-risu-asset','emotion','background','x-custom-role'];
    const items=types.map((type,i)=>({asset:{name:`named-${i}`,type},path:'/shared'}));
    const before=JSON.stringify(items);
    const result=await packageImages(items,{readImage:async()=>new Uint8Array([1,2,3]),sniffImage:()=> 'png'});
    assert.deepEqual(result.assets.map(a=>a.type),[...Array(7).fill('x-risu-asset'),'emotion','background','x-custom-role']);
    assert.equal(result.files.length,1);assert.equal(result.totalBytes,3);
    assert.equal(new Set(result.assets.map(a=>a.uri)).size,1);
    assert.deepEqual(result.assets.map(a=>a.name),items.map(i=>i.asset.name));
    assert.equal(JSON.stringify(items),before);
});
test('Incomplete export notices are bounded by the same envelope limit as import',()=>{
    assert.throws(()=>makePortableCard({data:{name:'Oversized'},rules:[],assets:[],incomplete:Array(10000).fill('x'.repeat(300))}),/oversized/);
});

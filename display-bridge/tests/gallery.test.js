import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGalleries } from '../adapters/gallery.js';
import { parseWitchcureAuxiliary } from '../adapters/witchcure-auxiliary.js';
import { resolveWitchcureImage } from '../integrations/witchcure-assets.js';
const gallery='DC[GN:Gallery|PID:a|PNUM:1|PT:Title [two]|PCONT:Text|C:F:Alex|Hello|C:S:River|Hi|C:Jun|Good]';
test('Gallery preserves nested brackets, comment badges and exact source ranges',()=>{
    const source='Before '+gallery+' after '+gallery;const parsed=parseGalleries(source);assert.equal(parsed.blocks.length,2);
    assert.equal(source.slice(parsed.blocks[0].start,parsed.blocks[0].end),gallery);
    assert.deepEqual(parsed.blocks[0].posts[0].comments.map(x=>x.type),['F','S','']);
});
test('Incomplete, malformed and duplicate-ID galleries remain native',()=>{
    assert.equal(parseGalleries(gallery.slice(0,-1)).incomplete,1);
    for(const value of ['DC[GN:x|PID:a|PT:only title]','DC[GN:x|PID:a|PT:A|PCONT:A|PID:a|PT:B|PCONT:B]'])assert.equal(parseGalleries(value).unsupported,1);
});
test('Code, escaped and excluded galleries are ignored',()=>{
    for(const text of ['`'+gallery+'`','\\'+gallery,'```\n'+gallery+'\n```'])assert.equal(parseGalleries(text).blocks.length,0);
    assert.equal(parseGalleries(gallery,[[0,gallery.length]]).blocks.length,0);
});
test('Witchcure auxiliary formats validate numeric captures and ignore examples',()=>{
    const compiled={map:true,status:true};
    const status='[None|0|1|2|3|None|None|None|4|5|None|None|2023-10-27|06:45 AM|Lobby|None|0]';
    assert.equal(parseWitchcureAuxiliary(status,compiled)[0].fields.length,17);
    assert.equal(parseWitchcureAuxiliary('<MAP>Inactive|0|0|No exploration</MAP>',compiled)[0].fields.length,4);
    for(const source of ['`'+status+'`','<MAP>Area|NaN|0|Log</MAP>',status.replace('|0]','|Infinity]')])assert.equal(parseWitchcureAuxiliary(source,compiled).length,0);
});
test('All six status scores and progress accept finite out-of-range values without rewriting captures',()=>{
    const fields=['None','11','20','99','1000','None','None','None','15.5','-3','None','None','2023-10-27','06:45 AM','Lobby','None','150'];
    const parsed=parseWitchcureAuxiliary('['+fields.join('|')+']',{status:true});
    assert.deepEqual(parsed[0].fields,fields);
    assert.equal(parseWitchcureAuxiliary('<MAP>Area|25|140|Log</MAP>',{map:true}).length,1);
    for(const invalid of ['oops','NaN','Infinity','1; color:red','9'.repeat(400)]) {
        const copy=[...fields];copy[1]=invalid;assert.equal(parseWitchcureAuxiliary('['+copy.join('|')+']',{status:true}).length,0);
    }
});
test('Verified Witchcure image aliases prefer exact names and keep character identity',()=>{
    const seen=[];
    const resolver=(avatar,name)=>{seen.push([avatar,name]);return name==='별빛 평야 아이콘'?{status:'resolved',url:'/user/files/icon.png'}:{status:'missing'};};
    assert.equal(resolveWitchcureImage('witch.png','별빛 평원 아이콘',resolver).status,'resolved');
    assert.deepEqual(seen,[['witch.png','별빛 평원 아이콘'],['witch.png','별빛 평야 아이콘']]);
    assert.equal(resolveWitchcureImage('witch.png','별빛 평원 아이콘',()=>({status:'resolved',url:'/user/files/direct.png'})).url,'/user/files/direct.png');
});

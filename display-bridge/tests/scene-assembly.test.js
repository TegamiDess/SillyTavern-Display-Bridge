import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneRules,sceneMessage} from './browser/scene-fixture.js';
import {discoverProfile,validateProfile,profileConflicts} from '../core/profiles.js';
import {parsePortraitDialogue,validatePortraitPreset} from '../adapters/portrait-dialogue.js';
const discover=rules=>discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:rules}});
const preset=(family='four')=>discover(sceneRules(family)).profile.adapters[0].source;
test('Independent background/cast/dialogue/status rules assemble both source families into portable v4',()=>{
    for(const family of ['four','five']) {
        const r=discover(sceneRules(family));assert.equal(r.profile.adapters[0].version,4);assert.deepEqual(validateProfile(r.profile),r.profile);
        const b=parsePortraitDialogue(sceneMessage(family),preset(family)).blocks[0];
        assert.equal(b.presentation,'scene');assert.equal(b.background,'room');assert.equal(b.portraits.length,2);assert.equal(b.portraits[1].hover,'curator-smile');
        assert.equal(b.time,'18:30');assert.equal(b.dialogue,'Welcome to the observatory.\nThe guides prepare the telescope.');assert.equal(b.location,family==='five'?'Observatory':undefined);
        const old=structuredClone(r.profile);old.adapters[0].version=3;assert.throws(()=>validateProfile(old));
    }
});
test('Scenes keep exact source ranges, preserve surrounding prose and never borrow cast from another scene',()=>{
    const a=sceneMessage(),b=sceneMessage('four','2',1),s='Before\n'+a+'\nBetween\n'+b+'\nAfter';
    const parsed=parsePortraitDialogue(s,preset());assert.equal(parsed.blocks.length,2);assert.deepEqual(parsed.blocks.map(x=>s.slice(x.start,x.end)),[a,b]);assert.deepEqual(parsed.blocks.map(x=>x.controls),[false,true]);
    const incomplete=a.slice(0,a.indexOf('<div>'));const next=parsePortraitDialogue(incomplete+b,preset());assert.equal(next.blocks.length,1);assert.equal(next.blocks[0].start,incomplete.length);
});
test('All cast sizes including background-only scenes work; code, escaped markers and excluded overlaps remain native',()=>{
    for(let n=0;n<=4;n++)assert.equal(parsePortraitDialogue(sceneMessage('four','1',n),preset()).blocks[0].portraits.length,n);
    const text=sceneMessage();for(const input of ['```\n'+text+'\n```','`'+text+'`','\\'+text])assert.equal(parsePortraitDialogue(input,preset()).blocks.length,0);
    assert.equal(parsePortraitDialogue(text,preset(),[[text.indexOf('<ct='),text.indexOf('<ct=')+8]]).blocks.length,0);
});
test('Streaming waits for complete scene boundaries and rejects unknown markup without swallowing following scenes',()=>{
    const text=sceneMessage();for(const end of [text.indexOf('<div>'),text.indexOf('</div>'),text.length-2])assert.equal(parsePortraitDialogue(text.slice(0,end),preset()).blocks.length,0);
    const altered=text.replace('Welcome to the observatory.','<img src="https://invalid.test/image">');const result=parsePortraitDialogue(altered+' prose '+text,preset());assert.equal(result.unsupported,1);assert.equal(result.blocks.length,1);assert.equal(result.blocks[0].start,altered.length+7);
});
test('Missing components, mixed families, changed capture roles, unsafe templates and flags require review',()=>{
    for(const rules of [sceneRules().slice(1),sceneRules().filter(r=>!r.out.includes('text-area-container')),[...sceneRules(),...sceneRules('five')]])assert.equal(discover(rules).profile,null);
    for(const mutate of [r=>r[0].out=r[0].out.replace('raw::$2','raw::$3'),r=>r[2].out+='<script>run()</script>',r=>r[2].matchOptions={flag:'i'}]){const rules=sceneRules();mutate(rules);assert.equal(discover(rules).profile,null);}
    const c=preset();assert.throws(()=>validatePortraitPreset({...c,format:{...c.format,counts:[1,1]}}));
    assert.equal(profileConflicts(discover(sceneRules()).profile,[{findRegex:sceneRules()[0].in,scriptName:'Native scene'}]).length,1);
});
test('Large or malformed scenes have bounded output and keep unsupported source visible',()=>{
    assert.equal(parsePortraitDialogue(sceneMessage().replace('Welcome to the observatory.','x'.repeat(20001)),preset()).blocks.length,0);
    assert.ok(parsePortraitDialogue(Array(80).fill(sceneMessage()).join('\n'),preset()).blocks.length<=64);
});

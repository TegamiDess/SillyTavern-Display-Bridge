import test from 'node:test';
import assert from 'node:assert/strict';
import {detailedSceneRules,sceneMessage} from './browser/scene-fixture.js';
import {discoverProfile,validateProfile,profileFromSettings} from '../core/profiles.js';
import {parsePortraitDialogue,validatePortraitPreset} from '../adapters/portrait-dialogue.js';
import {parseSceneText} from '../adapters/scene-text.js';
import fs from 'node:fs';
const {makePortableCard}=await import('../../v3-asset-sprites/portable-card.js');
const discover=rules=>discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:rules}});
const profile=family=>discover(detailedSceneRules(family)).profile;
const config=family=>profile(family).adapters[0].source;

test('Scene details bind layers, periods, labels, offsets and tooltip arities for both families',()=>{
    for(const family of ['four','five']){
        const b=parsePortraitDialogue(sceneMessage(family).replace('"0px"','"@guide"'),config(family)).blocks[0];
        assert.equal(b.sceneLabel,'#1');assert.deepEqual(b.portraits[0].offset,{value:20,unit:'%'});
        assert.equal(b.portraits[0].tooltips.length,family==='four'?3:1);
        assert.equal(b.period,family==='four'?'night':'daytime');
        assert.deepEqual(b.layers,family==='four'?[{role:'sky',asset:'sky',opacity:1},{role:'effect',asset:'weather',opacity:.7}]:[]);
        assert.ok(b.dialogueRuns.some(r=>r.kind==='narration'));
    }
});
test('Changed offset, tooltip and layer capture roles require review instead of guessing',()=>{
    for(const mutate of [r=>r[0].out=r[0].out.replace('fullBgImage3" src="{{raw::$4','fullBgImage3" src="{{raw::$3'),r=>r[2].out=r[2].out.replace('top: $3','top: $4'),r=>r[2].out=r[2].out.replace('data-tooltip="$4"','data-tooltip="$3"')]){
        const rules=detailedSceneRules();mutate(rules);assert.equal(discover(rules).profile,null);
    }
});
test('Version 6 details survive settings export; legacy v4/v5 stays unchanged and lower versions reject new fields',()=>{
    const p=profile();assert.equal(p.adapters[0].version,6);assert.deepEqual(validateProfile(p),p);
    assert.deepEqual(profileFromSettings({adapters:['portrait-dialogue'],portraitSource:p.adapters[0].source}),p);
    const old=structuredClone(p);old.adapters[0].version=5;assert.throws(()=>validateProfile(old));
    delete old.adapters[0].source.format.details;
    for(const v of [4,5]){old.adapters[0].version=v;assert.deepEqual(validateProfile(old),old);const b=parsePortraitDialogue(sceneMessage(),old.adapters[0].source).blocks[0];assert.equal(b.layers,undefined);assert.equal(b.portraits[0].offset,undefined);assert.equal(b.dialogueRuns,undefined);}
});
test('Bad positions keep source native without swallowing a following valid scene',()=>{
    for(const value of ['calc(1px)','url(x)','1001px','101%','@missing','Infinitypx']){
        const bad=sceneMessage().replace('"0px"','"'+value+'"'),result=parsePortraitDialogue(bad+'\n'+sceneMessage(),config());
        assert.equal(result.blocks.length,1);assert.equal(result.blocks[0].start,bad.length+1);assert.equal(result.unsupported,1);
    }
    const c=config();c.format.details.offsetAliases['@guide']='url(x)';assert.throws(()=>validatePortraitPreset(c));
});
test('Rich scene dialogue retains paragraph order, narration and safe emphasis as text runs',()=>{
    const parsed=parseSceneText('<text="dialogue"><strong>Hello</strong>, *guide*. &lt;sample&gt;<br>**Ready**.</text><text="narration">The sky darkens.</text>',true);
    assert.equal(parsed.dialogue,'Hello, guide. <sample>\nReady.\nThe sky darkens.');
    assert.ok(parsed.dialogueRuns.some(r=>r.text==='Hello'&&r.marks.includes('strong')));
    assert.ok(parsed.dialogueRuns.some(r=>r.text==='guide'&&r.marks.includes('em')));
    assert.ok(parsed.dialogueRuns.some(r=>r.text==='The sky darkens.'&&r.kind==='narration'));
    assert.equal(parseSceneText('<p>A</p><p>B</p>',false).dialogue,'A\nB');
    assert.equal(parseSceneText('image_name stays plain',false).dialogue,'image_name stays plain');
});
test('Unknown markup, attributes, macros, unbalanced and overly nested text never become a rendered scene',()=>{
    for(const text of ['<strong onclick="x">A</strong>','<img src="x">','<style>A</style>','{{getvar::x}}','<strong>A','<em><b>A</em></b>','<em>'.repeat(17)+'A'+'</em>'.repeat(17)])assert.throws(()=>parseSceneText(text,true));
    assert.equal(parseSceneText('&lt;img src=x onerror=x&gt;',false).dialogue,'<img src=x onerror=x>');
});
test('Scene detail dictionaries reject dangerous keys, oversized maps and unknown versions',()=>{
    for(const alter of [d=>d.version=2,d=>d.layers='yes',d=>d.periodAssets=JSON.parse('{"__proto__":"night"}'),d=>d.offsetAliases=Object.fromEntries(Array.from({length:65},(_,i)=>['@a'+i,'0px']))]){
        const c=config();alter(c.format.details);assert.throws(()=>validatePortraitPreset(c));
    }
});
test('Scene details survive configured CCV3 export and explicit-profile rediscovery',()=>{
    const p=profile(),card=makePortableCard({data:{name:'Neutral details'},profile:p,rules:[],assets:[]});
    assert.deepEqual(validateProfile(card.data.extensions.display_bridge_profile),p);
    const source={sourceVersion:1,profile:card.data.extensions.display_bridge_profile,risuai:{}};
    assert.deepEqual(discoverProfile(source).profile,p);
    const unsupportedFlags=detailedSceneRules();unsupportedFlags.at(-1).matchOptions={flags:'i'};
    assert.deepEqual(discover(unsupportedFlags).profile.adapters[0].source.format.details.offsetAliases,{});
});

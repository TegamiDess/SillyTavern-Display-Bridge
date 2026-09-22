import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {discoverProfile,validateProfile,profileFromSettings} from '../core/profiles.js';
import {parsePortraitDialogue,validatePortraitPreset} from '../adapters/portrait-dialogue.js';
import {styledRule,afternoonStyles} from './browser/presentation-style-fixture.js';
// Pinned development dependency; matches the browser harness's CSS parser.
const css=createRequire(import.meta.url)('@adobe/css-tools');
const rules=[styledRule('guide','Alex','guide'),styledRule('curator','Robin','curator'),{type:'editdisplay',in:'<narration>(.*?)</narration>',out:'<div class="narration-container"><div class="narration-box"><div class="narration-text">$1</div></div></div>'}];
const discover=(styles=afternoonStyles)=>discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:rules,backgroundHTML:styles}},css);
test('Source styles become distinct portable speaker tokens with bounded desktop layout',()=>{
 const result=discover(),adapter=result.profile.adapters[0],entries=adapter.source.format.entries;
 assert.equal(adapter.version,2);assert.equal(entries[0].style.accent,'#4169e1');assert.equal(entries[1].style.accent,'#daa520');
 assert.deepEqual(entries[0].style,{borderWidth:4,accent:'#4169e1',background:'#f0f8ff',text:'#003366',nameBackground:'#e0f6ff',nameText:'#003366',radius:25,padY:20,padX:35,fontSize:16,lineHeight:1.6,fontWeight:700,nameFontSize:13,nameTilt:-2,width:80,stageHeight:'58vh',portraitHeight:'50vh',portraitWidth:'50vw',pattern:'gingham'});
 assert.equal(entries[2].style.backgroundEnd,'#f0ebe0');assert.equal(entries[2].style.pattern,'plain');
 const blocks=parsePortraitDialogue('<guide>"Hello"</guide> prose <curator>"Welcome"</curator>',adapter.source).blocks;
 assert.equal(blocks[0].style,entries[0].style);assert.equal(blocks[1].style,entries[1].style);assert.equal(blocks[0].config,blocks[1].config,'Shared actions must use the same preset');
 assert.deepEqual(validateProfile(result.profile),result.profile);assert.deepEqual(profileFromSettings({adapters:['portrait-dialogue'],portraitSource:adapter.source}),result.profile);
 assert.throws(()=>validateProfile({...result.profile,adapters:[{...adapter,version:1}]}),/version 2/);
});
test('CSS cascade honours order, specificity, importance, descendants and inherited variables',()=>{
 const style=discover(afternoonStyles+`<style>.guide-dialogue-container .guide-dialogue-text{color:#123456}.guide-dialogue-text{color:#abcdef}.guide-dialogue-text{font-size:20px!important}.guide-dialogue-text{font-size:18px}.guide-dialogue-container{--bg-color:#ddeeff}</style>`).profile.adapters[0].source.format.entries[0].style;
 assert.equal(style.text,'#123456');assert.equal(style.fontSize,20);assert.equal(style.background,'#ddeeff');
});
test('Malformed, conditional, remote and out-of-budget CSS cannot escape into profiles',()=>{
 for(const bad of ['<script>bad()</script>', '<style>.x{</style>', '<style>'+(' '.repeat(100001))+'</style>']){const r=discover(bad);assert(r.profile);assert.equal(r.profile.adapters[0].version,1);assert(r.notes.some(n=>n.includes('Built-in presentation styling')));}
 const result=discover(`<style>@import url(https://example.invalid/attack.css);@media(min-width:1px){.guide-dialogue-text{color:#ff0000}}.guide-dialogue-container{height:9999vh;width:1%;position:fixed;z-index:999999}.guide-dialogue-box{background:url(https://example.invalid/image);border:999px solid red}.guide-dialogue-text{color:var(--loop);--loop:var(--loop);font-size:999px}.guide-character-image{max-width:999vw}</style>`);
 const entry=result.profile.adapters[0].source.format.entries[0];assert.equal(entry.style?.stageHeight,undefined);assert.equal(entry.style?.text,undefined);assert(!JSON.stringify(result.profile).includes('example.invalid'));assert(!JSON.stringify(result.profile).includes('999'));
});
test('Explicit styles reject executable values, unknown fields, invalid sizes and inherited prototype keys',()=>{
 const config=discover().profile.adapters[0].source;
 for(const style of [{accent:'url(x)'},{width:1},{stageHeight:'calc(100vh)'},{nameTilt:30},{fontSize:Infinity},{position:'fixed'},{constructor:3},{pattern:'custom'}])assert.throws(()=>validatePortraitPreset({...config,format:{kind:'tagged',entries:[{...config.format.entries[0],style}]}}));
});

test('Anchor-free Afternoon narration accepts gm without widening case-sensitive tag matching',()=>{
 const source={sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:rules.map(r=>({...r,matchOptions:{ableFlag:true,flag:'gm'}})),backgroundHTML:afternoonStyles}};
 const profile=discoverProfile(source,css).profile;assert(profile);assert.equal(parsePortraitDialogue('<GUIDE>"Hello"</GUIDE>',profile.adapters[0].source).blocks.length,0);
 source.risuai.customScripts[0].matchOptions.flag='gi';assert.equal(discoverProfile(source,css).profile,null);
});

test('Safe background and border shorthands obey cascade order rather than overriding newer longhands',()=>{
 const entry=discover(afternoonStyles+`<style>.guide-dialogue-box{background-color:#112233;background:#445566;border-color:#123456;border:2px solid #654321;border-width:5px}</style>`).profile.adapters[0].source.format.entries[0];
 assert.equal(entry.style.background,'#445566');assert.equal(entry.style.accent,'#654321');assert.equal(entry.style.borderWidth,5);
});
test('Only recognized status rules can retain the move-bottom directive',()=>{
 const r={type:'editdisplay',in:String.raw`\[Status\|(.*?)\|(.*?)\|(.*?)\|(.*?)\]`,out:'<div class="status-container">'+[1,2,3,4].map(n=>`<div class="cute-date-info">$${n}</div>`).join('')+'</div>',matchOptions:{ableFlag:true,flag:'<move_bottom>g'}};
 const source={sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:[r]}};const p=discoverProfile(source).profile;assert.equal(p.adapters[0].version,2);assert.equal(p.adapters[0].source.format.entries[0].placement,'bottom');
 assert.equal(parsePortraitDialogue('[Status|18:00|Friday|2026-09-22|Library]',p.adapters[0].source).blocks[0].moveBottom,true);
 for(const flag of ['<move_top>g','<move_bottom><move_bottom>g','i<move_bottom>'])assert.equal(discoverProfile({...source,risuai:{customScripts:[{...r,matchOptions:{flag}}]}}).profile,null);
 assert.equal(discoverProfile({...source,risuai:{customScripts:[{...rules[0],matchOptions:r.matchOptions}]}}).profile,null);
});

import {runSceneStoryTests} from './scene-story-tests.js';
import {runSceneControlsTests} from './scene-controls-tests.js';
import {runPerformanceTests} from './performance-tests.js';
import {runSnapshotTests} from './snapshot-tests.js';
import {runPortableTests} from './portable-tests.js';
import {runSceneTests} from './scene-tests.js';
import {runBilingualTests} from './bilingual-tests.js';
import {runOutfitTests} from './outfit-tests.js';
import { runMappingTests } from './mapping-tests.js';
import { runPresentationTests } from './presentation-tests.js';
import { runAuditTests } from './audit-tests.js';
import { runRecognitionTests } from './recognition-tests.js';
import { runImageViewerTests } from './image-viewer-tests.js';
import { runPortraitTests } from './portrait-tests.js';
import { createDisplayBridge, SAMPLE } from '/extension/core/bridge.js';
import { makePlan, renderPlan } from '/extension/core/pipeline.js';
import { parseChatMarkup } from '/extension/components/media-panel.js';
import { ctx, extension_settings, characters, eventSource, event_types } from './runtime.js';
import { messageFormatting } from './formatter.js';
import { runAdditionalTests } from './additional-tests.js';
import { runWitchcureTests } from './witchcure-tests.js';
import { runCompatibilityTests } from './compatibility-tests.js';
import { runProfileTests } from './profile-tests.js';
import { runLifecycleTests } from './lifecycle-tests.js';

ctx.messageFormatting = messageFormatting;
const results = [];
let bridge;
function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
// Rendering is frame-scheduled; a fixed timer races throttled background tabs.
const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 30))));
const host = () => document.querySelector('.display-bridge-widget');
const root = () => document.querySelector('.mes_text');
function native(source, { id = 0, ...extra } = {}) {
    const message = { mes: source, name: 'Sample A', is_user: false, is_system: false, ...extra };
    ctx.chat[id] = message;
    const element = document.createElement('div'); element.className = 'mes'; element.setAttribute('mesid', id);
    const content = document.createElement('div'); content.className = 'mes_text';
    content.innerHTML = messageFormatting(message.extra?.display_text || source, message.name, message.is_system, message.is_user, id);
    element.append(content);
    const existing = document.querySelector(`.mes[mesid="${id}"]`);
    if(existing) existing.replaceWith(element); else document.getElementById('chat').append(element);
    return message;
}
function setup(source = SAMPLE, { stream = true } = {}) {
    bridge?.stop();
    document.getElementById('chat').replaceChildren();
    ctx.chat = []; ctx.characterId = 0; delete ctx.groupId; delete ctx.chatId;
    extension_settings.display_bridge = { profiles: {} };
    extension_settings.regex = [];
    const message = native(source);
    bridge = createDisplayBridge({ getContext: () => ctx, extensionSettings: extension_settings, saveSettings: () => {}, cssParser: window.cssTools });
    window.displayBridge = bridge; bridge.start();
    if (stream) bridge.setStreamEnabled('test-a.png', true);
    return message;
}
async function test(name, run) {
    try { await run(); results.push({name,passed:true}); }
    catch(error) { results.push({name,passed:false,error:error.message}); console.error(name,error); }
    const item = document.createElement('li'); const last = results.at(-1);
    item.className = last.passed ? 'pass' : 'fail'; item.textContent = `${last.passed ? 'PASS' : 'FAIL'} — ${name}${last.error ? ': '+last.error : ''}`;
    document.getElementById('results').append(item);
}

await test('Fresh profiles need an explicit stream selection; UI toggle restores native DOM', () => {
    const message = setup(SAMPLE, { stream: false });
    const original = [...root().childNodes];
    const saved = JSON.stringify(message);
    bridge.setEnabled('test-a.png', true);
    assert(!host());
    const inputs = document.querySelectorAll('#display-bridge-settings input[type=checkbox]');
    assert(inputs.length === 7 && !inputs[2].checked && !inputs[3].checked);
    assert(bridge.api.getAssetReplay({ avatar: 'test-a.png', messageId: 0, root: root() }) === null);
    inputs[2].click(); assert(host());
    assert(bridge.api.getAssetReplay({ avatar: 'test-a.png', messageId: 0, root: root() }).ready);
    inputs[2].click(); assert(!host());
    assert(original.every((node, i) => root().childNodes[i] === node), 'Native nodes not restored');
    assert(JSON.stringify(message) === saved);
    assert(bridge.api.getAssetReplay({ avatar: 'test-a.png', messageId: 0, root: root() }) === null);
});
await test('Stream choice survives master toggles and stays isolated by character', () => {
    setup(); bridge.setEnabled('test-a.png', true); assert(host());
    bridge.setEnabled('test-a.png', false); assert(!host());
    bridge.setEnabled('test-a.png', true); assert(host());
    ctx.characterId = 1; bridge.setEnabled('test-b.png', true); assert(!host());
    assert(!document.querySelectorAll('#display-bridge-settings input')[1].checked);
    ctx.characterId = 0; bridge.render(); assert(host());
    bridge.setStreamEnabled('test-a.png', false);
    bridge.setEnabled('test-a.png', false); bridge.setEnabled('test-a.png', true); assert(!host());
});
await test('Per-character opt-in; standalone panel, prose and original message preserved', async () => {
    const source = 'Before **bold**.\n\n' + SAMPLE + '\n\nAfter *italic*.';
    const message = setup(source); await wait(); assert(!host());
    const saved = JSON.stringify(message);
    bridge.setEnabled('test-a.png', true);
    assert(host()?.shadowRoot.querySelector('.panel'));
    assert(root().querySelector('strong')?.textContent === 'bold');
    assert(root().querySelector('em')?.textContent === 'italic');
    assert(host().shadowRoot.textContent.includes('Image provider not connected'));
    assert(JSON.stringify(message) === saved, 'Stored message changed');
});
await test('Button, keyboard, pointer and repeated widget identities', async () => {
    setup(SAMPLE + '\n\n' + SAMPLE); bridge.setEnabled('test-a.png',true);
    const widgets = [...document.querySelectorAll('.display-bridge-widget')]; assert(widgets.length === 2);
    const first = widgets[0].shadowRoot; const button = first.querySelector('button');
    button.click(); assert(button.getAttribute('aria-expanded') === 'true');
    assert(widgets[1].shadowRoot.querySelector('button').getAttribute('aria-expanded') === 'false');
    first.querySelector('.panel').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert(button.getAttribute('aria-expanded') === 'false');
    first.querySelector('.stage').dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));
    assert(button.getAttribute('aria-expanded') === 'true');
    first.querySelector('.stage').dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));
    assert(button.getAttribute('aria-expanded') === 'false');
    bridge.render(); assert(host() === widgets[0], 'Duplicate rendering');
});
await test('Incomplete stream stays native; completion mounts once', async () => {
    setup(SAMPLE.slice(0,-1)); bridge.setEnabled('test-a.png',true); assert(!host());
    native(SAMPLE); await wait(); assert(document.querySelectorAll('.display-bridge-widget').length === 1);
});
await test('Edits, swipes, display_text and disable restore the current native view', async () => {
    setup(); bridge.setEnabled('test-a.png',true);
    const changed = SAMPLE.replace('08:00','09:15'); native(changed); await wait();
    assert(host().shadowRoot.querySelector('.time').textContent.includes('09:15'));
    native(SAMPLE.replace('08:00','10:20'), {swipe_id:1}); await wait();
    assert(host().shadowRoot.querySelector('.time').textContent.includes('10:20'));
    const message = native('Raw stored message', {extra:{display_text:changed}}); const saved=JSON.stringify(message); await wait();
    assert(host().shadowRoot.querySelector('.time').textContent.includes('09:15'));
    bridge.setEnabled('test-a.png',false); assert(!host());
    assert(root().textContent.includes('09:15')); assert(JSON.stringify(message)===saved);
    bridge.setEnabled('test-a.png',true); assert(host());
});
await test('Character switch, group chat, user message and teardown', async () => {
    setup(); bridge.setEnabled('test-a.png',true); assert(host());
    ctx.characterId = 1; bridge.render(); assert(!host());
    ctx.characterId = 0; bridge.render(); assert(host());
    ctx.groupId = 'group'; bridge.render(); assert(!host()); delete ctx.groupId; delete ctx.chatId;
    native(SAMPLE,{is_user:true}); bridge.render(); assert(!host());
    native(SAMPLE); bridge.render(); assert(host()); bridge.stop(); assert(!host());
    native(SAMPLE); eventSource.emit(event_types.MESSAGE_UPDATED); await wait(); assert(!host());
});
await test('Conflicting regex cannot misattribute, duplicate or expose placeholders', () => {
    setup();
    extension_settings.regex = [{id:'conflict',findRegex:'/DBP[a-f0-9]+X0END/g',replaceString:'removed',markdownOnly:true,placement:[2],trimStrings:[],substituteRegex:0}];
    bridge.setEnabled('test-a.png',true);
    assert(!host()); assert(bridge.diagnostics().conflicts.length===1);
    assert(!root().textContent.includes('DBP')); assert(root().textContent.includes('Assets:'));
    const plan = makePlan(SAMPLE);
    for(const html of [`<p>${plan.items[0].token}${plan.items[0].token}</p>`,`<img alt="${plan.items[0].token}">`,`<code>${plan.items[0].token}</code>`]) {
        let rejected=false;try{renderPlan(plan,html,{avatar:'test-a.png'});}catch{rejected=true;}assert(rejected);
    }
});
await test('Markup captures cannot execute code or fetch imported resources', () => {
    for(const value of ['<img src="https://invalid.test/a.png">','<p onclick="alert(1)">Hello</p>','<script>window.evil=1</script>','<iframe src="https://invalid.test"></iframe>']) {
        let rejected=false; try {parseChatMarkup(value);}catch{rejected=true;} assert(rejected);
    }
    const rows=parseChatMarkup('<p><span>A</span><span>&lt;script&gt;hello&lt;/script&gt;<br>Next</span></p>');
    assert(rows[0].text === '<script>hello</script>\nNext'); assert(!window.evil);
});
await test('Message-zero macro writeback is not triggered by the bridge', () => {
    setup(); ctx.chat[0].mes = SAMPLE + '\n{{char}}';
    const saved = JSON.stringify(ctx.chat[0]); bridge.setEnabled('test-a.png',true);
    assert(JSON.stringify(ctx.chat[0])===saved); assert(host());
});
await test('V3 provider API, exact avatar, no enrollment side effects, mapping refresh', async () => {
    setup(); bridge.setEnabled('test-a.png',true);
    extension_settings.v3_asset_sprites = {enrolled:{'test-a.png':true},extracted:{'test-a.png':{'sample.webp':{path:'user/files/sample.png'}}}};
    await import('./v3-runtime.js'); await wait();
    const before = JSON.stringify(extension_settings.v3_asset_sprites);
    assert(window.v3sprites.api.resolveImage({avatar:'test-a.png',reference:'sample.webp'}).status==='resolved');
    assert(window.v3sprites.api.resolveImage({avatar:'test-b.png',reference:'sample.webp'}).status==='not-enrolled');
    assert(JSON.stringify(extension_settings.v3_asset_sprites)===before);
    assert(host().shadowRoot.querySelector('img').getAttribute('src')==='/user/files/sample.png');
    extension_settings.v3_asset_sprites.extracted['test-a.png']['sample.webp'].path='user/files/changed.png';
    window.dispatchEvent(new CustomEvent('v3sprites:assets-changed',{detail:{avatar:'test-a.png'}}));await wait();
    assert(host().shadowRoot.querySelector('img').getAttribute('src')==='/user/files/changed.png');
});
await test('V3 standalone captures beside and inside panels cannot be mixed', async () => {
    const marker = 'V3ASSETREF_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_END';
    const rule={id:'v3-test',scriptName:'test',findRegex:'/\\{\\{img::([^}]+)}}/g',replaceString:marker,trimStrings:[],placement:[2],disabled:false,markdownOnly:true,promptOnly:false,runOnEdit:true,substituteRegex:0,minDepth:null,maxDepth:null};
    characters[0].data.extensions.regex_scripts=[rule];
    // Use the actual helper's signature shape, supplied by the harness generator.
    const actualSignature=window.testRuleSignature(rule);
    extension_settings.v3_asset_sprites.approved={'test-a.png':{'v3-test':{signature:actualSignature,marker,parts:[{type:'image',value:'$1'}]}}};
    Object.assign(extension_settings.v3_asset_sprites.extracted['test-a.png'],{'inside':{path:'user/files/inside.png'},'outside':{path:'user/files/outside.png'}});
    setup(SAMPLE.replace('Hello! Great to see you.','{{img::inside}}')+'\n{{img::outside}}');
    bridge.setEnabled('test-a.png',true); await wait();
    const images=[...root().querySelectorAll('img')]; assert(images.length===1,'Standalone image did not resolve');
    assert(images[0].getAttribute('src')==='/user/files/outside.png','Wrong asset attributed');
    assert(host().shadowRoot.textContent.includes('{{img::inside}}'));
});

await runWitchcureTests({ test, assert, setup, native, wait, ctx, characters, extension_settings, bridge: () => bridge });
await test('Mapped bare image names resolve before mounting; rejected passes fetch nothing',async()=>{
    setup();
    const reference='Lerevan Peinard';
    extension_settings.v3_asset_sprites.enrolled['test-a.png']=true;
    extension_settings.v3_asset_sprites.extracted['test-a.png'][reference]={path:'user/files/lerevan.png'};
    const plan=makePlan(SAMPLE);
    const before=performance.getEntriesByType('resource').filter(x=>x.name.endsWith('/Lerevan%20Peinard')).length;
    const rendered=renderPlan(plan,`<img src="${reference}"><img src="/ordinary.png">${plan.source}`,{avatar:'test-a.png'});
    assert(rendered.container.querySelector('img').getAttribute('src')==='/user/files/lerevan.png');
    assert(rendered.container.querySelectorAll('img')[1].getAttribute('src')==='/ordinary.png');
    let rejected=false;try{renderPlan(plan,`<img src="${reference}">no token`,{avatar:'test-a.png'});}catch{rejected=true;}
    assert(rejected);await wait();
    assert(performance.getEntriesByType('resource').filter(x=>x.name.endsWith('/Lerevan%20Peinard')).length===before,'Unresolved image fetched during offscreen rendering');
});
await test('Pending non-streamed swipe keeps native waiting DOM; complete or cancelled swipes recover',async()=>{
    const message=setup();message.swipes=[message.mes];message.swipe_id=0;bridge.setEnabled('test-a.png',true);
    const original=message.mes;
    message.swipe_id=1;root().textContent='...';eventSource.emit(event_types.MESSAGE_SWIPED);await wait();
    assert(root().textContent==='...'&&!host(),'Previous reply replaced the native wait indicator');
    assert(message.mes===original&&message.swipes.length===1,'Swipe data changed');
    assert(bridge.api.getAssetReplay({avatar:'test-a.png',messageId:0,root:root()})===null);
    bridge.refresh();await wait();assert(root().textContent==='...');
    message.mes=SAMPLE.replace('08:00','11:11');message.swipes.push(message.mes);
    root().innerHTML=messageFormatting(message.mes,message.name,false,false,0);await wait();
    assert(host()?.shadowRoot.textContent.includes('11:11'));
    message.swipe_id=2;root().textContent='...';await wait();assert(!host());
    message.swipe_id=0;message.mes=original;
    root().innerHTML=messageFormatting(original,message.name,false,false,0);eventSource.emit(event_types.MESSAGE_SWIPED);await wait();
    assert(host()?.shadowRoot.textContent.includes('08:00'));
});
await test('Streamed swipe resumes with a new slot and mounts a completed panel before trailing prose ends',async()=>{
    const message=setup();message.swipes=[message.mes];message.swipe_id=0;bridge.setEnabled('test-a.png',true);
    message.swipe_id=1;root().textContent='...';await wait();assert(!host());
    const partial=SAMPLE.slice(0,-1);message.mes=partial;message.swipes.push(partial);
    root().innerHTML=messageFormatting(partial,message.name,false,false,0);await wait();assert(!host());
    message.mes=SAMPLE+'\n\nMore text is arriving';message.swipes[1]=message.mes;
    root().innerHTML=messageFormatting(message.mes,message.name,false,false,0);await wait();
    assert(host()&&root().textContent.includes('More text is arriving'));
    message.mes+=' now.';message.swipes[1]=message.mes;
    root().innerHTML=messageFormatting(message.mes,message.name,false,false,0);await wait();
    assert(document.querySelectorAll('.display-bridge-widget').length===1&&root().textContent.includes('arriving now.'));
});
await runAdditionalTests({ test, assert, setup, native, wait, ctx, characters, bridge: () => bridge });
await runProfileTests({ test, assert, setup, wait, ctx, characters, extension_settings, bridge: () => bridge });
await runCompatibilityTests({ test, assert, setup, wait, ctx, characters, extension_settings, bridge: () => bridge });
await runLifecycleTests({ test, assert, setup, native, wait, ctx, characters, extension_settings, bridge: () => bridge });
setup(); bridge.setEnabled('test-a.png',true);
await runPortraitTests({test,assert,setup,native,wait,ctx,extension_settings,bridge:()=>bridge});
await runImageViewerTests({test,assert,setup,wait});
await runRecognitionTests({test,assert,setup,wait,ctx,characters,extension_settings,bridge:()=>bridge});

await runPresentationTests({test,assert,setup,native,wait,ctx,characters,bridge:()=>bridge});
await runMappingTests({test,assert,setup,wait,ctx,extension_settings,bridge:()=>bridge});
await runSceneTests({test,assert,setup,native,wait,ctx,bridge:()=>bridge});
await runSceneControlsTests({test,assert,setup,native,wait,ctx,bridge:()=>bridge});
await runSceneStoryTests({test,assert,setup,native,wait,ctx,bridge:()=>bridge});
await runOutfitTests({test,assert,setup,wait,ctx,bridge:()=>bridge});
await runBilingualTests({test,assert,setup});
await runAuditTests({test,assert,setup,wait,characters});
await runPerformanceTests({test,assert,setup,wait,bridge:()=>bridge});
await runSnapshotTests({test,assert,setup,bridge:()=>bridge});
await runPortableTests({test,assert,setup,native,wait,ctx,characters,extension_settings,bridge:()=>bridge});
window.testResults=results;
const passed=results.filter(x=>x.passed).length;
document.getElementById('status').textContent=`${passed}/${results.length} tests passed. ${passed===results.length?'All checks passed.':'Failures require attention.'}`;
document.title=`${passed}/${results.length} passed — Display Bridge`;
fetch('/test-results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(results)});

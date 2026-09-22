import {sceneRules,sceneMessage} from './scene-fixture.js';
import {discoverProfile} from '/extension/core/profiles.js';
import {makePlan} from '/extension/core/pipeline.js';
import {createPresetEditor} from '/extension/components/preset-editor.js';
export async function runSceneTests({test,assert,setup,native,wait,ctx,bridge}) {
    const definition=family=>discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:sceneRules(family)}}).profile;
    const roots=()=>[...document.querySelectorAll('#chat .display-bridge-widget')].map(h=>h.shadowRoot).filter(Boolean);
    const button=(r,name)=>[...r.querySelectorAll('button')].find(b=>b.textContent===name);
    const provider=async fn=>{const old=window.v3sprites;window.v3sprites={api:{apiVersion:1,resolveImage:()=>({status:'resolved',url:'/user/files/picture.png'})}};try{await fn();}finally{window.v3sprites=old;}};
    const install=(family,text)=>{const message=setup(text,{stream:false});ctx.chatId='assembled-scenes';bridge().importProfile('test-a.png',definition(family));bridge().applyPending('test-a.png');bridge().render();return message;};
    await test('Assembled source scene renders background, hover cast, dialogue and status with one final control bar',()=>provider(async()=>{
        const source='Before\n'+sceneMessage('five')+'\nBetween\n'+sceneMessage('five','2',1)+'\nAfter';const message=install('five',source);await wait();
        const scenes=roots().filter(r=>r.querySelector('.scene'));assert(scenes.length===2);assert(scenes[0].querySelectorAll('.cast-slot').length===2);assert(scenes[0].querySelectorAll('.hover-image').length===2);assert(scenes[0].querySelector('.scene-backdrop'));assert(scenes[0].querySelector('.metadata').textContent.includes('Observatory'));
        assert(roots().filter(r=>!r.querySelector('.toolbar').hidden).length===1);assert(document.querySelector('#chat').textContent.includes('Between'));assert(message.mes===source);
        const r=scenes[0];await Promise.all([...r.querySelectorAll('img')].map(i=>i.decode()));r.querySelector('.cast-slot').focus();assert(getComputedStyle(r.querySelector('.hover-image')).opacity==='1');button(r,'Collapse dialogue').click();assert(r.querySelector('.stage').classList.contains('collapsed'));button(r,'Collapse dialogue').click();button(r,'Expand dialogue').click();assert(r.querySelector('.stage').classList.contains('expanded'));
        assert(makePlan(source,{stream:false,portrait:definition('five').adapters[0].source,latestAssistant:false}).items.every(b=>!b.controls));
    }));
    await test('Assembled scenes wait for closing fragments during streaming and preserve native source on unsupported markup',()=>provider(async()=>{
        const source=sceneMessage(),partial=source.slice(0,-12);const message=install('four',partial);await wait();assert(!roots().some(r=>r.querySelector('.scene')));
        message.mes=source+'\nText continues';native(message.mes);await wait();assert(roots().some(r=>r.querySelector('.scene')));assert(document.querySelector('#chat').textContent.includes('Text continues'));
        message.mes=source.replace('Welcome to the observatory.','<unknown>Keep this text</unknown>');native(message.mes);await wait();assert(!roots().some(r=>r.querySelector('.scene')));assert(message.mes.includes('Keep this text'));
    }));
    await test('Scene assembly mappings can be previewed and reviewed without converting the fragment contract',()=>provider(async()=>{
        install('four',sceneMessage());const config=definition('four').adapters[0].source;let reviewed;
        const editor=createPresetEditor({source:config,avatar:'test-a.png',sample:sceneMessage(),review:c=>reviewed=c,close(){}});document.querySelector('.mes_text').append(editor);
        button(editor,'Preview mapped message').click();assert(editor.querySelector('.display-bridge-widget')?.shadowRoot.querySelector('.scene'));
        button(editor,'Review preset for this character').click();assert(reviewed.format.kind==='scene-fragments');assert(JSON.stringify(reviewed.format)===JSON.stringify(config.format));
    }));
}

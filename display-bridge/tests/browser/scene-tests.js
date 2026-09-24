import {sceneRules,sceneMessage,detailedSceneRules} from './scene-fixture.js';
import {parsePortraitDialogue} from '/extension/adapters/portrait-dialogue.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';
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
        const r=scenes[0];await Promise.all([...r.querySelectorAll('img')].map(i=>i.decode()));r.querySelector('.cast-slot').focus();assert(getComputedStyle(r.querySelector('.hover-image')).opacity==='1');button(r,'Collapse dialogue').click();assert(r.querySelector('.stage').classList.contains('collapsed'));button(r,'Show dialogue').click();button(r,'Expand dialogue').click();assert(r.querySelector('.stage').classList.contains('expanded'));
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
    await test('Detailed scene layers, formatted text and keyboard tooltips remain scoped and map through the provider',async()=>{
        setup('',{stream:false});
        const config=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules()}}).profile.adapters[0].source;
        config.imageMappings={weather:'mapped-weather'};
        const text=sceneMessage().replace('Welcome to the observatory.','<strong>Welcome</strong> to the *observatory*. &lt;sample&gt;');
        const requests=[],widget=createPortraitDialogue(parsePortraitDialogue(text,config).blocks[0],{resolver:(_,ref)=>{requests.push(ref);return {status:'resolved',url:'/user/files/snapshot-portrait.svg'};}});
        document.querySelector('.mes_text').append(widget.host);const root=widget.host.shadowRoot;
        await Promise.all([...root.querySelectorAll('img')].map(i=>i.decode()));
        assert(root.querySelectorAll('.scene-layer').length===2&&requests.includes('mapped-weather'));
        assert(root.querySelector('.environment>.scene-layer.effect'),'Far cloud layer is still inside the scene');
        assert(getComputedStyle(root.querySelector('.scene-backdrop')).opacity==='1','Scene background is translucent');
        assert(root.querySelector('.scene-clock').textContent==='18:30');
        assert(getComputedStyle(root.querySelector('article')).maxWidth==='none','Layered scene still has the generic width cap');
        assert(makePlan(text,{stream:false,portrait:config}).items.every(i=>!i.controls),'Generic display toolbar was appended');
        assert(root.querySelector('.scene-label').textContent==='#1'&&root.querySelector('.period-night'));
        assert(root.querySelector('.words strong').textContent==='Welcome'&&root.querySelector('.words em').textContent==='observatory');
        assert(root.querySelector('.words').textContent.includes('<sample>')&&!root.querySelector('sample'));
        assert(root.querySelector('.scene-narration'));
        const slot=root.querySelector('.cast-slot'),base=slot.querySelector('img'),tip=slot.querySelector('.portrait-tooltip');
        assert(getComputedStyle(tip).visibility==='hidden');slot.focus();assert(getComputedStyle(tip).visibility==='visible');slot.blur();assert(getComputedStyle(tip).visibility==='hidden');
        assert(getComputedStyle(root.querySelector('.scene-layer')).pointerEvents==='none');
        const bounds=base.getBoundingClientRect(),stage=root.querySelector('.stage').getBoundingClientRect();assert(bounds.top>=stage.top&&bounds.bottom<=stage.bottom,'Positioned neutral portrait escaped scene');
        const editor=createPresetEditor({source:config,avatar:'test-a.png',sample:text,review(){},close(){}});document.querySelector('.mes_text').append(editor);
        assert(editor.textContent.includes('weather'),'Layer omitted from mapping references');editor.remove();
        button(root,'Visual layout').click();assert(!root.querySelector('.plain').hidden&&root.querySelector('.plain strong'));
    });
    await test('Percentage portrait aliases retain source height and individual vertical positions',async()=>{
        setup('',{stream:false});const rules=detailedSceneRules();rules.pop();rules.push({type:'editdisplay',in:'@guide',out:'54%',ableFlag:false},{type:'editdisplay',in:'@curator',out:'66%',ableFlag:false});
        const config=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:rules}}).profile.adapters[0].source;
        const text=sceneMessage().replace('ct="0px"','ct="@guide"').replace('ct="0px"','ct="@curator"');
        const widget=createPortraitDialogue(parsePortraitDialogue(text,config).blocks[0],{resolver:()=>({status:'resolved',url:'/user/files/snapshot-portrait.svg'})});document.querySelector('.mes_text').append(widget.host);
        const slots=[...widget.host.shadowRoot.querySelectorAll('.cast-slot')];
        await Promise.all(slots.map(s=>s.querySelector('img').decode()));
        slots.forEach((s,i)=>{const img=s.querySelector('img'),css=getComputedStyle(img);assert(s.classList.contains('relative-position'));assert(Math.abs(parseFloat(css.height)/s.clientHeight-.9)<.01,'Portrait height differs from source 90%');assert(Math.abs(parseFloat(css.top)/s.clientHeight-[.54,.66][i])<.01,'Portrait alias became scaling instead of vertical position');});
    });
    await test('Detailed positioned portraits keep alpha hover boundaries; failed layers leave dialogue readable',async()=>{
        setup('',{stream:false});const config=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules()}}).profile.adapters[0].source;
        const widget=createPortraitDialogue(parsePortraitDialogue(sceneMessage(),config).blocks[0],{resolver:(_,ref)=>ref==='weather'?{status:'missing',url:null}:{status:'resolved',url:'/user/files/snapshot-portrait.svg'}});
        document.querySelector('.mes_text').append(widget.host);const root=widget.host.shadowRoot;
        await Promise.all([...root.querySelectorAll('img[src]')].map(i=>i.decode()));
        const slots=[...root.querySelectorAll('.cast-slot')],base=slots[0].querySelector('img');
        const move=(x,y)=>{const b=base.getBoundingClientRect();base.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:b.left+b.width*x,clientY:b.top+b.height*y}));};
        move(.01,.02);assert(!slots[0].classList.contains('portrait-hover'),'Transparent corner activated hover');
        move(.5,.6);assert(slots[0].classList.contains('portrait-hover')&&!slots[1].classList.contains('portrait-hover'));
        base.dispatchEvent(new PointerEvent('pointerleave'));assert(!slots[0].classList.contains('portrait-hover'));
        assert(widget.imageIssues().some(i=>i.reference==='weather')&&root.querySelector('.words').textContent.includes('Welcome'));
        button(root,'Portrait').click();assert([...root.querySelectorAll('.scene-layer')].every(i=>i.hidden));
    });
}

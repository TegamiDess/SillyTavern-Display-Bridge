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
    await test('Layered scene status paints above dialogue while portraits stay behind it',async()=>{
        setup('',{stream:false});const config=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules()}}).profile.adapters[0].source;
        const text=sceneMessage().replace('Welcome to the observatory.','Welcome to the observatory. '.repeat(20));
        const widget=createPortraitDialogue(parsePortraitDialogue(text,config).blocks[0],{resolver:()=>({status:'resolved',url:'/user/files/snapshot-portrait.svg'})});document.querySelector('.mes_text').append(widget.host);
        const root=widget.host.shadowRoot;await Promise.all([...root.querySelectorAll('img')].map(i=>i.decode()));
        const slot=root.querySelector('.cast-slot'),tip=slot.querySelector('.portrait-tooltip'),speech=root.querySelector('.speech');slot.focus();tip.scrollIntoView({block:'center'});
        const a=tip.getBoundingClientRect(),b=speech.getBoundingClientRect(),x=(Math.max(a.left,b.left)+Math.min(a.right,b.right))/2,y=(Math.max(a.top,b.top)+Math.min(a.bottom,b.bottom))/2;
        assert(y>=a.top&&y<=a.bottom&&y>=b.top&&y<=b.bottom,'Fixture must overlap caption and dialogue');
        // Probe the painted layer order; normal captions remain pointer-transparent.
        tip.style.pointerEvents='auto';assert(root.elementFromPoint(x,y)===tip,'Dialogue paints over the status');tip.style.removeProperty('pointer-events');
        assert(speech.contains(root.elementFromPoint(x,y)),'Portrait paints over dialogue or caption intercepts it');
        slot.blur();assert(getComputedStyle(tip).visibility==='hidden');widget.host.remove();
    });
    await test('Reviewed frame hover captions clear heads and overlaid dialogue, retaining their position below-scene',async()=>{
        setup('',{stream:false});const config=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules('five')}}).profile.adapters[0].source;
        config.sceneLayout={version:1,aspectRatio:[16,8.5],maxWidth:640,metadataPosition:'top'};
        const widget=createPortraitDialogue(parsePortraitDialogue(sceneMessage('five'),config).blocks[0],{resolver:()=>({status:'resolved',url:'/user/files/snapshot-portrait.svg'})});
        const holder=document.createElement('div');holder.style.width='640px';holder.append(widget.host);document.querySelector('.mes_text').append(holder);
        const root=widget.host.shadowRoot;await Promise.all([...root.querySelectorAll('img')].map(i=>i.decode()));
        const slots=[...root.querySelectorAll('.cast-slot')],slot=slots[0],base=slot.querySelector('img'),tip=slot.querySelector('.portrait-tooltip');
        const hover=(x=.5,y=.6)=>{const b=base.getBoundingClientRect();base.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:b.left+b.width*x,clientY:b.top+b.height*y}));};
        const above=()=>{const t=tip.getBoundingClientRect();assert(t.bottom<=base.getBoundingClientRect().top-7,'Caption is not above portrait');assert(t.top>=root.querySelector('.scene-header').getBoundingClientRect().bottom,'Caption obscures header');assert(t.bottom<root.querySelector('.speech').getBoundingClientRect().top,'Caption is hidden by dialogue');};
        assert(getComputedStyle(tip).visibility==='hidden');hover();assert(getComputedStyle(tip).visibility==='visible');above();assert(getComputedStyle(slots[1].querySelector('.portrait-tooltip')).visibility==='hidden');
        hover(.01,.02);assert(getComputedStyle(tip).visibility==='hidden','Transparent image corner activated caption');
        slot.focus();assert(getComputedStyle(tip).visibility==='visible');above();slot.blur();
        button(root,'Expand dialogue').click();hover();assert(getComputedStyle(tip).top!=='auto');assert(Math.abs(tip.getBoundingClientRect().bottom-(slot.getBoundingClientRect().bottom-slot.clientHeight*.35))<1,'Expanded caption position changed');
        button(root,'Expand dialogue').click();holder.style.width='320px';await wait();hover();assert(Math.abs(tip.getBoundingClientRect().bottom-(slot.getBoundingClientRect().bottom-slot.clientHeight*.35))<1,'Narrow caption did not retain below-scene position');
        base.dispatchEvent(new PointerEvent('pointerleave'));assert(getComputedStyle(tip).visibility==='hidden');holder.remove();
    });
    await test('Reviewed scene frame keeps its ratio through controls and moves long dialogue below narrow frames',async()=>{
        setup('',{stream:false});const config=definition('five').adapters[0].source;
        config.sceneLayout={version:1,aspectRatio:[16,8.5],maxWidth:640,metadataPosition:'top'};
        const text=sceneMessage('five').replace('Welcome to the observatory.','Welcome to the observatory. '.repeat(80));
        const widget=createPortraitDialogue(parsePortraitDialogue(text,config).blocks[0],{resolver:()=>({status:'resolved',url:'/user/files/snapshot-portrait.svg'})});
        const holder=document.createElement('div');holder.style.width='800px';holder.append(widget.host);document.querySelector('.mes_text').append(holder);
        await wait();const root=widget.host.shadowRoot,frame=root.querySelector('.scene-viewport');
        const bounds=()=>frame.getBoundingClientRect(),ratio=()=>assert(Math.abs(bounds().width/bounds().height-16/8.5)<.01,'Custom frame ratio changed');
        ratio();assert(Math.abs(bounds().width-640)<2,'Maximum width ignored');
        assert(root.querySelector('.scene-header').textContent.includes('Observatory'));assert(!root.querySelector('.metadata').textContent.includes('Observatory'),'Top metadata duplicated below');
        const height=bounds().height;button(root,'Expand dialogue').click();await wait();ratio();assert(Math.abs(bounds().height-height)<1,'Expanding dialogue resized image');
        button(root,'Collapse dialogue').click();await wait();ratio();button(root,'Show dialogue').click();
        holder.style.width='320px';await wait();ratio();
        assert(root.querySelector('.speech').getBoundingClientRect().top>=bounds().bottom-1,'Narrow dialogue covers scene');
        assert(root.querySelector('article').scrollWidth<=321,'Narrow frame overflow');
        button(root,'Portrait').click();assert(getComputedStyle(frame).display==='none');assert(root.querySelector('.words').textContent.includes('Welcome'));
        holder.remove();
    });
    await test('Scene layout editor preserves reviewed values and can restore the legacy layout',()=>{
        setup('',{stream:false});const config=definition('five').adapters[0].source;
        config.sceneLayout={version:1,aspectRatio:[16,8.5],maxWidth:1200,metadataPosition:'top'};let reviewed;
        const editor=createPresetEditor({source:config,avatar:'test-a.png',sample:sceneMessage('five'),review:c=>reviewed=c,close(){}});document.querySelector('.mes_text').append(editor);
        button(editor,'Review preset for this character').click();assert(JSON.stringify(reviewed.sceneLayout)===JSON.stringify(config.sceneLayout));
        const label=[...editor.querySelectorAll('label')].find(n=>n.textContent.includes('Use a custom scene frame'));label.querySelector('input').click();
        button(editor,'Review preset for this character').click();assert(!Object.hasOwn(reviewed,'sceneLayout'));editor.remove();
    });
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
        const frame=root.querySelector('.environment-viewport');assert(getComputedStyle(frame).overflow==='hidden'&&getComputedStyle(root.querySelector('.cast')).overflow==='hidden','Offset portraits must clip to the frame');
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

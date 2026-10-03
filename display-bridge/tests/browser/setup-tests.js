import {createSceneSetupForm} from '/extension/components/scene-setup-form.js';
import {discoverProfile,portraitVersion} from '/extension/core/profiles.js';
import {sceneRules} from './scene-fixture.js';
import {messageFormatting} from './formatter.js';
export async function runSetupTests({test,assert,setup,ctx,bridge,wait}) {
    const state=()=>({version:4,variables:{season:{type:'enum',initial:'unselected',values:['unselected','spring','winter']},name:{type:'string',initial:'Visitor',maxLength:100}},rules:[],setup:{version:1,title:'Observatory setup',fields:[{key:'season',label:'Season',required:true,unset:['unselected'],reset:true,native:true},{key:'name',label:'Name',required:true,unset:[],reset:false,native:true}],unique:[]}});
    await test('Setup form keeps unsaved edits through redraw and resets only configured fields',async()=>{
        const form=createSceneSetupForm(),s=state();document.body.append(form.host);
        try{
            form.update(s,null,'one');form.host.querySelector('select').value='winter';form.host.querySelector('textarea').value='Tester';
            form.update(s,null,'one');assert(form.values().season==='winter');
            form.host.querySelector('button').click();assert(form.values().season==='unselected');assert(form.values().name==='Tester');
            form.update(s,null,'two');assert(form.values().name==='Visitor','Form draft leaked across chats');
        }finally{form.host.remove();}
    });
    await test('Setup preserves saved empty enum and number choices until explicitly reset',()=>{
        const s=state();s.variables.count={type:'number',initial:5,min:0,max:10};
        s.setup.fields.push({key:'count',label:'Count',required:false,unset:[],reset:true,native:false});
        const form=createSceneSetupForm();document.body.append(form.host);
        try{
            form.update(s,{season:null,count:null,name:'Saved'},'nullable');
            assert(form.values().season===null,'Saved empty season reverted to its initial value');
            assert(form.values().count===null,'Saved empty count reverted to its initial value');
            assert(form.host.querySelector('select').selectedOptions[0]?.textContent==='Choose…','Empty choice has no visible label');
            form.host.querySelector('button').click();
            assert(form.values().season==='unselected'&&form.values().count===5,'Explicit reset did not restore defaults');
            assert(form.values().name==='Saved');
            form.update(s,{name:'Partial'},'partial');
            assert(form.values().season==='unselected'&&form.values().count===5,'Missing keys did not receive defaults');
        }finally{form.host.remove();}
    });
    await test('Settings setup commits native values, survives rebuild, and exports definitions only',async()=>{
        setup('Welcome.',{stream:false});ctx.chatId='setup-qa';ctx.chatMetadata={};ctx.saveChat=async()=>{};ctx.onlineStatus='connected';ctx.setExtensionPrompt=()=>{};
        const profile=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:sceneRules('five')}}).profile;
        profile.adapters[0].source.sceneState=state();profile.adapters[0].version=portraitVersion(profile.adapters[0].source);
        bridge().importProfile('test-a.png',profile);bridge().applyPending('test-a.png');bridge().render();await wait();
        const settings=document.getElementById('display-bridge-settings')??document.querySelector('#extensions_settings2 details');
        settings.open=true;settings.dispatchEvent(new Event('toggle'));await wait();
        const form=document.querySelector('.db-scene-setup');assert(form&&!form.hidden,'Setup is not visible');
        form.querySelector('select').value='winter';form.querySelector('textarea').value='Tester';
        const button=[...document.querySelectorAll('#extensions_settings2 button')].find(b=>b.textContent==='Initialize / rebuild scene state');button.click();await wait();
        assert(ctx.chatMetadata.variables.season==='winter');assert(ctx.chatMetadata.variables.name==='Tester');
        await bridge().story.rebuild();assert(bridge().story.read().values.name==='Tester');
        const exported=bridge().exportProfile('test-a.png');assert(exported.adapters[0].version===12);assert(exported.adapters[0].source.sceneState.variables.name.initial==='Visitor');
        assert(!JSON.stringify(exported).includes('Tester'),'Live selection leaked into export');
    });
    function startup(){
        setup('<startup-menu>',{stream:false});ctx.chatId='menu-qa';ctx.chatMetadata={};ctx.onlineStatus='connected';ctx.setExtensionPrompt=()=>{};
        const p=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:sceneRules('five')}}).profile;
        const s=state();s.setup.screen={marker:'<startup-menu>',description:'Choose a name and season.',greeting:['Welcome ',{read:'name'},' in ',{read:'season'},'.']};
        p.adapters[0].source.sceneState=s;p.adapters[0].version=portraitVersion(p.adapters[0].source);
        bridge().importProfile('test-a.png',p);bridge().applyPending('test-a.png');bridge().setEnabled('test-a.png',true);bridge().render();return p;
    }
    await test('Startup appears only at the exact fresh greeting; disabling restores native nodes and stale controls cannot save',async()=>{
        ctx.saveChat=async()=>{};startup();const root=document.querySelector('.mes_text'),screen=root.querySelector('.db-startup-screen');assert(screen,'No startup screen');
        screen.querySelector('select').value='winter';screen.querySelector('textarea').value='Tester';bridge().render();assert(root.querySelector('select').value==='winter','Redraw lost draft');
        assert(bridge().diagnostics().mounted===1,'Startup diagnostics crashed');bridge().setEnabled('test-a.png',false);assert(!root.querySelector('.db-startup-screen'));
        screen.dispatchEvent(new Event('submit',{cancelable:true}));await wait();assert(!ctx.chatMetadata.variables,'Detached controls saved state');
        bridge().setEnabled('test-a.png',true);assert(root.querySelector('.db-startup-screen'));
        ctx.chat.push({mes:'Started already',is_user:true});bridge().render();assert(!root.querySelector('.db-startup-screen'),'Menu returned in established chat');
        startup();ctx.chat[0].mes='Edited greeting';bridge().render();assert(!document.querySelector('#chat .db-startup-screen'));
    });
    await test('Startup validation and failed save retain drafts; double submit commits once and removes menu from history',async()=>{
        startup();const root=document.querySelector('.mes_text');let screen=root.querySelector('.db-startup-screen'),saves=0;
        screen.dispatchEvent(new Event('submit',{cancelable:true}));await wait();assert(screen.querySelector('[role=status]').textContent.includes('choose Season'));assert(!ctx.chatMetadata.variables);
        screen.querySelector('textarea').value='Tester';screen.querySelector('.db-scene-setup button').click();
        assert(screen.querySelector('[role=status]').textContent==='','Reset left stale validation feedback');
        assert(screen.querySelector('textarea').value==='Tester','Reset lost the preserved name');assert(!ctx.chatMetadata.variables,'Reset committed the draft');
        screen.querySelector('select').value='winter';screen.querySelector('textarea').value='Tester';let rejectSave;ctx.saveChat=()=>new Promise((_resolve,reject)=>{rejectSave=reject;});
        screen.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}));assert(screen.querySelector('[role=status]').textContent==='','Stale validation error survived a correction');
        screen.dispatchEvent(new Event('submit',{cancelable:true}));await wait();bridge().render();assert(root.querySelector('.db-startup-screen')===screen,'Slow save unmounted the draft');rejectSave(Error('disk failure'));await wait();assert(screen.querySelector('[role=status]').textContent==='disk failure');assert(screen.querySelector('textarea').value==='Tester');assert(ctx.chat[0].mes==='<startup-menu>');
        const oldReload=ctx.reloadCurrentChat;ctx.reloadCurrentChat=async()=>{root.innerHTML=messageFormatting(ctx.chat[0].mes,'Sample A',false,false,0);bridge().render();};
        try{
            ctx.saveChat=async()=>{saves++;};screen.dispatchEvent(new Event('submit',{cancelable:true}));screen.dispatchEvent(new Event('submit',{cancelable:true}));await wait();
            assert(saves===1,'Duplicate saves');assert(!root.querySelector('.db-startup-screen'));assert(root.textContent.includes('Welcome Tester in winter.'));
            assert(ctx.chat.length===1&&ctx.chat[0].mes==='Welcome Tester in winter.');assert(ctx.chatMetadata.variables.name==='Tester');assert(!bridge().story.read().issue);
        }finally{ctx.reloadCurrentChat=oldReload;}
    });
    await test('Startup layout fits a narrow message and profile roundtrip retains definitions without selections',async()=>{
        ctx.saveChat=async()=>{};const p=startup(),root=document.querySelector('.mes_text'),before=root.style.width;root.style.width='280px';
        try{
            await wait();const screen=root.querySelector('.db-startup-screen');assert(screen.scrollWidth<=screen.clientWidth+1,'Startup screen overflows narrow chat');
            assert([...screen.querySelectorAll('input,select,textarea,button')].every(el=>el.getBoundingClientRect().right<=screen.getBoundingClientRect().right+1),'Control extends beyond screen');
            screen.querySelector('textarea').value='Private draft';const exported=bridge().exportProfile('test-a.png');
            assert(JSON.stringify(exported.adapters[0].source.sceneState.setup.screen)===JSON.stringify(p.adapters[0].source.sceneState.setup.screen));assert(!JSON.stringify(exported).includes('Private draft'));
        }finally{root.style.width=before;}
    });
}

import { createDisplayBridge } from '/extension/core/bridge.js';
import { discoverProfile } from '/extension/core/profiles.js';
import { createDisplayHandoff } from './display-handoff.js';

const definition={kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'gallery',version:1}]};
export async function runCompatibilityTests({test,assert,setup,wait,ctx,characters,extension_settings,bridge}) {
    const button=label=>[...document.querySelectorAll('#display-bridge-settings button')].find(x=>x.textContent===label);
    await test('Compatibility distinguishes adapted panels, excluded image rules, disabled rules and unexecuted effects',async()=>{
        setup(undefined,{stream:false});
        const templates=await(await fetch('./witchcure-fixture.json')).json();
        const source={sourceVersion:1,origin:{format:'charx',inlineRules:0,module:'decoded',moduleRules:6,moduleEffects:1},risuai:{backgroundHTML:templates.styles,
            customScripts:[{type:'disabled',label:'Disabled fixture',out:'off'},...Object.entries(templates).filter(([key])=>key!=='styles').map(([key,out])=>({type:'editdisplay',label:key,in:key==='roster'?String.raw`\[명부\]`:key==='report'?String.raw`\[평가 보고서\]`:'fixture',out})),
                {type:'editoutput',label:'<img src="/should-not-load.png">',in:'private-pattern',out:'private-output {{getvar::private-variable}}'}],triggerscript:[{effect:[{type:'triggerlua',code:'private-script'}]}]}};
        const result=bridge().api.receiveImport({handoffVersion:1,importId:'compatibility',avatar:'test-a.png',source,images:{status:'mapped',mapped:0,issues:[]}});
        assert(result.discovery.rules[1].status==='adapted'&&result.discovery.rules[0].status==='disabled');
        assert(result.discovery.effects[0].status==='not-run');
        const s=extension_settings.v3_asset_sprites;
        s.ruleReports['test-a.png']={status:'declined',issues:['Card rule 2: HTML other than a simple image element is unsupported.']};
        bridge().render();
        const text=document.querySelector('.db-compatibility').textContent;
        assert(text.includes('Panel handled by Witchcure.')&&text.includes('getvar')&&text.includes('not-run'));
        assert(!document.querySelector('.db-compatibility img'));
        const report=JSON.stringify(bridge().compatibility());
        for(const secret of ['private-pattern','private-output','private-variable','private-script',templates.roster]) assert(!report.includes(secret),'Report exposed source content');
        delete s.ruleReports['test-a.png'];
    });
    await test('Live image report uses exact avatars, reports missing/modified/disabled rules and performs no writes',()=>{
        setup(undefined,{stream:false}); const api=window.v3sprites.api,s=extension_settings.v3_asset_sprites,avatar='test-a.png';
        const old={rules:characters[0].data.extensions.regex_scripts,allowed:extension_settings.character_allowed_regex,metadata:s.metadata[avatar],map:s.extracted[avatar],approved:s.approved[avatar]};
        const built=window.testBuildRules(characters[0],{scripts:[],assets:[]});
        try {
            characters[0].data.extensions.regex_scripts=built.wanted; s.approved[avatar]=built.approved;
            built.wanted[0].disabled=true;built.wanted[1].findRegex='modified';
            extension_settings.character_allowed_regex=[];
            s.metadata[avatar]={assets:[{type:'image',name:'known',ext:'png'},{type:'image',name:'missing',ext:'png'}],scripts:[]};
            s.extracted[avatar]={known:{path:'user/files/known.png'}};
            const before=JSON.stringify(extension_settings);
            const report=api.getCompatibility({avatar});
            assert(report.assets.missing.join()==='missing'&&report.assets.mapped===1);
            assert(!report.regex.allowed&&report.regex.active===0&&report.regex.disabled===1&&report.regex.unapproved>=1);
            ctx.characterId=1;assert(api.getCompatibility({avatar}).assets.mapped===1);
            assert(api.getCompatibility({avatar:'absent.png'}).status==='unavailable');
            assert(JSON.stringify(extension_settings)===before,'Report mutated settings');
            assert(!JSON.stringify(report).includes('user/files/'));
        } finally {ctx.characterId=0;characters[0].data.extensions.regex_scripts=old.rules;extension_settings.character_allowed_regex=old.allowed;s.metadata[avatar]=old.metadata;s.extracted[avatar]=old.map;s.approved[avatar]=old.approved;}
    });
    await test('Previous panel settings survive serialization and restore without replaying an import or changing chat/rules',()=>{
        setup(); bridge().setEnabled('test-a.png',false);
        const before=JSON.stringify(ctx.chat),rules=JSON.stringify(characters[0].data.extensions.regex_scripts);
        bridge().importProfile('test-a.png',definition);bridge().applyPending('test-a.png');
        assert(extension_settings.display_bridge.profiles['test-a.png'].adapters.join()==='gallery');
        bridge().stop();extension_settings.display_bridge=JSON.parse(JSON.stringify(extension_settings.display_bridge));
        const restarted=createDisplayBridge({getContext:()=>ctx,extensionSettings:extension_settings,saveSettings:()=>{},cssParser:window.cssTools});
        try {
            restarted.start();restarted.restorePanels('test-a.png');
            const p=extension_settings.display_bridge.profiles['test-a.png'];
            assert(!p.enabled&&p.adapters.join()==='media-panel'&&!p.previousPanels&&!p.pendingProfile);
            assert(JSON.stringify(ctx.chat)===before&&JSON.stringify(characters[0].data.extensions.regex_scripts)===rules);
            let rejected=false;try{restarted.restorePanels('test-a.png');}catch{rejected=true;}assert(rejected);
        } finally {restarted.stop();}
    });
    await test('Old reports and absent providers are explicit; stale recovery buttons cannot retarget another card',async()=>{
        setup(undefined,{stream:false});const saved=window.v3sprites;
        try {
            window.v3sprites=undefined;bridge().render();
            assert(bridge().compatibility().provider.status==='not connected'&&!bridge().compatibility().discovery);
            window.v3sprites={api:{apiVersion:1,resolveImage:()=>({status:'missing'})}};bridge().render();
            assert(bridge().compatibility().provider.status==='older provider');
            window.v3sprites=saved;bridge().render();
            bridge().importProfile('test-a.png',definition);bridge().importProfile('test-b.png',definition);bridge().render();
            const stale=button('Rescan local images'),before=JSON.stringify(extension_settings);
            ctx.characterId=1;stale.click();button('Apply imported UI profile').click();button('Keep current panels').click();await wait();
            assert(JSON.stringify(extension_settings)===before,'Stale control changed another card');
            for(const id of ['attach','rescan','resync','retry']) {let rejected=false;try{saved.recovery[id]({avatar:'test-a.png'});}catch{rejected=true;}assert(rejected);}
        } finally {window.v3sprites=saved;ctx.characterId=0;}
    });
    await test('Selected-card delivery retry leaves other queued imports untouched',()=>{
        let records={},calls=[];
        const relay=createDisplayHandoff({records:()=>records,save:()=>{},getBridge:()=>({importApiVersion:1,receiveImport:item=>{calls.push(item.avatar);return {status:'review'};}})});
        for(const avatar of ['a.png','b.png']) {relay.queue({avatar,importId:avatar,source:{sourceVersion:1}});records[avatar].delivery='pending';}
        relay.flush('a.png');assert(calls.join()==='a.png'&&records['b.png'].delivery==='pending');
    });
    await test('Image rule recovery cancellation preserves regex permissions and existing rules',async()=>{
        setup(undefined,{stream:false});const before=JSON.stringify(characters[0]),permission=JSON.stringify(extension_settings.character_allowed_regex);
        let calls=0;
        window.fixtureImport={confirm:()=>false,fetch:async(url)=>{calls++;assert(url==='/api/characters/get','Unexpected write during cancelled recovery');return new Response(JSON.stringify(characters[0]));}};
        try {
            const result=await window.v3sprites.recovery.resync({avatar:'test-a.png'});
            assert(result.changed===false&&calls===2&&JSON.stringify(characters[0])===before&&JSON.stringify(extension_settings.character_allowed_regex)===permission);
            assert(window.v3sprites.api.getCompatibility({avatar:'test-a.png'}).regex.lastSync.status==='declined');
        } finally {delete window.fixtureImport;}
    });
    await test('Approved image-rule repair preserves unrelated and disabled rules without granting character regex permission',async()=>{
        setup(undefined,{stream:false});const original=structuredClone(characters[0]),allowed=extension_settings.character_allowed_regex;
        const built=window.testBuildRules(characters[0],{scripts:[],assets:[]});
        const disabled={...built.wanted[0],disabled:true},unrelated={id:'unrelated',scriptName:'Unrelated',findRegex:'hello',replaceString:'world',disabled:false};
        const stored=structuredClone(characters[0]);stored.data.extensions.regex_scripts=[disabled,unrelated];characters[0].data.extensions.regex_scripts=structuredClone(stored.data.extensions.regex_scripts);
        extension_settings.character_allowed_regex=[];let writes=0;
        window.fixtureImport={confirm:()=>true,fetch:async(url,options)=>{
            if(url==='/api/characters/get')return new Response(JSON.stringify(stored));
            if(url==='/api/characters/merge-attributes') {
                const body=JSON.parse(options.body);assert(body.avatar==='test-a.png');writes++;
                stored.data.extensions.regex_scripts=body.data.extensions.regex_scripts;
                if(body.data.assets)stored.data.assets=body.data.assets;
                return new Response('{}');
            }
            throw Error('Unexpected API '+url);
        }};
        try {
            const result=await window.v3sprites.recovery.resync({avatar:'test-a.png'});
            assert(result?.changed&&writes===1,'Rule repair failed');
            const saved=characters[0].data.extensions.regex_scripts;
            assert(saved.find(x=>x.id===disabled.id)?.disabled);
            assert(JSON.stringify(saved.find(x=>x.id==='unrelated'))===JSON.stringify(unrelated));
            const report=window.v3sprites.api.getCompatibility({avatar:'test-a.png'});
            assert(report.regex.lastSync.status==='installed'&&!report.regex.allowed&&report.regex.active===0);
            assert(extension_settings.character_allowed_regex.length===0);
        } finally {delete window.fixtureImport;characters[0]=original;extension_settings.character_allowed_regex=allowed;}
    });
    await test('Failed or unfinished new deliveries cannot borrow an earlier successful per-rule report',()=>{
        setup(undefined,{stream:false});const s=extension_settings.v3_asset_sprites,old=s.displayImports['test-a.png'];
        try {
            bridge().api.receiveImport({handoffVersion:1,importId:'old-success',avatar:'test-a.png',source:{sourceVersion:1,profile:definition}});
            for(const status of ['source-error','mapping','pending']) {
                s.displayImports['test-a.png']={importId:'new-attempt',delivery:status,error:'Module could not be decoded',source:{secret:'must not leave transport'}};
                bridge().render();const report=bridge().compatibility();
                assert(report.delivery.status===status&&!report.discovery);
                assert(!JSON.stringify(report).includes('must not leave transport'));
                assert(document.querySelector('.db-compatibility').textContent.includes('Module could not be decoded'));
            }
        } finally {if(old)s.displayImports['test-a.png']=old;else delete s.displayImports['test-a.png'];}
    });
    await test('Named widget image failures stay visible through refresh and rebuild retries without changing messages',async()=>{
        setup();bridge().setEnabled('test-a.png',true);await wait();
        const before=JSON.stringify(ctx.chat),host=document.querySelector('.display-bridge-widget'),img=host.shadowRoot.querySelector('img');
        img.dispatchEvent(new Event('error'));await wait();
        assert(bridge().compatibility().imageIssues.some(x=>x.reference==='sample.webp'&&x.status==='load-failed'));
        bridge().render();assert(bridge().compatibility().imageIssues.some(x=>x.status==='load-failed'));
        button('Rebuild current panels').click();await wait();
        assert(document.querySelector('.display-bridge-widget')!==host&&JSON.stringify(ctx.chat)===before);
    });
    await test('Panel readiness separates switched-off panels, missing templates, bridge off and ready; conflicts update live',()=>{
        setup(undefined,{stream:false});bridge().setWitchcureEnabled('test-a.png',true);
        assert(bridge().compatibility().panels.find(x=>x.id==='witchcure').state==='missing or incompatible');
        bridge().setStreamEnabled('test-a.png',true);
        assert(bridge().compatibility().panels[0].state==='bridge off');bridge().setEnabled('test-a.png',true);
        assert(bridge().compatibility().panels[0].state==='ready');bridge().setStreamEnabled('test-a.png',false);
        assert(bridge().compatibility().panels[0].state==='off');
        extension_settings.regex=[{scriptName:'Overlapping roster',findRegex:'명부'}];
        assert(bridge().compatibility().conflicts.includes('Overlapping roster'));
        extension_settings.regex[0].disabled=true;assert(!bridge().compatibility().conflicts.length);
    });
}

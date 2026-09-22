import { createDisplayBridge } from '/extension/core/bridge.js';
import { discoverProfile, validateProfile } from '/extension/core/profiles.js';
import { compileWitchcure } from '/extension/adapters/witchcure.js';
import { makePlan } from '/extension/core/pipeline.js';
import { eventSource,event_types } from './runtime.js';

export async function runLifecycleTests({test,assert,setup,native,wait,ctx,characters,extension_settings,bridge}) {
    const templates=await(await fetch('./witchcure-fixture.json')).json();
    const extra=await(await fetch('./witchcure-extra-rules.json')).json();
    const source={sourceVersion:1,risuai:{backgroundHTML:templates.styles,customScripts:[
        {type:'disabled'},...Object.entries(templates).filter(([k])=>k!=='styles').map(([k,out])=>({type:'editdisplay',in:k==='roster'?String.raw`\[명부\]`:k==='report'?String.raw`\[평가 보고서\]`:'fixture',out})),{type:'disabled'},...extra,
    ]}};
    let definition;
    const root=()=>document.querySelector('.mes_text'),host=()=>document.querySelector('[data-adapter=witchcure]'),report=()=>!!host()?.shadowRoot.querySelector('.assessment-report-wrapper');
    function activate(text='Ordinary reply.') {
        setup(text,{stream:false});ctx.chatId='persistent-chat';
        bridge().importProfile('test-a.png',definition);if(extension_settings.display_bridge.profiles['test-a.png'].pendingProfile)bridge().applyPending('test-a.png');
        bridge().setEnabled('test-a.png',true);bridge().render();
    }
    await test('All remaining Witchcure source rules are classified: sixteen adapted, two disabled, one empty separator',()=>{
        const result=discoverProfile(source,window.cssTools);definition=result.profile;
        assert(definition,'Profile rejected: '+result.notes.join(' '));
        assert(definition.adapters[0].version===2);assert(result.discovery.rules.filter(r=>r.status==='adapted').length===16);
        assert(result.discovery.rules.filter(r=>r.status==='disabled').length===2&&result.discovery.rules.filter(r=>r.status==='no-op').length===1);
        const c=compileWitchcure(definition.adapters[0].source,window.cssTools);assert(c.portraits.length===10&&c.autoRoster&&c.cleanMoveTop);
        const bad=structuredClone(definition);bad.adapters[0].source.portraits[0].template=bad.adapters[0].source.portraits[0].template.replace('<img ','<img onerror="alert(1)" ');
        let rejected=false;try{validateProfile(bad,window.cssTools);}catch{rejected=true;}assert(rejected);
        bad.adapters[0].version=1;rejected=false;try{validateProfile(bad,window.cssTools);}catch{rejected=true;}assert(rejected);
    });
    await test('Decorated portraits retain their styles, use mapped assets and omit unused checkbox controls',()=>{
        const provider=extension_settings.v3_asset_sprites;provider.enrolled['test-a.png']=true;provider.extracted['test-a.png']??={};
        for(const name of ['Liliel Fortina','Charlotte'])provider.extracted['test-a.png'][name]={path:'user/files/portrait-fixture.png'};
        activate('Portrait:\n\n<img src="Liliel Fortina">\n\n<img src="Charlotte">\n\nAfter @@move_top.');
        const saved=JSON.stringify(ctx.chat);const widgets=[...document.querySelectorAll('[data-adapter=witchcure-portrait]')];assert(widgets.length===2);
        for(const w of widgets){assert(w.shadowRoot.querySelector('img').getAttribute('src')==='/user/files/portrait-fixture.png');assert(!w.shadowRoot.querySelector('input'));assert(getComputedStyle(w.shadowRoot.querySelector('[class$="-image-wrapper"]')).backgroundImage.includes('linear-gradient'));}
        assert(!root().textContent.includes('@@move_top'));assert(root().lastElementChild===host());assert(JSON.stringify(ctx.chat)===saved);
        const compiled=compileWitchcure(definition.adapters[0].source,window.cssTools);
        const plan=makePlan('`<img src="Charlotte"> @@move_top`\n\n```\n@@move_top\n```',{witchcure:compiled});
        assert(plan.items.every(x=>x.type==='witchcure'),'Code examples were interpreted as actions');
        bridge().setWitchcureEnabled('test-a.png',false);assert(!host()&&root().textContent.includes('@@move_top'));assert(JSON.stringify(ctx.chat)===saved);
        bridge().setWitchcureEnabled('test-a.png',true);native('```\n@@move_top\n```');bridge().render();assert(root().querySelector('code')?.textContent.includes('@@move_top')&&host(),'Appended roster broke a fenced code example');
    });
    await test('Automatic roster remains display-only, keeps recent visibility and does not duplicate an explicit roster',()=>{
        activate('Before [명부]\n\nAfter.');assert(document.querySelectorAll('[data-adapter=witchcure]').length===1&&root().lastElementChild===host());
        const original=JSON.stringify(ctx.chat[0]);native('Second',{id:1});native('Third',{id:2});bridge().render();
        assert(document.querySelector('.mes[mesid="0"] [data-adapter=witchcure]').hidden);assert(JSON.stringify(ctx.chat[0])===original);
    });
    await test('Report preference survives serialized restart, isolates branches and resets without touching messages',async()=>{
        activate();const original=JSON.stringify(ctx.chat);host().shadowRoot.querySelector('[data-db-switch]').click();await wait();assert(report());
        const exported=bridge().exportPreferences('test-a.png');assert(exported.chats[0].mode==='report');
        bridge().stop();extension_settings.display_bridge=JSON.parse(JSON.stringify(extension_settings.display_bridge));
        const restarted=createDisplayBridge({getContext:()=>ctx,extensionSettings:extension_settings,saveSettings:()=>{},cssParser:window.cssTools});
        try{restarted.start();restarted.render();assert(report());ctx.chatId='branch';restarted.render();assert(!report());ctx.chatId='persistent-chat';restarted.render();assert(report());
            restarted.resetPreferences('test-a.png');await wait();assert(!report());restarted.importPreferences('test-a.png',exported);await wait();assert(report());
            eventSource.emit(event_types.CHAT_CREATED);await wait();assert(!report());assert(JSON.stringify(ctx.chat)===original);
        }finally{restarted.stop();}
    });
    await test('Character rename moves settings and asset ownership; deletion and same-name replacement cannot inherit them',async()=>{
        const original=characters[0],provider=extension_settings.v3_asset_sprites;
        activate();const snapshot=JSON.parse(JSON.stringify(provider));
        try{
            original.create_date='lifecycle-first';bridge().render();window.v3sprites.api.resolveImage({avatar:'test-a.png',reference:'sample.webp'});
            host().shadowRoot.querySelector('[data-db-switch]').click();await wait();assert(report());
            const mapped=JSON.stringify(provider.extracted['test-a.png']);original.avatar='renamed-fixture.png';
            eventSource.emit(event_types.CHARACTER_RENAMED,'test-a.png',original.avatar);await wait();
            assert(report()&&extension_settings.display_bridge.profiles[original.avatar].enabled);assert(JSON.stringify(provider.extracted[original.avatar])===mapped&&!provider.extracted['test-a.png']);
            const old={...original};eventSource.emit(event_types.CHARACTER_DELETED,{character:old});characters[0]={...old,create_date:'lifecycle-second'};await wait();bridge().render();
            assert(!extension_settings.display_bridge.profiles[old.avatar]?.enabled&&!host());assert(window.v3sprites.api.resolveImage({avatar:old.avatar,reference:'sample.webp'}).status==='not-enrolled');
            assert(provider.retired.length>0&&extension_settings.display_bridge.retired.length>0);
        }finally{original.avatar='test-a.png';delete original.create_date;characters[0]=original;extension_settings.v3_asset_sprites=snapshot;}
    });
    await test('Replaced native identity without a delete event retires old panel selections and image enrollment',()=>{
        const provider=extension_settings.v3_asset_sprites,snapshot=JSON.parse(JSON.stringify(provider));
        try{
            activate();characters[0].create_date='before-replacement';bridge().render();window.v3sprites.api.resolveImage({avatar:'test-a.png',reference:'sample.webp'});
            characters[0].create_date='after-replacement';bridge().render();
            assert(!host()&&!extension_settings.display_bridge.profiles['test-a.png']?.enabled);
            assert(window.v3sprites.api.resolveImage({avatar:'test-a.png',reference:'sample.webp'}).status==='not-enrolled');
        }finally{delete characters[0].create_date;extension_settings.v3_asset_sprites=snapshot;}
    });
    await test('Interrupted mapping resumes as incomplete without uploads or native import; retries cannot revive retired identities',()=>{
        setup(undefined,{stream:false});const s=extension_settings.v3_asset_sprites,snapshot=JSON.parse(JSON.stringify(s));
        try{
            s.displayImports['test-a.png']={handoffVersion:1,avatar:'test-a.png',importId:'interrupted-fixture',delivery:'mapping',source:{sourceVersion:1,profile:{kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'gallery',version:1}]}}};
            let calls=0;window.fixtureImport={fetch:()=>{calls++;throw Error('Unexpected request');},drop:()=>{calls++;throw Error('Unexpected import');}};
            window.testReconcileProviderStartup();assert(calls===0);
            assert(s.displayImports['test-a.png'].delivery==='delivered');assert(extension_settings.display_bridge.profiles['test-a.png'].importReport.images.status==='incomplete');
            s.displayImports['test-b.png']={handoffVersion:1,avatar:'test-b.png',importId:'retired-fixture',delivery:'pending',source:{sourceVersion:1,profile:definition},images:{status:'mapped',mapped:0,issues:[]}};
            eventSource.emit(event_types.CHARACTER_DELETED,{character:characters[1]});window.v3sprites.retryDisplayImports();assert(!extension_settings.display_bridge.profiles['test-b.png']?.enabled);
        }finally{delete window.fixtureImport;extension_settings.v3_asset_sprites=snapshot;}
    });
    await test('Unassigned source is attached only after explicit target review; cancellation keeps it available',async()=>{
        setup(undefined,{stream:false});const s=extension_settings.v3_asset_sprites,snapshot=JSON.parse(JSON.stringify(s));let imports=0;
        const record={intendedName:'Recovered fixture',format:'json',assets:[],scripts:[],displaySource:{sourceVersion:1,profile:{kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'gallery',version:1}]}}};
        s.unboundImports['unbound-fixture']=record;
        window.fixtureImport={confirm:()=>false,drop:()=>{imports++;},fetch:async(url,options)=>{
            const body=JSON.parse(options?.body??'{}'),reply=x=>new Response(JSON.stringify(x));
            if(url==='/api/characters/get')return reply(characters[0]);if(url==='/api/files/sanitize-filename')return reply({fileName:body.fileName});if(url==='/api/images/folders')return reply([]);
            if(String(url).startsWith('/api/'))throw Error('Unexpected request '+url);return globalThis.fetch(url,options);
        }};
        try{
            await window.v3sprites.recovery.bindPending({avatar:'test-a.png',importId:'unbound-fixture'});assert(s.unboundImports['unbound-fixture']);
            window.fixtureImport.confirm=message=>message.startsWith('Attach retained source');
            const result=await window.v3sprites.recovery.bindPending({avatar:'test-a.png',importId:'unbound-fixture'});
            assert(result?.ui.status==='applied'&&!s.unboundImports['unbound-fixture']&&imports===0);
        }finally{delete window.fixtureImport;extension_settings.v3_asset_sprites=snapshot;}
    });
    const show=document.createElement('button');show.textContent='Show decorated portraits';show.addEventListener('click',()=>activate('Two decorated portraits:\n\n<img src="Liliel Fortina">\n\n<img src="Charlotte">\n\nAutomatic roster follows.'));document.getElementById('inspection-controls').append(show);
}

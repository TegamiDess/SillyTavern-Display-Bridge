import { captureDisplaySource, createDisplayHandoff } from './display-handoff.js';
import { discoverProfile, validateProfile } from '/extension/core/profiles.js';
import { createDisplayBridge } from '/extension/core/bridge.js';
import { messageFormatting } from './formatter.js';

const definition = {kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'media-panel',version:1},{id:'gallery',version:1}]};
const card = () => ({spec:'chara_card_v3',spec_version:'3.0',data:{name:'Import fixture',description:'Private story text',first_mes:'Private greeting',assets:[],extensions:{display_bridge_profile:definition}}});
const envelope = (avatar='test-b.png',importId=crypto.randomUUID()) => ({handoffVersion:1,avatar,importId,source:captureDisplaySource(card()),images:{status:'mapped',mapped:1,issues:[]}});

export async function runProfileTests({test,assert,setup,wait,ctx,characters,extension_settings,bridge}) {
    const state = avatar => extension_settings.display_bridge.profiles[avatar];
    await test('Import source excludes prompts, assets and state; snapshots are independent',()=>{
        const input=card(); input.data.extensions.risuai={backgroundHTML:'<style>.sample{color:red}</style>',customScripts:[{type:'editdisplay',in:'x',out:'y',private:'omit'}],triggerscript:[{effect:[{type:'triggerlua',code:'untrusted',private:'omit'}]}],variables:{secret:1}};
        const source=captureDisplaySource(input), text=JSON.stringify(source);
        assert(!text.includes('Private')&&!text.includes('secret')&&!text.includes('omit'));
        input.data.extensions.risuai.customScripts[0].out='changed'; assert(source.risuai.customScripts[0].out==='y');
        let rejected=false; try{captureDisplaySource({data:{extensions:{risuai:{backgroundHTML:'x'.repeat(2000001)}}}});}catch{rejected=true;} assert(rejected);
    });
    await test('Deferred UI handoff survives restart, exceptions, absent/older bridge and retries',()=>{
        let records={},api=null,saves=0,calls=0;
        const make=()=>createDisplayHandoff({records:()=>records,save:()=>saves++,getBridge:()=>api});
        let relay=make(), item=envelope(); relay.queue(item); relay.complete(item.avatar,item.importId,item.images);
        assert(records[item.avatar].delivery==='pending');
        records=JSON.parse(JSON.stringify(records)); relay=make(); api={importApiVersion:0}; relay.flush(); assert(relay.pending().length===1);
        api={importApiVersion:1,receiveImport(){calls++;throw Error('Temporary failure');}}; relay.flush(); assert(records[item.avatar].error==='Temporary failure');
        api.receiveImport=()=>{calls++;return {status:'review'};}; relay.flush(); relay.flush();
        assert(calls===2&&records[item.avatar].delivery==='delivered'&&!records[item.avatar].source&&saves>0);
    });
    await test('Fresh handoff targets its imported avatar; retries preserve later disabled choices',async()=>{
        setup(undefined,{stream:false}); const item=envelope();
        const result=bridge().api.receiveImport(item);
        assert(result.status==='applied'&&state('test-b.png').enabled&&state('test-b.png').adapters.length===2);
        assert(!state('test-a.png')?.enabled&&ctx.characterId===0);
        bridge().setEnabled('test-b.png',false); bridge().api.receiveImport(item); assert(!state('test-b.png').enabled);
        const snapshot=JSON.stringify(extension_settings.display_bridge); let rejected=false;
        try{bridge().api.receiveImport({...item,avatar:'missing.png'});}catch{rejected=true;}
        assert(rejected&&snapshot===JSON.stringify(extension_settings.display_bridge)); await wait();
    });
    await test('Existing panel choices wait for review; Keep current and Apply work independently',async()=>{
        setup(undefined,{stream:false}); bridge().setEnabled('test-a.png',false);
        let result=bridge().api.receiveImport(envelope('test-a.png')); await wait();
        assert(result.status==='review'&&!state('test-a.png').enabled&&state('test-a.png').pendingProfile);
        const button=label=>[...document.querySelectorAll('#display-bridge-settings button')].find(x=>x.textContent===label);
        button('Keep current panels').click(); await wait(); assert(!state('test-a.png').pendingProfile&&!state('test-a.png').enabled);
        bridge().api.receiveImport(envelope('test-a.png')); await wait(); button('Apply imported UI profile').click(); await wait();
        assert(state('test-a.png').enabled&&!state('test-a.png').pendingProfile&&state('test-a.png').adapters.includes('gallery'));
    });
    await test('Saved receipt prevents replay after bridge recreation; incomplete images remain visible in report',()=>{
        setup(undefined,{stream:false}); const item=envelope(); item.images={status:'incomplete',mapped:0,issues:['Image unavailable']};
        const report=bridge().api.receiveImport(item); assert(report.status==='applied'&&report.images.status==='incomplete'&&report.images.issues[0]==='Image unavailable');
        bridge().setEnabled('test-b.png',false); bridge().stop();
        extension_settings.display_bridge=JSON.parse(JSON.stringify(extension_settings.display_bridge));
        const restarted=createDisplayBridge({getContext:()=>ctx,extensionSettings:extension_settings,saveSettings:()=>{},cssParser:window.cssTools});
        try { restarted.start(); restarted.api.receiveImport(item); assert(!state('test-b.png').enabled); }
        finally { restarted.stop(); }
    });
    await test('Conflicting native rules require review; invalid and unsupported profiles never enable',()=>{
        setup(undefined,{stream:false}); extension_settings.regex=[{scriptName:'Native stream',findRegex:'Assets:',markdownOnly:true}];
        const conflict=bridge().api.receiveImport(envelope()); assert(conflict.status==='review'&&!state('test-b.png').enabled);
        assert(conflict.notes.some(x=>x.includes('Native stream'))); extension_settings.regex=[];
        const invalid=envelope('test-a.png'); invalid.source.profile.schemaVersion=99;
        assert(bridge().api.receiveImport(invalid).status==='rejected'&&!state('test-a.png').enabled);
        const unsupported=envelope('test-a.png'); delete unsupported.source.profile;
        assert(bridge().api.receiveImport(unsupported).status==='unsupported'&&!state('test-a.png').enabled);
    });
    await test('Witchcure profile validates templates, round-trips and rejects unsafe changes atomically',async()=>{
        setup(undefined,{stream:false}); const source=await(await fetch('./witchcure-fixture.json')).json();
        const profile={kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'witchcure',version:1,source}]};
        const validated=validateProfile(profile,window.cssTools); bridge().importProfile('test-a.png',validated); bridge().applyPending('test-a.png');
        assert(JSON.stringify(bridge().exportProfile('test-a.png'))===JSON.stringify(validated));
        const before=JSON.stringify(state('test-a.png')); const bad=structuredClone(profile); bad.adapters[0].source.extra='unknown';
        let rejected=false;try{bridge().importProfile('test-a.png',bad);}catch{rejected=true;} assert(rejected&&before===JSON.stringify(state('test-a.png')));
        const risu={backgroundHTML:source.styles,customScripts:Object.entries(source).filter(([key])=>key!=='styles').map(([key,out])=>({type:'editdisplay',in:key==='roster'?String.raw`\[명부\]`:key==='report'?String.raw`\[평가 보고서\]`:'fixture',out}))};
        assert(discoverProfile({sourceVersion:1,risuai:risu},window.cssTools).profile.adapters[0].id==='witchcure');
    });
    await test('Real CHARX parser carries embedded image and UI across a native-import metadata loss',async()=>{
        setup(undefined,{stream:false}); const original=JSON.stringify(ctx.chat); const start=characters.length;
        const input=card(); input.data.name='Unique CHARX fixture'; input.data.assets=[{type:'image',name:'sample',uri:'embeded://assets/sample.png',ext:'png'}];
        input.data.extensions={risuai:{customScripts:[{type:'editdisplay',in:String.raw`\[Assets:(.*?)\|Chat:(.*?)\|Time:(.*?)\|AkaChat:(.*?)\]`,out:'fixture stream'}],triggerscript:[{effect:[{type:'triggerlua',code:'extractAllDcBlocks processDcBlock PNUM PCONT'}]}]}};
        const avatar='charx-fixture.png', imported={name:input.data.name,avatar,data:{extensions:{regex_scripts:[]}}}; let uploaded=0,dropped=0;
        window.fixtureImport={drop:async files=>{assert(files.length===1&&files[0].name.endsWith('.charx'));dropped++;characters.push(imported);},fetch:async(url,options)=>{
            const body=JSON.parse(options?.body??'{}'), response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
            if(url==='/api/files/sanitize-filename')return response({fileName:body.fileName});
            if(url==='/api/images/folders')return response([]);
            if(url==='/api/characters/get'){assert(body.avatar_url===avatar);return response(imported);}
            if(url==='/api/files/upload'){uploaded++;return response({path:'user/files/import-fixture.png'});}
            if(String(url).startsWith('/api/'))throw Error('Unexpected mock API '+url);
            return globalThis.fetch(url,options);
        }};
        try {
            const zip=new JSZip(); zip.file('card.json',JSON.stringify(input));
            zip.file('assets/sample.png',Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='),x=>x.charCodeAt(0)));
            const result=await window.v3sprites.import(new File([await zip.generateAsync({type:'uint8array'})],'fixture.charx'));
            assert(result?.mapped===1&&uploaded===1&&dropped===1,'CHARX import/image mapping failed');
            assert(result.ui.status==='applied'&&state(avatar).adapters.includes('gallery')&&state(avatar).adapters.includes('media-panel'));
            assert(ctx.characterId===0&&!state('test-a.png')?.enabled&&JSON.stringify(ctx.chat)===original);
            assert(window.v3sprites.displayImportStatus(avatar).delivery==='delivered');
        } finally {delete window.fixtureImport;characters.splice(start);}
    });
    await test('Module-based CHARX imports Witchcure; attaching recovers an existing card without native reimport',async()=>{
        setup(undefined,{stream:false});const start=characters.length;
        const source=await(await fetch('./witchcure-fixture.json')).json();
        const bytes=await(await fetch('./module-fixture.risum')).arrayBuffer();
        const input=card();input.data.name='Module fixture';input.data.extensions={risuai:{backgroundHTML:source.styles}};
        const avatar='module-fixture.png',imported={avatar,name:input.data.name,data:{extensions:{regex_scripts:[]}}};
        let dropped=0,uploaded=0;
        window.fixtureImport={confirm:message=>message.startsWith('Use '),drop:async()=>{dropped++;characters.push(imported);},fetch:async(url,options)=>{
            const body=JSON.parse(options?.body??'{}'),reply=value=>new Response(JSON.stringify(value));
            if(url==='/api/files/sanitize-filename')return reply({fileName:body.fileName});
            if(url==='/api/images/folders')return reply([]);
            if(url==='/api/characters/get')return reply(imported);
            if(url==='/api/files/upload'){uploaded++;throw Error('No uploads expected');}
            if(String(url).startsWith('/api/'))throw Error('Unexpected API '+url);
            return globalThis.fetch(url,options);
        }};
        try {
            const zip=new JSZip();zip.file('card.json',JSON.stringify(input));zip.file('module.risum',bytes);
            const file=new File([await zip.generateAsync({type:'uint8array'})],'module.charx');
            const result=await window.v3sprites.import(file);
            assert(result?.ui.status==='applied'&&state(avatar).adapters.join()==='witchcure');
            assert(state(avatar).witchcureSource.map&&state(avatar).witchcureSource.status);
            const report=window.v3sprites.api.getCompatibility({avatar});
            assert(report.origin.module==='decoded'&&report.origin.inlineRules===0&&report.origin.moduleRules===4);
            assert(result.ui.discovery.rules.filter(x=>x.status==='adapted').length===4);
            delete extension_settings.display_bridge.profiles[avatar];bridge().setEnabled(avatar,false);
            const repaired=await window.v3sprites.attach(file,avatar);
            assert(repaired?.ui.status==='review'&&!state(avatar).enabled&&state(avatar).pendingProfile);
            bridge().applyPending(avatar);
            assert(state(avatar).enabled&&state(avatar).witchcureSource.roster===source.roster&&dropped===1&&uploaded===0);
        } finally {delete window.fixtureImport;characters.splice(start);}
    });
    await test('Approved exact-name rule protects native image HTML before DOM insertion without changing messages',()=>{
        setup(undefined,{stream:false});
        const built=window.testBuildRules(characters[0],{scripts:[],assets:[{type:'image',name:'Lerevan Peinard',uri:'embedded://a.png',ext:'png'}]});
        const rule=built.wanted.find(x=>x.id==='v3s-local-named-img');assert(rule);
        const old=characters[0].data.extensions.regex_scripts;
        characters[0].data.extensions.regex_scripts=[rule];
        extension_settings.character_allowed_regex=['test-a.png'];
        try {
            const raw='<img src="Lerevan Peinard">';
            const formatted=messageFormatting(raw,'Sample A',false,false,1);
            assert(!formatted.includes('<img')&&formatted.includes(rule.replaceString),'Native formatter exposed the bare image src');
            assert(messageFormatting('<img src="/ordinary.png">','Sample A',false,false,1).includes('/ordinary.png'));
        } finally {characters[0].data.extensions.regex_scripts=old;}
    });
    await test('Image references inside highlighted code remain literal and cannot steal outside image captures',async()=>{
        setup(undefined,{stream:false});const s=extension_settings.v3_asset_sprites,oldRules=characters[0].data.extensions.regex_scripts,oldApproved=s.approved['test-a.png'],oldMap=s.extracted['test-a.png'];
        const built=window.testBuildRules(characters[0],{scripts:[],assets:[{type:'image',name:'Charlotte',uri:'embedded://a.png',ext:'png'},{type:'image',name:'Lerevan Peinard',uri:'embedded://b.png',ext:'png'}]});
        try{
            characters[0].data.extensions.regex_scripts=built.wanted;s.approved['test-a.png']=built.approved;s.enrolled['test-a.png']=true;
            s.extracted['test-a.png']={Charlotte:{path:'user/files/charlotte.png'},'Lerevan Peinard':{path:'user/files/lerevan.png'}};
            extension_settings.character_allowed_regex=['test-a.png'];
            const source='```html\n<img src="Charlotte">\n```\n\n<img src="Lerevan Peinard">';
            const ctxMessage=ctx.chat[0];ctxMessage.mes=source;const root=document.querySelector('.mes_text');root.innerHTML=messageFormatting(source,'Sample A',false,false,0);
            const code=root.querySelector('code'),text=code.textContent,split=document.createElement('span');split.textContent=text.slice(0,14);code.replaceChildren(split,document.createTextNode(text.slice(14)));
            window.v3sprites.rewrite();await wait();
            assert(code.textContent.includes('<img src="Charlotte">')&&!code.textContent.includes('V3ASSETREF_'));assert(!code.querySelector('img'));
            assert(root.querySelectorAll('img').length===1&&root.querySelector('img').getAttribute('src')==='/user/files/lerevan.png');assert(ctxMessage.mes===source);
        }finally{characters[0].data.extensions.regex_scripts=oldRules;s.approved['test-a.png']=oldApproved;s.extracted['test-a.png']=oldMap;}
    });
}

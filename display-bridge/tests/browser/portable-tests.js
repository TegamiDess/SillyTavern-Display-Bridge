import {sceneControls,sceneSnapshot,suffix,neutralWav} from '/extension/tests/fixtures/scene-controls.js';
import {discoverProfile,portraitVersion} from '/extension/core/profiles.js';
import {styledRule,afternoonStyles} from './presentation-style-fixture.js';
import {communityRule,communityMessage} from './presentation-fixtures.js';
import {sceneRules,sceneMessage} from './scene-fixture.js';
import {canonical} from './recovery.js';
import {sceneImportCard} from '/extension/tests/fixtures/scene-import.js';

export async function runPortableTests({test,assert,setup,native,wait,ctx,characters,extension_settings,bridge}) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=2;canvas.getContext('2d').fillRect(0,0,2,2);
    const pixel=new Uint8Array(await(await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))).arrayBuffer());
    const profile=rules=>discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:rules,backgroundHTML:afternoonStyles}},window.cssTools).profile;
    const afternoon=profile([styledRule('guide','Alex','guide')]);
    Object.assign(afternoon.adapters[0].source,{imageMappings:{guide:'curator'},variants:[{id:'coat',label:'Coat',images:{guide:'coat'}}],appearance:{allowOriginal:false,defaultVariant:'coat'}});
    afternoon.adapters[0].version=portraitVersion(afternoon.adapters[0].source);
    const families=[
        ['asset-only',{kind:'display-bridge-profile',schemaVersion:1,adapters:[]},'<img="guide">'],
        ['Afternoon',afternoon,'<guide>"Ohayou!" (Good morning!)</guide>'],
        ['Community',profile([communityRule]),communityMessage],
        ['Witchcure',{kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'witchcure',version:1,source:await(await fetch('./witchcure-fixture.json')).json()}]},'[명부]'],
        ['streamer',{kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'media-panel',version:1}]},'[Assets:guide|Chat:<p><span>Alex</span><span>Hello</span></p>|Time:18:00|AkaChat:Ready]'],
        ['assembled scene',profile(sceneRules('four')),sceneMessage('four')],
    ];
    async function transport(run) {
        const start=characters.length,files=new Map();let next=0,confirm=()=>true,writes=0;
        const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
        window.fixtureImport={confirm:message=>confirm(message),drop:async inputs=>{
            const zip=await JSZip.loadAsync(await inputs[0].arrayBuffer()),card=JSON.parse(await zip.file('card.json').async('string'));
            characters.push({avatar:'portable-'+crypto.randomUUID()+'.png',create_date:new Date().toISOString(),name:card.data.name,data:card.data});
        },fetch:async(url,options)=>{
            const body=options?.body?JSON.parse(options.body):{},character=characters.find(c=>c.avatar===(body.avatar_url??body.avatar));
            if(url==='/api/characters/get')return response(character);
            if(url==='/api/characters/export')return new Response(pixel,{headers:{'Content-Type':'image/png'}});
            if(url==='/api/images/folders')return response([]);
            if(url==='/api/files/sanitize-filename')return response({fileName:body.fileName});
            if(url==='/api/files/upload'){writes++;const path='/user/files/'+(body.name.startsWith('v3recovery-')?body.name:'portable-'+(++next)+'.'+body.name.split('.').at(-1));files.set(path,Uint8Array.from(atob(body.data),c=>c.charCodeAt(0)));return response({path:path.slice(1)});}
            if(url==='/api/images/upload'){writes++;const path='/user/images/'+body.ch_name+'/'+body.filename;files.set(path,Uint8Array.from(atob(body.image),c=>c.charCodeAt(0)));return response({path:path.slice(1)});}
            if(url==='/api/files/verify')return response(Object.fromEntries(body.urls.map(path=>[path,files.has('/'+path.replace(/^\//,''))])));
            if(url==='/api/characters/merge-attributes'){writes++;if(body.data.assets)character.data.assets=body.data.assets;Object.assign(character.data.extensions,body.data.extensions);return response({});}
            if(files.has(decodeURIComponent(url)))return new Response(files.get(decodeURIComponent(url)));
            if(String(url).startsWith('/api/'))throw Error('Unexpected export/import request '+url);
            return globalThis.fetch(url,options);
        }};
        try {await run({select:avatar=>{ctx.characterId=characters.findIndex(c=>c.avatar===avatar);bridge().render();},setConfirm:fn=>{confirm=fn;},writes:()=>writes,files});}
        finally{delete window.fixtureImport;characters.splice(start);ctx.characterId=0;bridge().render();}
    }
    async function inputFile(name,definition,message) {
        const names=['guide','curator','coat','guide-smile','curator-smile','observatory','MS_Quiet_Reader.webp'];
        const card={spec:'chara_card_v3',spec_version:'3.0',data:{name,description:'Neutral description',first_mes:message,creator:'Fixture author',alternate_greetings:['Another greeting'],group_only_greetings:['Group greeting'],character_book:{entries:[]},assets:names.map((name,i)=>({type:'image',name,ext:'png',uri:`embeded://assets/${i}.png`})),extensions:{display_bridge_profile:definition,regex_scripts:[{id:'unrelated',scriptName:'Unrelated',findRegex:'/never-match/g',replaceString:'ordinary',disabled:true}]}}};
        if(!definition.adapters.length)delete card.data.extensions.display_bridge_profile;
        const zip=new JSZip();zip.file('card.json',JSON.stringify(card));names.forEach((_,i)=>zip.file(`assets/${i}.png`,pixel));return new File([await zip.generateAsync({type:'uint8array'})],name+'.charx');
    }
    await test('Mixed image/audio CHARX imports, exports and reimports local tracks with exact bytes and portable scene controls',async()=>{
        setup('',{stream:false});await transport(async({select,files})=>{
            const scene=families.find(([,p])=>p.adapters.some(a=>a.source?.format?.kind==='scene-fragments'));assert(scene,'Scene fixture missing');
            const definition=structuredClone(scene[1]),adapter=definition.adapters.find(a=>a.id==='portrait-dialogue');adapter.version=7;adapter.source.sceneControls=structuredClone(sceneControls);adapter.source.sceneControls.music.tracks=adapter.source.sceneControls.music.tracks.slice(0,1);
            const input=await inputFile('Audio scene',definition,scene[2]+suffix(sceneSnapshot)),zip=await JSZip.loadAsync(await input.arrayBuffer()),card=JSON.parse(await zip.file('card.json').async('string')),wav=neutralWav();card.data.assets.push({type:'x-risu-asset',name:'evening-chime',ext:'wav',uri:'embeded://assets/chime.wav'});zip.file('assets/chime.wav',wav);zip.file('card.json',JSON.stringify(card));
            const first=await window.v3sprites.import(new File([await zip.generateAsync({type:'uint8array'})],'audio.charx'));assert(first);select(first.avatar);const audio=window.v3sprites.api.resolveAudio({avatar:first.avatar,reference:'evening-chime'});assert(audio.status==='resolved'&&audio.url.endsWith('.wav')&&decodeURIComponent(audio.url).startsWith('/user/images/V3 - Audio scene - '));assert(window.v3sprites.api.resolveImage({avatar:first.avatar,reference:'evening-chime'}).status==='missing','Audio entered image resolver');
            const exported=await window.v3sprites.exportCard(first.avatar,{download:false});assert(exported.audio===1&&exported.incomplete.length===0);const packed=await JSZip.loadAsync(await exported.file.arrayBuffer()),result=JSON.parse(await packed.file('card.json').async('string')),track=result.data.assets.find(a=>a.name==='evening-chime');assert(track.ext==='wav'&&track.type==='x-risu-asset');assert(canonical([...await packed.file(track.uri.slice(10)).async('uint8array')])===canonical([...wav]));
            const second=await window.v3sprites.import(exported.file);assert(second);select(second.avatar);assert(window.v3sprites.api.resolveAudio({avatar:second.avatar,reference:'evening-chime'}).url.split('/')[3]!==audio.url.split('/')[3],'Same-named cards share an asset folder');assert(window.v3sprites.api.resolveAudio({avatar:second.avatar,reference:'evening-chime'}).status==='resolved');assert(bridge().api.exportProfile(second.avatar).adapters[0].source.sceneControls.music.tracks[0].asset==='evening-chime');
            const again=await window.v3sprites.exportCard(second.avatar,{download:false});assert(again.audio===1&&again.incomplete.length===0);
            const before=window.v3sprites.api.resolveAudio({avatar:second.avatar,reference:'evening-chime'}).url;
            const repaired=await window.v3sprites.recovery.repairFile(exported.file,second.avatar);assert(repaired?.repaired,'Mixed-media repair failed');const after=window.v3sprites.api.resolveAudio({avatar:second.avatar,reference:'evening-chime'}).url;assert(after!==before&&canonical([...files.get(decodeURIComponent(after))])===canonical([...wav]),'Audio repair did not use isolated exact bytes');
            await window.v3sprites.recovery.undo({avatar:second.avatar});const restored=window.v3sprites.api.resolveAudio({avatar:second.avatar,reference:'evening-chime'}).url;assert(restored!==after&&canonical([...files.get(decodeURIComponent(restored))])===canonical([...wav]),'Audio rollback did not restore exact bytes');
        });
    });
    await test('Source-only scene CHARX automatically assembles v9, exports, reimports and repairs without losing mappings or state defaults',async()=>{
        setup('',{stream:false});await transport(async({select})=>{
            const card=sceneImportCard(),zip=new JSZip();
            for(const [i,a]of card.data.assets.entries()){const path='assets/source-'+i+'.'+a.ext;a.uri='embeded://'+path;zip.file(path,a.ext==='wav'?neutralWav():pixel);}
            zip.file('card.json',JSON.stringify(card));const input=new File([await zip.generateAsync({type:'uint8array'})],'source-scene.charx');
            const first=await window.v3sprites.import(input);assert(first);select(first.avatar);
            const definition=bridge().exportProfile(first.avatar);assert(definition.adapters[0].version===9,'Automatic state assembly absent');
            const report=bridge().compatibilityReport?.(first.avatar);if(report)assert(report.discovery.sceneAssembly.every(c=>c.status==='ready'));
            definition.adapters[0].source.imageMappings={guide:'curator'};bridge().importProfile(first.avatar,definition);bridge().applyPending(first.avatar);
            const exported=await window.v3sprites.exportCard(first.avatar,{download:false});assert(exported.incomplete.length===0&&exported.audio===2);
            const second=await window.v3sprites.import(exported.file);assert(second);select(second.avatar);assert(canonical(bridge().exportProfile(second.avatar))===canonical(definition));
            assert(window.v3sprites.api.resolveAudio({avatar:second.avatar,reference:'morning-chime'}).status==='resolved');
            await window.v3sprites.recovery.repairFile(input,second.avatar);await window.v3sprites.attach(input,second.avatar);bridge().applyPending(second.avatar);assert(bridge().exportProfile(second.avatar).adapters[0].source.imageMappings.guide==='curator','Repair discarded edited mappings');
            assert(bridge().exportProfile(second.avatar).adapters[0].source.sceneState.variables.guide_p.initial===5);
        });
    });
    for(const [name,definition,message] of families)await test(`Configured CHARX round trip preserves ${name} assets, profile, rules and rendered behavior`,async()=>{
        setup('',{stream:false});
        await transport(async({select})=>{
            const first=await window.v3sprites.import(await inputFile(name,definition,message));assert(first?.mapped===7,'Initial import failed');select(first.avatar);
            const original=characters[ctx.characterId],rules=original.data.extensions.regex_scripts,disabled=rules.find(r=>r.id==='v3s-local-macro');disabled.disabled=true;
            const before=canonical(original),settingsBefore=canonical(bridge().api.exportProfile(first.avatar));
            const exported=await window.v3sprites.exportCard(first.avatar,{download:false});assert(exported?.file,'Export failed');assert(exported.incomplete.length===0);
            const zip=await JSZip.loadAsync(await exported.file.arrayBuffer()),card=JSON.parse(await zip.file('card.json').async('string'));
            assert(card.spec==='chara_card_v3'&&card.data.creator==='Fixture author');assert(card.data.first_mes===message&&card.data.alternate_greetings.length===1&&card.data.group_only_greetings.length===1);
            assert(card.data.assets.length===8&&card.data.assets.filter(a=>a.type==='icon'&&a.name==='main').length===1,'Avatar or asset entries duplicated');
            assert(card.data.assets.filter(a=>a.type==='x-risu-asset').length===7,'Named images would not enter the Risu asset library');
            assert(Object.values(zip.files).filter(f=>!f.dir&&f.name.startsWith('assets/')).length===8,'Image bytes bundled more than once');
            assert(!JSON.stringify(card).includes('V3ASSETREF_')&&!JSON.stringify(card).includes('/user/files/'),'Local bindings leaked');
            assert(card.data.extensions.regex_scripts.length===1&&card.data.extensions.regex_scripts[0].id==='unrelated');
            assert(card.data.extensions.v3_asset_sprites.rules.find(r=>r.id===disabled.id).disabled);
            for(const asset of card.data.assets.filter(a=>a.type!=='icon'))assert(canonical([...await zip.file(asset.uri.slice(10)).async('uint8array')])===canonical([...pixel]),'Asset bytes changed');
            assert(canonical(original)===before&&canonical(bridge().api.exportProfile(first.avatar))===settingsBefore,'Export changed source');
            const second=await window.v3sprites.import(exported.file);assert(second?.mapped===7,'Fresh import failed');select(second.avatar);
            assert(canonical(bridge().api.exportProfile(second.avatar))===settingsBefore,'Profile/defaults changed');
            const secondRules=characters[ctx.characterId].data.extensions.regex_scripts;
            assert(secondRules.find(r=>r.id===disabled.id).disabled,'Disabled choice lost');assert(!extension_settings.character_allowed_regex.includes(second.avatar),'Permission transferred');
            assert(secondRules.find(r=>r.id===disabled.id).replaceString!==disabled.replaceString,'Local marker reused');
            const count=secondRules.length;await window.v3sprites.recovery.resync({avatar:second.avatar});assert(characters[ctx.characterId].data.extensions.regex_scripts.length===count,'Rescan duplicated rules');
            native(message);bridge().render();await wait();
            if(definition.adapters.length)assert(document.querySelector('#chat .display-bridge-widget'),'UI did not render after round trip');
            const again=await window.v3sprites.exportCard(second.avatar,{download:false});assert(again?.file);const zip2=await JSZip.loadAsync(await again.file.arrayBuffer()),card2=JSON.parse(await zip2.file('card.json').async('string'));
            assert(canonical(card2)===canonical(card),'Export/import/export changed portable card');
        });
    });
    await test('Portable import rejects malformed templates before native writes; export cancellation and edited-rule failures preserve source',async()=>{
        setup('',{stream:false});await transport(async({select,setConfirm,writes})=>{
            const input=await inputFile('Failures',families[0][1],'Hello'),zip=await JSZip.loadAsync(await input.arrayBuffer()),card=JSON.parse(await zip.file('card.json').async('string'));
            card.data.extensions.v3_asset_sprites={version:1,rules:[{id:'v3s-card-0',name:'Unsafe',source:'x',flags:'g',output:'<img src="x" onerror="run()">',disabled:false}]};zip.file('card.json',JSON.stringify(card));
            const start=characters.length;assert(await window.v3sprites.import(new File([await zip.generateAsync({type:'uint8array'})],'bad.charx'))===null);assert(characters.length===start&&writes()===0,'Invalid import wrote data');
            const imported=await window.v3sprites.import(input);select(imported.avatar);const before=canonical(characters[ctx.characterId]),writesBefore=writes();
            setConfirm(()=>false);assert(await window.v3sprites.exportCard(imported.avatar,{download:false})===null);assert(canonical(characters[ctx.characterId])===before&&writes()===writesBefore);
            setConfirm(()=>true);characters[ctx.characterId].data.extensions.regex_scripts.find(r=>r.id==='v3s-local-tag').replaceString='Edited';assert(await window.v3sprites.exportCard(imported.avatar,{download:false})===null,'Edited rule was silently replaced');
        });
    });
    await test('Missing assets require explicit incomplete export and unsafe mapping paths are never fetched',async()=>{
        setup('',{stream:false});await transport(async({select,setConfirm})=>{
            const imported=await window.v3sprites.import(await inputFile('Missing',families[0][1],'Hello'));select(imported.avatar);
            extension_settings.v3_asset_sprites.extracted[imported.avatar].guide.path='https://example.invalid/private.png';
            let warned=false;setConfirm(text=>{warned=text.includes('INCOMPLETE');return false;});assert(await window.v3sprites.exportCard(imported.avatar,{download:false})===null&&warned);
            setConfirm(()=>true);const result=await window.v3sprites.exportCard(imported.avatar,{download:false});assert(result.incomplete.some(x=>x.includes('guide'))&&result.file.name.endsWith('-incomplete.charx'));
        });
    });
    await test('An image-only configured export does not rediscover omitted UI from retained source scripts',async()=>{
        setup('',{stream:false});await transport(async({select})=>{
            const input=await inputFile('Omitted UI',afternoon,'<guide>"Hello."</guide>');
            const imported=await window.v3sprites.import(input);select(imported.avatar);
            // A retained recognisable source must not override the explicit
            // choice to export no active panel adapters.
            characters[ctx.characterId].data.extensions.risuai={customScripts:[styledRule('guide','Alex','guide')]};
            extension_settings.display_bridge.profiles[imported.avatar].adapters=[];
            const exported=await window.v3sprites.exportCard(imported.avatar,{download:false});assert(exported?.file);
            const result=await window.v3sprites.import(exported.file);assert(result.ui.status==='not-requested');
            assert(bridge().api.exportProfile(result.avatar)===null,'Omitted UI was rediscovered');
        });
    });
    await test('An explicitly empty portable rule set stays empty on import and rescan',async()=>{
        setup('',{stream:false});await transport(async({select})=>{
            const imported=await window.v3sprites.import(await inputFile('No rules',families[0][1],'Hello'));select(imported.avatar);
            characters[ctx.characterId].data.extensions.regex_scripts=[];
            const exported=await window.v3sprites.exportCard(imported.avatar,{download:false});assert(exported?.file);
            const result=await window.v3sprites.import(exported.file);select(result.avatar);
            await window.v3sprites.recovery.resync({avatar:result.avatar});
            assert(characters[ctx.characterId].data.extensions.regex_scripts.length===0,'Removed rules were recreated');
        });
    });
    await test('Changing the card during export review cancels the stale package without writes',async()=>{
        setup('',{stream:false});await transport(async({select,setConfirm,writes})=>{
            const imported=await window.v3sprites.import(await inputFile('Changed card',families[0][1],'Hello'));select(imported.avatar);const before=writes();
            setConfirm(()=>{characters[ctx.characterId].data.description='Changed during review';return true;});
            assert(await window.v3sprites.exportCard(imported.avatar,{download:false})===null,'Stale export was produced');
            assert(characters[ctx.characterId].data.description==='Changed during review'&&writes()===before,'Concurrent edit was overwritten');
        });
    });
}

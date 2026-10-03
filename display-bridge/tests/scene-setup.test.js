import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDisplaySource} from '../../v3-asset-sprites/display-handoff.js';
import {validateSceneState,initialStory,storyContext} from '../adapters/scene-state.js';
import {buildSetupCandidate} from '../adapters/scene-setup-candidate.js';
import {validateProfile,discoverProfile,portraitVersion} from '../core/profiles.js';
import {createStoryState} from '../integrations/story-state.js';
import {startupFiveFieldCard} from './fixtures/startup-five-field.js';

const field=(key,required=true)=>({key,label:key,required,unset:['unselected'],reset:key!=='name',native:true});
function state(){return {version:4,variables:{season:{type:'enum',initial:'unselected',values:['unselected','spring','winter']},name:{type:'string',initial:'Visitor',maxLength:100},first:{type:'enum',initial:'unselected',values:['unselected','Guide','Curator']},second:{type:'enum',initial:'unselected',values:['unselected','Guide','Curator']}},rules:[],setup:{version:1,title:'Observatory setup',fields:[field('season'),field('name'),field('first',false),field('second',false)],unique:[['first','second']],context:['Hello {{user}}. ',{read:'name'}, {when:[{key:'season',equals:'winter'},{key:'first',equals:'Guide'}],then:[' Bring a coat.'],else:[' Welcome.']}]}};}
const values=()=>({season:'winter',name:'Tester',first:'Guide',second:'Curator'});
function host(s=state(),metadata={}){
    const profile=discoverProfile(captureDisplaySource(startupFiveFieldCard())).profile;
    profile.adapters[0].source.sceneState=s;profile.adapters[0].version=portraitVersion(profile.adapters[0].source);
    const config=validateProfile(profile).adapters[0].source;
    const ctx={chat:[{mes:'Welcome.',is_user:false,swipes:['Welcome.'],swipe_id:0}],chatMetadata:metadata,chatId:'test',onlineStatus:'connected',saveChat:async()=>{},setExtensionPrompt:()=>{}};
    const create=()=>createStoryState({getContext:()=>ctx,scope:()=>({identity:'qa',config})});
    return {ctx,create,bridge:create(),profile,config};
}

test('Setup validates complete typed selections and finite uniqueness without inventing values',()=>{
    const s=validateSceneState(state());assert.equal(initialStory(s,values()).name,'Tester');
    for(const v of [{...values(),season:'unselected'},{...values(),first:'Guide',second:'Guide'},{...values(),name:'{{setvar::x::1}}'},{...values(),extra:'ignored'},{...values(),name:'a'.repeat(101)}])assert.throws(()=>initialStory(s,v));
    const optional=structuredClone(s);delete optional.setup.context;
    assert.doesNotThrow(()=>initialStory(optional,{...values(),first:'unselected',second:'unselected'}));
    assert.throws(()=>initialStory(s,{...values(),first:'unselected'}),/unset condition/);
    const missing=values();delete missing.name;assert.throws(()=>initialStory(s,missing));
});
test('Equality/AND templates preserve native placeholders and reject unknown or deeply nested conditions',()=>{
    const s=validateSceneState(state());assert.equal(storyContext(initialStory(s,values()),s),'Hello {{user}}. Tester Bring a coat.');
    assert.match(storyContext(initialStory(s,{...values(),season:'spring'}),s),/Welcome/);
    assert.throws(()=>storyContext({...values(),season:null},s),/unset/);
    for(const mutate of [s=>s.setup.context=[{read:'missing'}],s=>s.setup.context=['{{setvar::x::1}}'],s=>s.setup.context[2].when[0].equals=3,s=>s.setup.fields[0].native='true']){const bad=state();mutate(bad);assert.throws(()=>validateSceneState(bad));}
    const deep=state();let nodes=['end'];for(let i=0;i<10;i++)nodes=[{when:[{key:'season',equals:'winter'}],then:nodes,else:[]}];deep.setup.context=nodes;assert.throws(()=>validateSceneState(deep),/depth/);
    const large=state();large.variables.name.maxLength=4096;large.setup.context=Array.from({length:8},()=>({read:'name'}));validateSceneState(large);assert.throws(()=>initialStory(large,{...values(),name:'x'.repeat(4096)}),/rendered context too large/);
    const conflicting=state();conflicting.context={title:'Legacy',fields:[]};assert.throws(()=>validateSceneState(conflicting),/cannot combine/);
});
test('Setup fields cannot be changed by model output or derivation',()=>{
    const s=state();s.rules=[{template:'<SET_{entity}_{value}>',op:'set',targets:{season:'season'}}];assert.throws(()=>validateSceneState(s),/story output/);
});
test('Explicit initialization persists native prompt bindings and survives reload without mutating profile/source',async()=>{
    const h=host(),before=JSON.stringify(h.profile);await h.bridge.rebuild(values());
    assert.deepEqual(h.ctx.chatMetadata.variables,values());assert.equal(h.create().read().values.season,'winter');
    assert.equal(JSON.stringify(h.profile),before);assert.equal(h.ctx.chat[0].mes,'Welcome.');
    h.bridge.prepare();assert.match(h.bridge.context(),/Bring a coat/);
    const exported=validateProfile(JSON.parse(JSON.stringify(h.profile)));assert.equal(exported.adapters[0].version,12);assert.equal(exported.adapters[0].source.sceneState.variables.name.initial,'Visitor');
    exported.adapters[0].version=11;assert.throws(()=>validateProfile(exported),/version 12/);
});
test('Binding collisions and external changes fail without overwriting native variables',async()=>{
    const h=host(state(),{variables:{season:'existing'}});await assert.rejects(h.bridge.rebuild(values()),/already exists/);assert.deepEqual(h.ctx.chatMetadata,{variables:{season:'existing'}});
    const good=host();await good.bridge.rebuild(values());good.ctx.chatMetadata.variables.season='spring';assert.throws(()=>good.bridge.context(),/changed outside setup/);await assert.rejects(good.bridge.rebuild(values()),/changed outside setup/);assert.equal(good.ctx.chatMetadata.variables.season,'spring');
    let aborted=false;assert.throws(()=>good.bridge.intercept([...good.ctx.chat],0,()=>aborted=true),/changed outside setup/);assert.ok(aborted,'Host interceptor must abort even if a prior event swallowed the warning');
});
test('Native string coercion cannot silently change a selected identifier',async()=>{
    const h=host();await assert.rejects(h.bridge.rebuild({...values(),name:'001'}),/coercion/);assert.deepEqual(h.ctx.chatMetadata,{});
});
test('Failed save rolls back bindings and journal; failed generation does not change selected setup',async()=>{
    const h=host();h.ctx.saveChat=async()=>{throw Error('disk failure');};await assert.rejects(h.bridge.rebuild(values()),/disk failure/);assert.deepEqual(h.ctx.chatMetadata,{});
    h.ctx.saveChat=async()=>{};await h.bridge.rebuild(values());const saved=JSON.stringify(h.ctx.chatMetadata);h.bridge.begin('swipe',{},false);h.bridge.cancel();h.bridge.end();assert.equal(JSON.stringify(h.ctx.chatMetadata),saved);
    h.ctx.chat.push({mes:'Hello',is_user:true});await assert.rejects(h.bridge.rebuild({...values(),season:'spring'}),/fresh chat/);assert.equal(JSON.stringify(h.ctx.chatMetadata),saved);
});
test('No-adapter and explicit unrelated profiles report unresolved prompt dependencies',()=>{
    const source=captureDisplaySource({data:{description:'{{getvar::season}}'}});const r=discoverProfile(source);assert.equal(r.profile,null);assert.equal(r.requiresReview,true);assert.ok(r.discovery.sceneAssembly.some(x=>x.feature==='Startup / prompt macros'));
    source.profile={kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'gallery',version:1}]};assert.equal(discoverProfile(source).requiresReview,true);
});
test('Action source preserves bounded named actions and extraction/input metadata as inert data',()=>{
    const card={data:{extensions:{risuai:{triggerscript:[{comment:'choose',type:'manual',effect:[{type:'v2ExtractRegex',regex:'(a+)+',regexType:'value',flags:'g',flagsType:'value',result:'$1',resultType:'value',sourceType:'var',role:'user',display:'Choose',displayType:'value'}]}]}}}};
    const captured=captureDisplaySource(card);assert.equal(captured.actionSourceVersion,1);assert.equal(captured.risuai.triggerscript[0].comment,'choose');assert.deepEqual(captured.risuai.triggerscript[0].effect,card.data.extensions.risuai.triggerscript[0].effect);
    card.data.extensions.risuai.triggerscript[0].effect[0].display='x'.repeat(30001);assert.throws(()=>captureDisplaySource(card),/metadata/);
});
test('Literal setup candidates require review and reject old handoffs or unsupported source syntax',()=>{
    const card=startupFiveFieldCard();card.data.description='{{getvar::season}}';const src=captureDisplaySource(card);
    const result=buildSetupCandidate(src,{unset:['unselected'],required:['season']});assert.ok(result.requiresReview);assert.deepEqual(result.state.variables.season.values,['unselected','spring']);
    delete src.actionSourceVersion;assert.throws(()=>buildSetupCandidate(src),/Reattach/);
});

function screenHost(){
    const s=state();s.setup.screen={marker:'Welcome.',description:'Choose a season and your name.',greeting:['Ready for ',{read:'name'},'. ',{when:[{key:'season',equals:'winter'}],then:['A winter visit.'],else:['A spring visit.']}]};
    return host(s);
}
test('Startup commits only the selected greeting and prompt bindings, then survives reload and export',async()=>{
    const h=screenHost(),profile=JSON.stringify(h.profile);await h.bridge.startSetup(values());
    assert.equal(h.ctx.chat[0].mes,'Ready for Tester. A winter visit.');
    assert.equal(h.ctx.chat[0].swipes[0],h.ctx.chat[0].mes);
    assert.equal(h.ctx.chat.length,1,'Start must not send or impersonate a message');
    assert.equal(h.create().read().issue,null);assert.equal(h.create().read().values.name,'Tester');
    assert.equal(JSON.stringify(h.profile),profile);assert.ok(!h.ctx.chat[0].mes.includes('spring'));
    await assert.rejects(h.bridge.startSetup(values()),/exact menu marker/);
    await h.bridge.rebuild({...values(),season:'spring'});assert.match(h.ctx.chat[0].mes,/spring visit/);
});
test('Startup save failure rolls back the complete greeting and bindings; retry succeeds',async()=>{
    const h=screenHost(),before=JSON.stringify(h.ctx.chat);
    h.ctx.saveChat=async()=>{throw Error('disk failure');};
    await assert.rejects(h.bridge.startSetup(values()),/disk failure/);
    assert.equal(JSON.stringify(h.ctx.chat),before);assert.deepEqual(h.ctx.chatMetadata,{});
    h.ctx.saveChat=async()=>{};await h.bridge.startSetup(values());assert.equal(h.bridge.read().issue,null);
});
test('Startup refuses wrong greeting, pending swipe, extra display, established chat and missing choices',async()=>{
    for(const change of [h=>h.ctx.chat[0].mes='Edited greeting',h=>h.ctx.chat[0].swipe_id=1,h=>h.ctx.chat[0].extra={display_text:'Other'},h=>h.ctx.chat.push({is_user:true,mes:'Already started'})]){
        const h=screenHost();change(h);const before=JSON.stringify(h.ctx.chat);await assert.rejects(h.bridge.startSetup(values()));assert.equal(JSON.stringify(h.ctx.chat),before);assert.deepEqual(h.ctx.chatMetadata,{});
    }
    const h=screenHost();await assert.rejects(h.bridge.startSetup({...values(),season:'unselected'}),/choose/);assert.equal(h.ctx.chat[0].mes,'Welcome.');
});
test('Queued setup cannot follow the user into another chat and generation waits for persistence',async()=>{
    const h=screenHost(),operation=h.bridge.startSetup(values());h.ctx.chat=[{mes:'Other',is_user:false}];
    await assert.rejects(operation,/Chat or profile changed/);assert.deepEqual(h.ctx.chatMetadata,{});
    const g=screenHost();let release,started;const began=new Promise(r=>started=r);
    g.ctx.saveChat=()=>new Promise(r=>{release=r;started();});const pending=g.bridge.startSetup(values());await began;
    let aborted=false;assert.throws(()=>g.bridge.intercept([],0,()=>aborted=true),/finish saving/);assert.ok(aborted);
    release();await pending;assert.equal(g.bridge.read().issue,null);
});
test('Startup accepts native CRLF conversion but does not trim or match partial greetings',async()=>{
    const s=state();s.setup.screen={marker:'<setup>\n\nChoose.',description:'',greeting:['Ready.']};
    const h=host(s);h.ctx.chat[0].mes='<setup>\r\n\r\nChoose.';h.ctx.chat[0].swipes=[h.ctx.chat[0].mes];
    await h.bridge.startSetup(values());assert.equal(h.ctx.chat[0].mes,'Ready.');
    for(const source of ['<setup>\n\nChoose. ','Prefix <setup>\n\nChoose.']){const bad=host(s);bad.ctx.chat[0].mes=source;await assert.rejects(bad.bridge.startSetup(values()),/exact menu marker/);}
    s.setup.screen.marker='<setup>\r\n\r\nChoose.';assert.doesNotThrow(()=>validateSceneState(s));
});
test('A post-save redraw failure does not undo the committed startup greeting',async()=>{
    const h=screenHost();h.ctx.reloadCurrentChat=async()=>{throw Error('redraw failed');};
    await assert.rejects(h.bridge.startSetup(values()),/redraw failed/);
    assert.match(h.ctx.chat[0].mes,/winter visit/);assert.equal(h.create().read().issue,null);
});
test('Startup schema rejects executable macros, undeclared reads and misleading empty replacements',async()=>{
    for(const screen of [{marker:'Welcome.',description:'',greeting:['{{setvar::x::1}}']},{marker:'Welcome.',description:'',greeting:['{{user}}']},{marker:'Welcome.',description:'',greeting:[{read:'missing'}]}]){
        const s=state();s.setup.screen=screen;assert.throws(()=>validateSceneState(s));
    }
    const s=state();s.setup.screen={marker:'Welcome.',description:'',greeting:['Welcome.']};const h=host(s);
    await assert.rejects(h.bridge.startSetup(values()),/replace the menu marker/);assert.deepEqual(h.ctx.chatMetadata,{});
});

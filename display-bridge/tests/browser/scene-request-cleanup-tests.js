import {behaviorSource} from '/extension/tests/fixtures/scene-behavior.js';
import {sceneMessage} from './scene-fixture.js';
import {discoverProfile} from '/extension/core/profiles.js';
import {createSceneRequestPreview} from '/extension/components/scene-request-preview.js';
import {createPresetEditor} from '/extension/components/preset-editor.js';

export async function runSceneRequestCleanupTests({test,assert,setup,native,ctx,bridge}){
 const profile=discoverProfile(behaviorSource()).profile;
 profile.adapters[0].version=19;
 const source=profile.adapters[0].source;source.sceneBehavior.cleanupOutgoing=true;
 const copy=()=>ctx.chat.filter(m=>!m.is_system).map((m,index)=>({...m,index}));
 const install=(state=false)=>{
  setup(sceneMessage(),{stream:false});ctx.chatId='request-cleanup-trial';ctx.chatMetadata={};ctx.saveChat=async()=>{};
  const p=structuredClone(profile);
  if(state)p.adapters[0].source.sceneState={version:3,variables:{score:{type:'number',initial:5,min:0,max:100}},rules:[],request:{version:1,greetingVariable:'fm',marker:'&&&',template:'Facts: score={score}'}};
  bridge().importProfile('test-a.png',p);bridge().applyPending('test-a.png');
  native(sceneMessage(),{id:1});native('Hidden annotation',{id:2,is_system:true});native('Earlier question',{id:3,is_user:true});native('Latest question',{id:4,is_user:true});
 };
 await test('Request hook cleans depth 4, retains depth 3 and preserves stored messages',()=>{
  install();const saved=JSON.stringify(ctx.chat),request=copy();bridge().interceptRequest(request,8000,()=>{throw Error('Unexpected abort');},'normal');
  assert(!request[0].mes.includes('<img')&&request[0].mes.includes('Welcome to the observatory.'),'Old scene not cleaned');
  assert(request[1].mes===ctx.chat[1].mes,'Recent scene changed');assert(JSON.stringify(ctx.chat)===saved,'Saved history changed');
  bridge().setEnabled('test-a.png',false);const disabled=copy();bridge().interceptRequest(disabled,8000,null,'normal');assert(disabled[0].mes===ctx.chat[0].mes,'Disabled bridge cleaned request');
 });
 await test('Cleanup composes with latest-user context append exactly once',async()=>{
  install(true);await bridge().story.rebuild();const saved=JSON.stringify(ctx.chat),request=copy();
  bridge().interceptRequest(request,8000,null,'normal');assert(!request[0].mes.includes('<img'),'Cleanup missing with state');
  assert(request.at(-1).mes==='Latest question\n\nFacts: score=5','Context not appended to latest user');
  assert(request.at(-2).mes==='Earlier question','Earlier user modified');
  bridge().interceptRequest(request,8000,null,'normal');assert(request.at(-1).mes==='Latest question\n\nFacts: score=5','Repeated context append');assert(JSON.stringify(ctx.chat)===saved,'Saved state/history changed during request');
 });
 await test('State validation failure aborts without partially rewriting the outgoing copy',()=>{
  install(true);const request=copy(),before=JSON.stringify(request),saved=JSON.stringify(ctx.chat);let aborted=false,failed=false;
  try{bridge().interceptRequest(request,8000,()=>aborted=true,'normal');}catch{failed=true;}
  assert(failed&&aborted,'Uninitialized state did not abort');assert(JSON.stringify(request)===before,'Failed request partly rewritten');assert(JSON.stringify(ctx.chat)===saved,'Failed request changed saved history');
 });
 await test('Cleanup preview shows before/after without modifying history or calling a model',()=>{
  install();const before=JSON.stringify(ctx.chat),preview=createSceneRequestPreview(()=>({config:source,chat:ctx.chat}));document.body.append(preview);
  preview.querySelector('button').click();assert(preview.querySelector('[role=status]').textContent.startsWith('1 older message(s), 1 scene(s) cleaned;'),'Preview count incorrect');
  const areas=preview.querySelectorAll('textarea');assert(areas[0].value.includes('<img')&&!areas[1].value.includes('<img'),'Preview mismatch');assert(areas[1].value.includes('Welcome to the observatory.'),'Preview lost dialogue');assert(JSON.stringify(ctx.chat)===before,'Preview changed history');preview.remove();
 });
 await test('Editor requires a finite depth for outgoing cleanup and exports the explicit option',()=>{
  let draft;const editor=createPresetEditor({source,sample:sceneMessage(),review:value=>draft=value,close(){}});document.body.append(editor);
  const depth=editor.querySelector('[aria-label="Maximum scene message depth"]'),toggle=editor.querySelector('[aria-label="Clean older scenes in outgoing prompts"]'),review=[...editor.querySelectorAll('button')].find(b=>b.textContent==='Review preset for this character');
  assert(toggle.checked,'Saved cleanup option not loaded');depth.value='';review.click();assert(!draft,'Unbounded cleanup was accepted');depth.value='3';review.click();assert(draft?.sceneBehavior.cleanupOutgoing===true,'Cleanup option lost');assert(JSON.stringify(draft.portraitLabels)===JSON.stringify(source.portraitLabels),'Unedited sample labels were added to profile');editor.remove();
 });
}

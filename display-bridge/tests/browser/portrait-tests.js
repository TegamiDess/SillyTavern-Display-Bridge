import { DEFAULT_PRESET } from '/extension/adapters/portrait-dialogue.js';
import { createDisplayBridge } from '/extension/core/bridge.js';
export async function runPortraitTests({test,assert,setup,native,wait,ctx,extension_settings,bridge}){
 const config=()=>({...structuredClone(DEFAULT_PRESET),variants:[{id:'coat',label:'Coat',images:{guide:'guide-coat'}}]});
 const definition=c=>({kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:1,source:c}]});
 const message='[Scene|speaker:Alex|text:The telescope is ready.|image:guide|time:18:20|day:Friday|date:2026-09-20|place:Observatory]';
 const shadow=()=>document.querySelector('.display-bridge-widget')?.shadowRoot;
 const button=text=>[...shadow().querySelectorAll('button')].find(x=>x.textContent===text);
 function apply(c=config(),text=message){const m=setup(text,{stream:false});ctx.chatId='portrait-chat';bridge().importProfile('test-a.png',definition(c));bridge().applyPending('test-a.png');bridge().render();return m;}
 await test('Portrait preset imports with typed field mappings and controls without source writes',async()=>{
  const m=apply(),before=JSON.stringify(m);assert(shadow()?.querySelector('.words').textContent==='The telescope is ready.');assert(shadow().textContent.includes('Observatory'));
  button('Portrait').click();await wait();assert(shadow().querySelector('img').hidden);button('Dialogue').click();await wait();assert(shadow().querySelector('.stage').hidden);
  button('Reset display').click();await wait();assert(!shadow().querySelector('.speech').hidden);button('Undo display change').click();await wait();assert(shadow().querySelector('.stage').hidden);
  assert(JSON.stringify(m)===before);
 });
 await test('A different JSON grammar and option list use the same renderer, keeping markup inert',async()=>{
  const c=config();c.format={kind:'json',open:'<scene>',close:'</scene>',fields:{speaker:'who',dialogue:'line',portrait:'sprite'}};c.variants.push({id:'work',label:'Work clothes',images:{guide:'work-guide'}});
  apply(c,'<scene>'+JSON.stringify({who:'Robin',line:'<img src=x onerror=alert(1)>',sprite:'guide'})+'</scene>');assert(shadow().querySelectorAll('select option').length===3);assert(shadow().querySelector('.words').textContent.includes('<img'));assert(!shadow().querySelector('.words img'));
  const select=shadow().querySelector('select');select.value='work';select.dispatchEvent(new Event('change'));await wait();assert(select.value==='work');button('Visual layout').click();await wait();assert(!shadow().querySelector('.plain').hidden);
 });
 await test('Ordinary text view inherits the surrounding chat colour instead of the panel theme',async()=>{
  apply();const outer=document.querySelector('.mes_text'),previous=outer.style.color;outer.style.color='rgb(235, 238, 245)';
  try{button('Visual layout').click();await wait();assert(getComputedStyle(shadow().querySelector('.plain')).color===getComputedStyle(outer).color,'Native text colour was overridden');button('Visual layout').click();assert(getComputedStyle(shadow().querySelector('.speech')).color==='rgb(73, 58, 34)','Custom panel theme was lost');}
  finally{outer.style.color=previous;}
 });
 await test('Dialogue visibility applies to ordinary text as well as the visual layout',async()=>{
  const m=apply(),before=m.mes;
  button('Visual layout').click();await wait();assert(!shadow().querySelector('.plain').hidden);
  button('Dialogue').click();await wait();assert(shadow().querySelector('.plain').hidden,'Hidden dialogue is still visible in ordinary text mode');
  button('Dialogue').click();await wait();assert(!shadow().querySelector('.plain').hidden);
  assert(m.mes===before,'Visibility modified the saved message');
 });
 await test('Preset choices survive bridge restart, remain chat-local and reject stale controls',async()=>{
  apply();const stale=button('Portrait');stale.click();await wait();const saved=bridge().exportPreferences('test-a.png');assert(saved.schemaVersion===2);
  bridge().stop();extension_settings.display_bridge=JSON.parse(JSON.stringify(extension_settings.display_bridge));
  const replacement=createDisplayBridge({getContext:()=>ctx,extensionSettings:extension_settings,saveSettings:()=>{},cssParser:window.cssTools});window.displayBridge=replacement;replacement.start();replacement.render();assert(shadow().querySelector('img').hidden);
  ctx.chatId='other-chat';replacement.render();assert(shadow().querySelector('button').getAttribute('aria-pressed')==='true');const current=JSON.stringify(replacement.exportPreferences('test-a.png'));stale.click();assert(JSON.stringify(replacement.exportPreferences('test-a.png'))===current);replacement.stop();
 });
 await test('Streaming incomplete preset blocks stay native and completed ones render alongside prose',async()=>{
  apply(config(),message.slice(0,-1));assert(!shadow());native(message+'\n\nMore prose.');bridge().render();assert(shadow()&&document.querySelector('.mes_text').textContent.includes('More prose.'));
  const source=ctx.chat[0].mes;bridge().setEnabled('test-a.png',false);assert(!shadow()&&ctx.chat[0].mes===source);
 });
 await test('Manual preset setup previews and stages configuration without applying it silently',async()=>{
  setup(message,{stream:false});bridge().render();const find=text=>[...document.querySelectorAll('#display-bridge-settings button')].find(b=>b.textContent===text);
  find('Set up portrait and dialogue').click();const editor=document.querySelector('.db-preset-editor');assert(editor);find('Preview mapped message').click();assert(editor.querySelector('.display-bridge-widget'));find('Review preset for this character').click();assert(extension_settings.display_bridge.profiles['test-a.png'].pendingProfile);assert(!document.querySelector('.mes_text .display-bridge-widget'));find('Apply imported UI profile').click();bridge().render();assert(document.querySelector('.mes_text .display-bridge-widget'));
 });
 await test('Recovery snapshot and profile undo include portrait configuration and saved preferences',async()=>{
  apply();button('Portrait').click();await wait();const backup=bridge().api.captureRecovery('test-a.png');bridge().resetPreferences('test-a.png');bridge().api.restoreRecovery('test-a.png',backup);assert(shadow().querySelector('img').hidden);
  bridge().importProfile('test-a.png',{kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'gallery',version:1}]});bridge().applyPending('test-a.png');bridge().restorePanels('test-a.png');assert(bridge().exportProfile('test-a.png').adapters[0].id==='portrait-dialogue');
 });
}

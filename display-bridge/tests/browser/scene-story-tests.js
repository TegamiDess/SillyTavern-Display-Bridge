import {sceneStory} from '/extension/tests/fixtures/scene-story.js';
import {sceneControls} from '/extension/tests/fixtures/scene-controls.js';
import {detailedSceneRules,sceneMessage} from './scene-fixture.js';
import {discoverProfile,validateProfile,portraitVersion} from '/extension/core/profiles.js';
import {scenePlayableCard} from '/extension/tests/fixtures/scene-playable.js';
import {captureDisplaySource} from '/fixtures/display-handoff.js';
import {createPresetEditor} from '/extension/components/preset-editor.js';
export async function runSceneStoryTests({test,assert,setup,native,wait,ctx,bridge}){
 const config=()=>({...discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules()}}).profile.adapters[0].source,sceneControls:structuredClone(sceneControls),sceneState:structuredClone(sceneStory)});
 const roots=()=>[...document.querySelectorAll('#chat .display-bridge-widget')].map(h=>h.shadowRoot).filter(r=>r?.querySelector('.scene'));
 const information=()=>document.getElementById('display-bridge-chat-information')?.shadowRoot;
 let prompts;
 const install=(text=sceneMessage(),c=config())=>{const m=setup(text,{stream:false});ctx.chatId='story';ctx.chatMetadata={};ctx.saveChat=async()=>{};ctx.onlineStatus='connected';prompts={};ctx.setExtensionPrompt=(id,value)=>{prompts[id]=value;};bridge().importProfile('test-a.png',{kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:portraitVersion(c),source:c}]});bridge().applyPending('test-a.png');bridge().render();return m;};
 await test('State profile v8 round trips and the mapping editor preserves all state configuration',async()=>{
  install();const exported=bridge().exportProfile('test-a.png');assert(exported.adapters[0].version===8);assert(JSON.stringify(validateProfile(exported))===JSON.stringify(exported));const old=structuredClone(exported);old.adapters[0].version=7;let rejected=false;try{validateProfile(old);}catch{rejected=true;}assert(rejected,'Old adapter version accepted new state');
  let reviewed;const editor=createPresetEditor({source:config(),avatar:'test-a.png',review:c=>reviewed=c,close(){}});document.body.append(editor);
  try{const button=[...editor.querySelectorAll('button')].find(b=>b.textContent==='Copy form draft to JSON');button.click();const draft=JSON.parse(editor.querySelector('[aria-label="Draft preset JSON"]').value);assert(JSON.stringify(draft.sceneState)===JSON.stringify(sceneStory));}finally{editor.remove();}
 });
 await test('Scene updates commit once, populate the drawer and request context without changing stored text',async()=>{
  const m=install('<❤alex+3><MOVE_alex_Library>'+sceneMessage());const original=m.mes;assert(bridge().story.read().issue);await bridge().story.rebuild();bridge().render();await wait();
  assert(bridge().story.read().values.score===13);const r=information();assert(r.querySelector('.scene-drawer').textContent.includes('13'));assert(r.querySelector('.scene-drawer').textContent.includes('Library'));assert(!document.querySelector('.mes_text').textContent.includes('<MOVE_'));
  bridge().story.prepare();assert(prompts.display_bridge_scene_state.includes('Alex score: 13'));assert(m.mes===original);for(let i=0;i<5;i++)bridge().render();assert(bridge().story.read().values.score===13);
  const exported=JSON.stringify(bridge().exportProfile('test-a.png'));assert(!exported.includes('records')&&!exported.includes('display_bridge_story'));assert(exported.includes('"initial":10'));
 });
 await test('Multiple scenes share one current chat drawer and background-driven track bindings',async()=>{
  install('<❤alex+2>'+sceneMessage()+'<❤alex+4>'+sceneMessage('four','2').replace('src="room"','src="courtyard"'));await bridge().story.rebuild();bridge().render();await wait();const rs=roots();assert(rs.length===2);assert(rs.every(r=>!r.querySelector('.scene-drawer')));assert(information().querySelector('.scene-drawer').textContent.includes('16'));assert(bridge().story.read().values.track===null,'Explicit background stop did not persist');
 });
 await test('Untracked location tags stay out of the display without rejecting valid scene state',async()=>{
  const original='<MOVE_guest_Hall><MOVE_alex_Library><❤alex+2>'+sceneMessage(),m=install(original);await bridge().story.rebuild();bridge().render();await wait();
  assert(bridge().story.read().issue===null);assert(bridge().story.read().values.score===12);assert(bridge().story.read().values.place==='Library');
  assert(!document.querySelector('.mes_text').textContent.includes('<MOVE_'));assert(m.mes===original);assert(roots().length===1);
  bridge().story.switched();bridge().render();await wait();assert(!document.querySelector('.mes_text').textContent.includes('<MOVE_'));assert(bridge().story.read().issue===null);
 });
 await test('Side controls do not occupy chat layout and recover a failed swipe without rebuilding',async()=>{
  const m=install('<❤alex+3>'+sceneMessage());m.swipe_id=0;m.swipes=[m.mes];await bridge().story.rebuild();bridge().render();await wait();
  const dock=document.getElementById('display-bridge-chat-dock'),tray=dock.shadowRoot.querySelector('details');assert(dock.parentNode===document.body&&getComputedStyle(dock).position==='fixed');tray.open=true;
  assert(dock.contains(document.getElementById('display-bridge-chat-music')));assert(dock.contains(document.getElementById('display-bridge-chat-information')));
  const saved=JSON.stringify(ctx.chatMetadata);m.swipe_id=1;bridge().story.begin('swipe',{},false);bridge().story.end();bridge().render();await wait();assert(bridge().story.read().issue);
  m.swipe_id=0;m.mes=m.swipes[0];bridge().render();await wait();assert(!bridge().story.read().issue);assert(JSON.stringify(ctx.chatMetadata)===saved);assert(!information().textContent.includes('no accepted state'));
  const button=dock.shadowRoot.querySelector('button');assert(button.textContent==='Rebuild scene state');bridge().story.begin('normal',{},false);bridge().render();await wait();
  // The harness drives story directly rather than the host generation event.
  bridge().story.cancel();button.click();await wait();assert(dock.shadowRoot.querySelector('[role="status"]').textContent==='Scene state rebuilt.');assert(tray.open);
 });
 await test('Chat information stays open outside history during generation and updates after commit',async()=>{
  install();await bridge().story.rebuild();bridge().render();await wait();const root=information(),host=root.host;
  assert(!document.getElementById('chat').contains(host));root.querySelector('button[aria-expanded]').click();assert(!root.querySelector('.scene-drawer').hidden);
  bridge().story.begin('normal',{},false);native('<❤alex+4>'+sceneMessage(),{id:1});bridge().render();await wait();assert(information().host===host&&!information().querySelector('.scene-drawer').hidden);assert(bridge().story.read().values.score===10);
  await bridge().story.received(1,'normal');bridge().story.end();bridge().render();await wait();assert(information().host===host&&!information().querySelector('.scene-drawer').hidden);assert(information().querySelector('.scene-drawer').textContent.includes('14'));
  ctx.chatId='different-chat';ctx.chatMetadata={};bridge().story.switched();bridge().render();await wait();assert(!information().textContent.includes('Values recorded for this scene'));assert(information().querySelector('.scene-drawer').hidden,'Open drawer leaked into another chat');
 });
 await test('Output completion is required; cancelled streaming and dry runs never commit state',async()=>{
  install();await bridge().story.rebuild();const before=JSON.stringify(ctx.chatMetadata);bridge().story.begin('normal',{},true);assert(JSON.stringify(ctx.chatMetadata)===before);
  bridge().story.begin('normal',{},false);native('<❤alex+5>'+sceneMessage(),{id:1});bridge().render();assert(bridge().story.read().values.score===10);bridge().story.cancel();await bridge().story.received(1,'normal');assert(bridge().story.read().values.score===10);
  ctx.chat.pop();document.querySelector('.mes[mesid="1"]').remove();bridge().story.invalidate();bridge().story.begin('normal',{},false);native('<❤alex+5>'+sceneMessage(),{id:1});await bridge().story.received(1,'normal');bridge().story.end();bridge().render();assert(bridge().story.read().values.score===15);
 });
 await test('Reloaded state restores totals, edits report unresolved ancestry, and chat switches isolate context',async()=>{
  const m=install('<❤alex+3>'+sceneMessage());await bridge().story.rebuild();const saved=structuredClone(ctx.chatMetadata),messages=structuredClone(ctx.chat);bridge().story.switched();ctx.chat=messages;ctx.chatMetadata=structuredClone(saved);bridge().story.invalidate();assert(bridge().story.read().values.score===13);
  ctx.chat[0].mes='<❤alex+8>'+sceneMessage();bridge().story.invalidate();assert(bridge().story.read().issue);let blocked=false;try{bridge().story.prepare();}catch{blocked=true;}assert(blocked);await bridge().story.rebuild();assert(bridge().story.read().values.score===18);
  ctx.chatId='other';ctx.chatMetadata={};bridge().story.switched();assert(prompts.display_bridge_scene_state==='');assert(bridge().story.read().issue);ctx.chatId='story';ctx.chatMetadata=structuredClone(saved);bridge().story.switched();assert(bridge().story.read().issue,'Changed source incorrectly attached old state');
 });
 await test('Startup choice saves only its selected greeting and typed initial values',async()=>{
  const c=config();c.sceneState.startup={marker:'<scene-start>',choices:[{id:'library',label:'Library',text:'The library opens. '+sceneMessage(),values:{place:'Library'}},{id:'park',label:'Park',text:'The park opens. '+sceneMessage(),values:{place:'Park'}}]};install('<scene-start>',c);await bridge().story.rebuild('library');assert(ctx.chat[0].mes.startsWith('The library opens.'));assert(!ctx.chat[0].mes.includes('The park opens.'));assert(bridge().story.read().values.place==='Library');bridge().story.prepare();assert(prompts.display_bridge_scene_state.includes('Library'));
 });
 await test('Automatic context conversion renders corrected scenes and cleans only request/display copies',async()=>{
  const card=scenePlayableCard(),p=discoverProfile(captureDisplaySource(card)).profile.adapters[0].source,m=install(card.data.first_mes,p),original=m.mes;
  await bridge().story.rebuild();bridge().render();await wait();assert(roots().length===1,'Corrected scene did not render');assert(!document.querySelector('.mes_text').textContent.includes('&&&'));
  bridge().story.prepare();assert(prompts.display_bridge_scene_state.includes('score=5'));const request=[...ctx.chat];bridge().story.intercept(request,0,()=>assert(false,'Aborted'));assert(!request[0].mes.includes('{{getvar::fm}}'));assert(m.mes===original,'Saved greeting was changed');assert(bridge().exportProfile('test-a.png').adapters[0].version===10);
 });
 await test('Zero-cast greeting shows its background without an empty dialogue box or hidden narration',async()=>{
  const card=scenePlayableCard();card.data.extensions.risuai.customScripts.find(r=>r.in==='<0>').out='</div>';
  const p=discoverProfile(captureDisplaySource(card)).profile.adapters[0].source;install('<#1><img src="room"_"sky"_"weather"_"18:30"><0>\nThe observatory opens.',p);await bridge().story.rebuild();bridge().render();await wait();
  const r=roots()[0];assert(r&&r.querySelector('.speech').hidden&&r.querySelector('.text-controls').hidden);assert(document.querySelector('.mes_text').textContent.includes('The observatory opens.'));
 });
 delete ctx.saveChat;delete ctx.setExtensionPrompt;delete ctx.chatMetadata;delete ctx.onlineStatus;
}

import {sceneControls,sceneSnapshot,suffix} from '/extension/tests/fixtures/scene-controls.js';
import {detailedSceneRules,sceneMessage} from './scene-fixture.js';
import {discoverProfile} from '/extension/core/profiles.js';
import {createSceneAudio} from '/extension/core/scene-audio.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';
import {parsePortraitDialogue,portraitActions} from '/extension/adapters/portrait-dialogue.js';
import {createActionStore} from '/extension/core/actions.js';
export async function runSceneControlsTests({test,assert,setup,native,wait,ctx,bridge}){
 const config=()=>({...discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules()}}).profile.adapters[0].source,sceneControls:structuredClone(sceneControls)});
 const roots=()=>[...document.querySelectorAll('#chat .display-bridge-widget')].map(h=>h.shadowRoot).filter(r=>r?.querySelector('.scene'));
 const button=(r,t)=>[...r.querySelectorAll('button')].find(n=>n.textContent===t);
 const provider=async run=>{const old=window.v3sprites;window.v3sprites={api:{apiVersion:1,audioApiVersion:1,resolveImage:()=>({status:'resolved',url:'/user/files/picture.png'}),resolveAudio:({reference})=>reference==='evening-chime'?{status:'resolved',url:'/user/files/tone.wav'}:{status:'missing'}}};try{await run();}finally{window.v3sprites=old;}};
 const install=text=>{const msg=setup(text,{stream:false});ctx.chatId='scene-tools';bridge().importProfile('test-a.png',{kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:7,source:config()}]});bridge().applyPending('test-a.png');bridge().render();return msg;};
 await test('Scene drawers retain historical snapshots, unknown values, finite badges and keyboard dismissal',()=>provider(async()=>{
   install(sceneMessage()+suffix(sceneSnapshot)+'\n'+sceneMessage('four','2',1)+suffix({roster:[{id:'alex',score:99,location:'Library'}],track:null}));await wait();const [a,b]=roots();
   button(a,'Guide information').click();assert(!a.querySelector('.scene-drawer').hidden);assert(a.querySelector('.scene-drawer').textContent.includes('57')&&a.querySelector('.scene-drawer').textContent.includes('Unavailable'));assert(!a.querySelector('.scene-drawer').textContent.includes('99'));assert(b.querySelector('.scene-drawer').textContent.includes('99'));assert(a.querySelector('.scene-entity img').getAttribute('src').includes('/user/files/'));
   a.querySelector('.scene-drawer').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(a.querySelector('.scene-drawer').hidden&&a.activeElement===button(a,'Guide information'));assert(!a.querySelector('audio'),'Historical scene has a player');
 }));
 await test('Chat-level player survives generation and pending swipe replacement, loops and hides without unloading',()=>provider(async()=>{
   const msg=install(sceneMessage()+suffix(sceneSnapshot));await wait();const dock=document.getElementById('display-bridge-chat-music'),r=dock.shadowRoot,player=r.querySelector('audio');assert(player&&player.paused&&player.loop,'Initial paused looping player missing');assert(!document.getElementById('chat').contains(dock));assert(roots().every(r=>!r.querySelector('audio')));
   let loads=0;const load=player.load.bind(player);player.load=()=>{loads++;load();};
   ctx.eventSource.emit(ctx.eventTypes.GENERATION_STARTED,'normal',{},true);bridge().render();assert(r.querySelector('audio')===player);
   ctx.eventSource.emit(ctx.eventTypes.GENERATION_STARTED);msg.swipes=[msg.mes];msg.swipe_id=1;bridge().render();assert(r.querySelector('audio')===player&&loads===0,'Pending generation unloaded music');
   msg.swipe_id=0;ctx.eventSource.emit(ctx.eventTypes.GENERATION_ENDED);bridge().render();assert(r.querySelector('audio')===player&&loads===0,'Failed swipe reset playback');
   button(r,'Hide music').click();bridge().render();assert(r.querySelector('.player').hidden&&player.getAttribute('src'));button(r,'Show music').click();assert(!r.querySelector('.player').hidden);r.querySelector('input').click();assert(!player.loop);
   bridge().setEnabled('test-a.png',false);assert(!dock.isConnected&&!player.getAttribute('src'),'Disable retained soundtrack');
 }));
 await test('Native audio remains mounted while hidden, never preloads, and reports missing scene tracks',()=>provider(async()=>{
   setup('',{stream:false});const c=config(),data=parsePortraitDialogue(sceneMessage()+suffix(sceneSnapshot),c).blocks[0];let valid=true;
   const session=createSceneAudio(),state=createActionStore().bind(portraitActions(c),'native-audio'),widget=createPortraitDialogue(data,{avatar:'test-a.png',resolver:()=>({status:'resolved',url:'/user/files/picture.png'}),presetState:state,mediaFor:()=>({session,key:'a',canPlay:()=>valid})});document.querySelector('.mes_text').append(widget.host);widget.refresh();const r=widget.host.shadowRoot,player=r.querySelector('audio');
   assert(player?.controls&&player.preload==='none'&&player.paused&&!player.autoplay);assert(!r.querySelector('.scene-music select'),'Manual music selector remains');button(r,'Hide music').click();assert(r.querySelector('.scene-music').hidden&&session.owns('a')&&player.getAttribute('src'),'Hiding unloaded the soundtrack');button(r,'Show music').click();assert(r.querySelector('audio')===player&&player.paused);
   player.volume=.6;player.dispatchEvent(new Event('volumechange'));assert(state.read().volume===6);valid=false;widget.refresh();assert(!r.querySelector('audio')&&!session.owns('a'));valid=true;data.sceneSnapshot.track='missing';widget.refresh();assert(!r.querySelector('audio')&&r.textContent.includes('Local audio unavailable'));widget.dispose();widget.host.remove();
 }));
}

import {behaviorSource} from '/extension/tests/fixtures/scene-behavior.js';
import {sceneMessage} from './scene-fixture.js';
import {discoverProfile} from '/extension/core/profiles.js';
import {makePlan} from '/extension/core/pipeline.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';

export async function runSceneScrollTests({test,assert,setup,native,ctx,bridge,wait}){
 const profile=discoverProfile(behaviorSource()).profile,source=profile.adapters[0].source;
 const text=sceneMessage().replaceAll('"0px"','"60%"');
 const widget=()=>createPortraitDialogue(makePlan(text,{portrait:source}).items.find(i=>i.type==='portrait-dialogue'),{resolver:()=>({status:'resolved',url:'/user/files/db-history-guide.png'})});
 const opacity=w=>getComputedStyle(w.host.shadowRoot.querySelector('.cast-slot')).opacity;
 await test('Off-screen freshly mounted scenes are opaque before and after fast scrolling into view',async()=>{
  setup('',{stream:false});const spacer=document.createElement('div');spacer.style.height='200vh';const w=widget();document.querySelector('.mes_text').append(spacer,w.host);scrollTo(0,0);
  try{assert(opacity(w)==='1','Initial off-screen portrait starts transparent');await wait();assert(opacity(w)==='1','Off-screen entry is frozen transparent');w.host.scrollIntoView({block:'center'});assert(opacity(w)==='1','Scroll arrival waits for entry fade');await wait();assert(opacity(w)==='1','Scrolling replays deferred entry');}finally{w.dispose();w.host.remove();spacer.remove();}
 });
 await test('Leaving during entrance settles portraits; returning resumes breathing without a new fade',async()=>{
  setup('',{stream:false});const w=widget(),spacer=document.createElement('div');spacer.style.height='200vh';document.querySelector('.mes_text').append(w.host);w.host.scrollIntoView({block:'center'});
  try{await wait();const r=w.host.shadowRoot,article=r.querySelector('article'),slot=r.querySelector('.cast-slot');if(!matchMedia('(prefers-reduced-motion:reduce)').matches)assert(getComputedStyle(slot).animationName==='db-portrait-entry','Visible new scene lost entrance');w.host.before(spacer);scrollTo(0,0);await wait();assert(article.classList.contains('motion-paused'),'Off-screen loops kept running');assert(opacity(w)==='1','Interrupted entrance froze partway');spacer.remove();w.host.scrollIntoView({block:'center'});await wait();assert(getComputedStyle(slot).animationName==='none','Returning replays entrance');assert(!article.classList.contains('motion-paused'),'Visible breathing did not resume');}finally{w.dispose();w.host.remove();spacer.remove();}
 });
 await test('New user and assistant turns rebuild previous scenes without restarting their entrance',async()=>{
  setup(text,{stream:false});bridge().importProfile('test-a.png',profile);bridge().applyPending('test-a.png');bridge().render();
  const check=()=>{const r=document.querySelector('#chat .mes[mesid="0"] .display-bridge-widget').shadowRoot;assert(getComputedStyle(r.querySelector('.cast-slot')).animationName==='none','Prior scene restarts entrance on depth change');assert(getComputedStyle(r.querySelector('.cast-slot')).opacity==='1','Prior scene rebuilt transparent');};
  native('We continue observing.',{id:1,is_user:true});bridge().render();check();native(text,{id:2});bridge().render();check();await wait();check();
 });
}

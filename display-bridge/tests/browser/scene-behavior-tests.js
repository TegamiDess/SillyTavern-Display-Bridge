import {behaviorSource} from '/extension/tests/fixtures/scene-behavior.js';
import {sceneMessage} from './scene-fixture.js';
import {discoverProfile} from '/extension/core/profiles.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';
import {parsePortraitDialogue} from '/extension/adapters/portrait-dialogue.js';

export async function runSceneBehaviorTests({test,assert,setup,native,ctx,bridge,wait}){
 const profile=discoverProfile(behaviorSource()).profile,source=profile.adapters[0].source;
 const root=()=>document.querySelector('#chat .display-bridge-widget')?.shadowRoot;
 const install=()=>{setup(sceneMessage(),{stream:false});bridge().importProfile('test-a.png',profile);bridge().applyPending('test-a.png');bridge().render();};
 await test('Scene history counts all messages and restores artwork after deleting a later turn',async()=>{
  install();const saved=ctx.chat[0].mes;
  for(let id=1;id<=3;id++)native('Later turn '+id,{id,is_user:id!==2,is_system:id===2});bridge().render();assert(root().querySelector('.stage'),'Depth 3 must keep its scene');
  native('Fourth later turn',{id:4,is_user:true});bridge().render();assert(!root().querySelector('img')&&root().querySelector('.plain'),'Depth 4 must be dialogue only');
  assert(root().textContent.includes('Welcome to the observatory.'),'Old prose lost');assert(ctx.chat[0].mes===saved,'Stored text changed');
  ctx.chat.pop();document.querySelector('.mes[mesid="4"]').remove();bridge().render();assert(root().querySelector('.stage'),'Deletion did not restore artwork');
  native('Fourth turn restored',{id:4,is_user:true});native(saved.replace('Welcome','Edited welcome'),{id:0});bridge().render();assert(root().querySelector('.plain').textContent.includes('Edited welcome'),'Edit not reflected');
  native(saved.replace('Welcome','Alternate welcome'),{id:0,swipe_id:1,swipes:[saved,saved.replace('Welcome','Alternate welcome')]});bridge().render();assert(root().querySelector('.plain').textContent.includes('Alternate welcome'),'Swipe not reflected');
  document.querySelector('.mes[mesid="0"]').remove();native(saved,{id:0});bridge().render();assert(!root().querySelector('img'),'Loaded history used visible DOM count');
 });
 await test('Historical scenes allocate no image, media or state work',()=>{
  let calls=0;const widget=createPortraitDialogue(parsePortraitDialogue(sceneMessage(),source,[],4).blocks[0],{resolver(){calls++;},stateFor(){calls++;},mediaFor(){calls++;}});
  assert(calls===0&&widget.missingImages()===0,'Historical scene requested resources');
 });
 await test('Scene motion pauses off-screen and when portraits are hidden; period frames retain distinct colours',async()=>{
  setup('',{stream:false});const data=parsePortraitDialogue(sceneMessage().replaceAll('"0px"','"45%"'),source).blocks[0];
  const widget=createPortraitDialogue(data,{resolver:()=>({status:'resolved',url:'/user/files/db-history-guide.png'})});document.querySelector('.mes_text').append(widget.host);
  const r=widget.host.shadowRoot,article=r.querySelector('article');article.scrollIntoView({block:'center'});await wait();
  assert(!article.classList.contains('motion-paused'),'Visible motion paused');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  assert(getComputedStyle(r.querySelector('.effect')).animationName===(reduced?'none':'db-cloud-fade'),'Cloud effect not applied');
  assert(getComputedStyle(r.querySelector('.cast-slot img')).animationDelay==='1.1s','Two-person breathing stagger lost');
  const portraitButton=[...r.querySelectorAll('button')].find(b=>b.textContent==='Portrait');portraitButton.click();assert(article.classList.contains('motion-paused'),'Hidden portraits kept animation running');portraitButton.click();
  const stage=r.querySelector('.stage');stage.classList.remove('period-night');stage.classList.add('period-dusk');assert(getComputedStyle(r.querySelector('.environment-viewport')).borderTopColor==='rgb(227, 151, 64)','Dusk frame lost source colour');stage.classList.replace('period-dusk','period-night');assert(getComputedStyle(r.querySelector('.environment-viewport')).borderTopColor==='rgb(49, 94, 189)','Night frame lost source colour');
  const spacer=document.createElement('div');spacer.style.height='200vh';widget.host.before(spacer);scrollTo(0,0);await wait();assert(article.classList.contains('motion-paused'),'Off-screen animation still running');
  widget.dispose();widget.host.remove();spacer.remove();
 });
}

import {behaviorSource} from '/extension/tests/fixtures/scene-behavior.js';
import {sceneMessage,sceneRules} from './scene-fixture.js';
import {discoverProfile} from '/extension/core/profiles.js';
import {parsePortraitDialogue} from '/extension/adapters/portrait-dialogue.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';

export async function runSceneFidelityTests({test,assert,setup,wait}) {
 const source=discoverProfile(behaviorSource()).profile.adapters[0].source;
 const still={...source,sceneBehavior:{...source.sceneBehavior,portraitEntrance:false,portraitBreathing:false,cloudFade:false}};
 let widget,holder;
 const show=async(count=2,width=900,long=false)=>{
  widget?.dispose();setup('',{stream:false});holder=document.createElement('div');holder.style.width=width+'px';document.querySelector('#chat .mes_text').append(holder);
  let text=sceneMessage('four','1',count).replaceAll('"0px"','"60%"');if(long)text=text.replace('Welcome to the observatory.','A clear evening at the observatory. '.repeat(150));
  widget=createPortraitDialogue(parsePortraitDialogue(text,still).blocks[0],{resolver:(_avatar,reference)=>({status:'resolved',url:'/user/files/db-history-'+reference+'.png'})});holder.append(widget.host);
  await Promise.all([...widget.host.shadowRoot.querySelectorAll('img')].map(i=>i.decode()));await wait();return widget.host.shadowRoot;
 };
 const button=(r,label)=>[...r.querySelectorAll('button')].find(b=>b.textContent===label);
 const near=(a,b)=>Math.abs(a-b)<2;
 await test('One through four portraits retain the reviewed overlapping slot geometry',async()=>{
  const lefts=[[.2],[.18,.52],[.1,.35,.6],[.05,.25,.45,.65]];
  for(let count=1;count<=4;count++){
   const r=await show(count),cast=r.querySelector('.cast').getBoundingClientRect();
   [...r.querySelectorAll('.cast-slot')].forEach((slot,index)=>{const s=slot.getBoundingClientRect(),i=slot.querySelector('img').getBoundingClientRect();
    assert(near(s.left-cast.left,lefts[count-1][index]*cast.width),'Wrong horizontal slot '+count+'/'+index);
    assert(near(s.width,cast.width*(count===1?.6:.3)),'Wrong portrait width');assert(near(s.top-cast.top,-cast.height/12),'Wrong portrait band origin');
    assert(near(i.width,s.width*.9)&&near(i.height,s.height*.9),'Bitmap fitting box lost');
   });
  }
 });
 await test('Long dialogue, expansion and collapse preserve artwork frame height',async()=>{
  const r=await show(4,900,true),frame=r.querySelector('.environment-viewport'),before=frame.getBoundingClientRect();
  assert(Math.abs(before.width/before.height-40/21)<.01,'Frame aspect changed');
  button(r,'Expand dialogue').click();await wait();assert(near(frame.getBoundingClientRect().height,before.height),'Expanded text stretched artwork');
  assert(r.querySelector('.speech').getBoundingClientRect().top>=frame.getBoundingClientRect().bottom,'Expanded dialogue overlaps frame');
  button(r,'Collapse dialogue').click();await wait();assert(near(frame.getBoundingClientRect().height,before.height),'Collapsed text shrank artwork');
  assert(getComputedStyle(r.querySelector('.speech')).display==='none','Collapse did not hide dialogue');
 });
 await test('Narrow scenes place readable text below artwork without horizontal overflow',async()=>{
  for(const width of [320,480]){const r=await show(4,width,true),frame=r.querySelector('.environment-viewport').getBoundingClientRect(),speech=r.querySelector('.speech').getBoundingClientRect(),article=r.querySelector('article');
   assert(speech.top>=frame.bottom,'Narrow dialogue obscures portraits');assert(article.scrollWidth<=article.clientWidth+1,'Narrow scene overflows');
   assert(r.querySelector('.text-controls').getBoundingClientRect().top>=speech.bottom,'Controls overlap text');
  }
 });
 await test('Hover status stays above dialogue while portrait images stay behind it',async()=>{
  const r=await show(2),slot=r.querySelector('.cast-slot'),img=slot.querySelector('img'),b=img.getBoundingClientRect();
  img.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:b.left+b.width*.5,clientY:b.top+b.height*.6}));
  const tip=slot.querySelector('.portrait-tooltip');assert(getComputedStyle(tip).visibility==='visible','Status did not appear');
  assert(getComputedStyle(r.querySelector('.environment-viewport')).isolation==='auto','Frame traps status below dialogue');
  assert(Number(getComputedStyle(tip).zIndex)>Number(getComputedStyle(r.querySelector('.speech')).zIndex),'Status below dialogue');
  assert(Number(getComputedStyle(img).zIndex)<Number(getComputedStyle(r.querySelector('.speech')).zIndex),'Portrait raised above dialogue');
  img.dispatchEvent(new PointerEvent('pointerleave'));assert(getComputedStyle(tip).visibility==='hidden','Status stuck after leaving portrait');slot.focus();assert(r.activeElement===slot,'Keyboard focus unavailable');
 });
 await test('Hidden artwork collapses the environment while keeping dialogue',async()=>{
  const r=await show(),before=r.querySelector('.environment').getBoundingClientRect().height;button(r,'Portrait').click();await wait();
  assert(getComputedStyle(r.querySelector('.environment-viewport')).display==='none','Artwork space remains');assert(r.querySelector('.environment').getBoundingClientRect().height<before,'Environment did not collapse');
  assert(r.querySelector('.speech').getBoundingClientRect().height>0,'Dialogue disappeared');button(r,'Portrait').click();await wait();assert(near(r.querySelector('.environment').getBoundingClientRect().height,before),'Artwork did not restore');
 });
 await test('The separate reviewed frame retains its ratio, header and expanded placement',async()=>{
  widget?.dispose();setup('',{stream:false});const config=discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:sceneRules('five')}}).profile.adapters[0].source;
  config.sceneLayout={version:1,aspectRatio:[16,8.5],maxWidth:640,metadataPosition:'top'};
  widget=createPortraitDialogue(parsePortraitDialogue(sceneMessage('five'),config).blocks[0],{resolver:()=>({status:'resolved',url:'/user/files/db-history-guide.png'})});document.querySelector('#chat .mes_text').append(widget.host);await wait();
  const r=widget.host.shadowRoot,frame=r.querySelector('.scene-viewport'),b=frame.getBoundingClientRect();assert(Math.abs(b.width/b.height-16/8.5)<.01,'Reviewed frame ratio changed');assert(!r.querySelector('.environment-viewport'),'Layered frame applied to reviewed layout');assert(r.querySelector('.scene-header').textContent.includes('Observatory'),'Header lost');
  button(r,'Expand dialogue').click();await wait();assert(near(frame.getBoundingClientRect().height,b.height),'Reviewed frame stretched');assert(r.querySelector('.speech').getBoundingClientRect().top>=frame.getBoundingClientRect().bottom,'Reviewed expanded text overlays artwork');
 });
 widget?.dispose();
}

import {styledRule,afternoonStyles} from './presentation-style-fixture.js';
import {fixedRule,narrationRule,statusRule,dynamicRule,communityRule,communityMessage,afternoonMessage} from './presentation-fixtures.js';
import {captureDisplaySource} from './display-handoff.js';
import {DEFAULT_PRESET,validatePortraitPreset,parsePortraitDialogue} from '/extension/adapters/portrait-dialogue.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';
export async function runPresentationTests({test,assert,setup,native,wait,ctx,characters,bridge}){
 await test('Pending or broken alternate artwork never hides the loaded base portrait',async()=>{
  setup('',{stream:false});
  const config=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'scene',open:'<scene>',close:'</scene>'}});
  const source='<scene>'+JSON.stringify({speaker:'Alex',dialogue:'Load fallback',portraits:[{image:'base',hover:'hover'}]})+'</scene>';
  let alternate='/user/files/slow-hover.png';
  const widget=createPortraitDialogue(parsePortraitDialogue(source,config).blocks[0],{resolver:(_,ref)=>({status:'resolved',url:ref==='base'?'/user/files/picture.png':alternate})});
  document.querySelector('.mes_text').append(widget.host);
  const r=widget.host.shadowRoot,slot=r.querySelector('.cast-slot'),base=slot.querySelector('img'),hover=slot.querySelector('.hover-image');
  await base.decode();slot.focus();
  assert(!hover.complete,'Fixture alternate must still be pending');assert(getComputedStyle(base).opacity==='1','Pending alternate hid the base');
  await hover.decode();await wait();assert(getComputedStyle(base).opacity==='0','Loaded alternate did not activate');
  alternate='/missing-hover.png';widget.refresh();assert(getComputedStyle(base).opacity==='1','Changing alternate hid the base before load');
  await new Promise(resolve=>hover.addEventListener('error',resolve,{once:true}));
  assert(getComputedStyle(base).opacity==='1'&&widget.imageIssues().some(i=>i.status==='load-failed'),'Failed alternate did not preserve base and report issue');
 });
 const roots=()=>[...document.querySelectorAll('#chat .display-bridge-widget')].map(x=>x.shadowRoot).filter(Boolean);
 const envelope=(rules,styles='')=>({handoffVersion:1,avatar:'test-b.png',importId:crypto.randomUUID(),source:captureDisplaySource({data:{extensions:{risuai:{customScripts:rules,backgroundHTML:styles}}}}),images:{status:'mapped',mapped:0,issues:[]}});
 const install=(rules,text)=>{const m=setup(text,{stream:false});ctx.chatId='presentation-chat';const r=bridge().api.receiveImport(envelope(rules));assert(r.status==='applied','Recognition failed: '+JSON.stringify(r));ctx.characterId=1;bridge().render();return m;};
 await test('Common tagged source imports multiple speakers, narration and status without an explicit profile',async()=>{
  const m=install([fixedRule(),fixedRule('curator','Robin','curator'),narrationRule,statusRule],afternoonMessage);await wait();assert(roots().length===4);assert(roots().some(r=>r.querySelector('.name')?.textContent==='Robin'));assert(roots().some(r=>r.querySelector('.metadata')?.textContent.includes('Observatory')));assert(m.mes===afternoonMessage);assert(bridge().compatibility().discovery.rules.every(r=>r.status==='adapted'));
  assert(roots().filter(r=>!r.querySelector('.toolbar').hidden).length===1,'Expected one shared control bar');const r=roots().find(r=>!r.querySelector('.toolbar').hidden);[...r.querySelectorAll('button')].find(b=>b.textContent==='Portrait').click();await wait();assert(roots().filter(r=>r.querySelector('.portrait')).every(r=>r.querySelector('.portrait').hidden));const saved=bridge().exportPreferences('test-b.png');bridge().resetPreferences('test-b.png');bridge().importPreferences('test-b.png',saved);bridge().render();assert(roots().find(r=>r.querySelector('.portrait')).querySelector('.portrait').hidden);
 });
 await test('Styled Afternoon source keeps per-speaker palettes, native prose and shared controls through export and reimport',async()=>{
  const text='<narration>The observatory opens.</narration>\n<guide>"Welcome."</guide>\nOrdinary prose stays native.\n<curator>"Good evening."</curator>';
  const m=setup(text,{stream:false});ctx.chatId='styled-chat';
  const received=bridge().api.receiveImport(envelope([styledRule('guide','Alex','guide'),styledRule('curator','Robin','curator'),narrationRule],afternoonStyles));assert(received.status==='applied');ctx.characterId=1;bridge().render();await wait();
  const speakers=roots().filter(r=>r.querySelector('.portrait')),a=speakers[0],b=speakers[1];
  assert(getComputedStyle(a.querySelector('.speech')).borderColor==='rgb(65, 105, 225)');assert(getComputedStyle(b.querySelector('.speech')).borderColor==='rgb(218, 165, 32)');assert(getComputedStyle(a.querySelector('.words')).color==='rgb(0, 51, 102)');
  assert(getComputedStyle(a.querySelector('.name')).fontSize==='13px');assert(getComputedStyle(a.querySelector('.speech')).borderRadius==='25px');assert(a.querySelector('.stage').getBoundingClientRect().width<a.querySelector('article').getBoundingClientRect().width);
  const narration=roots().find(r=>r.querySelector('.narration .speech'));assert(getComputedStyle(narration.querySelector('.speech')).backgroundImage.includes('linear-gradient'));assert(getComputedStyle(narration.querySelector('.words')).fontSize==='15px');
  assert(roots().filter(r=>!r.querySelector('.toolbar').hidden).length===1);assert(document.querySelector('.mes_text').textContent.includes('Ordinary prose stays native.'));
  const before=bridge().exportProfile('test-b.png');assert(before.adapters[0].version===2);bridge().importProfile('test-b.png',before);assert(JSON.stringify(bridge().exportProfile('test-b.png'))===JSON.stringify(before));
  const bar=roots().find(r=>!r.querySelector('.toolbar').hidden);[...bar.querySelectorAll('button')].find(b=>b.textContent==='Visual layout').click();await wait();assert(speakers.every(r=>!r.querySelector('.plain').hidden));assert(getComputedStyle(a.querySelector('.plain')).color!==getComputedStyle(a.querySelector('.words')).color,'Imported ink leaked into ordinary view');assert(m.mes===text);
 });
 await test('Partial narration style preserves its distinct default surface',async()=>{
  setup('',{stream:false});const config=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'tagged',entries:[{kind:'narration',tag:'narration',style:{fontSize:18}},{kind:'dialogue',tag:'guide',speaker:'Alex',portrait:'guide'}]}});
  const widgets=parsePortraitDialogue('<narration>Evening arrives.</narration><guide>"Hello"</guide>',config).blocks.map(b=>createPortraitDialogue(b));document.querySelector('.mes_text').append(...widgets.map(w=>w.host));
  const a=getComputedStyle(widgets[0].host.shadowRoot.querySelector('.speech')),b=getComputedStyle(widgets[1].host.shadowRoot.querySelector('.speech'));assert(a.backgroundColor!==b.backgroundColor);assert(a.backgroundImage==='none');
 });
 await test('Tagged messages support complete streaming blocks, edits, recency and native restoration',async()=>{
  const m=install([fixedRule()],'<guide>"Half');assert(!roots().length);native('<guide>"Complete"</guide> trailing text');bridge().render();assert(roots().filter(r=>r.querySelector('.portrait')).length===1);assert(document.querySelector('.mes_text').textContent.includes('trailing text'));const current=m.mes;bridge().setEnabled('test-b.png',false);assert(!roots().length&&m.mes===current);bridge().setEnabled('test-b.png',true);for(let i=0;i<11;i++)ctx.chat.push({mes:'Later',is_user:true});bridge().render();assert(!roots().length,'Old recency-bound block remains visible');
 });
 await test('Tagged layout controls occur only at the bottom of the newest assistant message',async()=>{
  install([fixedRule()],'<guide>"First"</guide>\n\nProse after the panel.');const visibleBars=()=>roots().filter(r=>r.querySelector('.toolbar')&&!r.querySelector('.toolbar').hidden);
  assert(visibleBars().length===1);const first=document.querySelector('.mes_text');assert(first.lastElementChild===visibleBars()[0].host,'Controls were not moved after trailing prose');
  ctx.chat.push({mes:'User reply',is_user:true});bridge().render();assert(visibleBars().length===1,'User message incorrectly removed latest assistant controls');
  ctx.chat.push({mes:'<guide>"Second"</guide>\n\nFinal prose.',name:'Sample B',is_user:false});const mes=document.createElement('div');mes.className='mes';mes.setAttribute('mesid','2');const text=document.createElement('div');text.className='mes_text';text.textContent=ctx.chat[2].mes;mes.append(text);document.querySelector('#chat').append(mes);bridge().render();assert(visibleBars().length===1&&text.contains(visibleBars()[0].host));assert(first.querySelector('.display-bridge-widget')?.shadowRoot.querySelector('.words').textContent==='First');assert(text.lastElementChild===visibleBars()[0].host);
  ctx.chat.pop();mes.remove();bridge().render();assert(visibleBars().length===1&&first.contains(visibleBars()[0].host),'Controls did not return after deleting the newest reply');
 });
 await test('Dynamic tags and the corrected twelve-field profile map through handoff',async()=>{
  install([dynamicRule],'<Smile.1>A neutral line.</Smile.1>');assert(roots()[0].querySelector('.name').textContent==='Robin');install([communityRule],communityMessage);const r=roots()[0];assert(r.querySelector('article').getAttribute('aria-label')==='Profile notice');assert(r.querySelectorAll('dd').length===11);assert(r.textContent.includes('Book loan approved'));assert(!r.querySelector('script'));
 });
 await test('Scene preset resolves all layers, exposes keyboard hover and independent dialogue controls',async()=>{
  setup('',{stream:false});const c=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'scene',open:'<scene>',close:'</scene>'}});const data={speaker:'Alex',dialogue:'A scene with two guides.',background:'room',portraits:[{image:'guide',hover:'smile',label:'Guide'},{image:'curator',label:'Curator'}]};const calls=[];const resolver=(avatar,name)=>{calls.push(name);return {status:'resolved',url:'/user/files/picture.png'};};const block=parsePortraitDialogue('<scene>'+JSON.stringify(data)+'</scene>',c).blocks[0];const widget=createPortraitDialogue(block,{avatar:'test-a.png',resolver});document.querySelector('.mes_text').append(widget.host);const r=widget.host.shadowRoot;await Promise.all([...r.querySelectorAll('img')].map(i=>i.decode()));assert(calls.slice(0,4).join(',')==='room,guide,smile,curator');assert(r.querySelectorAll('.cast-slot').length===2);r.querySelector('.cast-slot').focus();assert(getComputedStyle(r.querySelector('.hover-image')).opacity==='1');assert(getComputedStyle(r.querySelector('.has-hover')).opacity==='0');
  const click=text=>[...r.querySelectorAll('button')].find(b=>b.textContent===text).click();click('Expand dialogue');assert(r.querySelector('.stage').classList.contains('expanded'));click('Collapse dialogue');assert(getComputedStyle(r.querySelector('.words')).display==='none');click('Show dialogue');click('Visual layout');assert(!r.querySelector('.plain').hidden);assert(widget.missingImages()===0);
 });
 await test('Source-only tagged and profile CHARX fixtures traverse asset import and UI handoff',async()=>{
  for(const [name,rules,text]of [['tags',[styledRule('guide','Alex','guide'),styledRule('curator','Robin','curator'),narrationRule,statusRule],afternoonMessage],['profile',[communityRule],communityMessage]]){
   setup('',{stream:false});const start=characters.length,avatar='presentation-'+name+'.png';const card={spec:'chara_card_v3',spec_version:'3.0',data:{name:'Neutral '+name,first_mes:text,assets:[{type:'image',name:'guide',uri:'embeded://assets/guide.png',ext:'png'}],extensions:{risuai:{customScripts:rules,backgroundHTML:name==='tags'?afternoonStyles:''}}}};const imported={name:card.data.name,avatar,data:{extensions:{regex_scripts:[]}}};let uploads=0;
   window.fixtureImport={drop:async()=>characters.push(imported),fetch:async(url,options)=>{const body=JSON.parse(options?.body??'{}'),response=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});if(url==='/api/files/sanitize-filename')return response({fileName:body.fileName});if(url==='/api/images/folders')return response([]);if(url==='/api/characters/get')return response(imported);if(url==='/api/files/upload'||url==='/api/images/upload'){uploads++;return response({path:'user/files/picture.png'});}if(String(url).startsWith('/api/'))throw Error('Unexpected API '+url);return globalThis.fetch(url,options);}};
   try{const zip=new JSZip();zip.file('card.json',JSON.stringify(card));zip.file('assets/guide.png',await(await fetch('/user/files/picture.png')).arrayBuffer());const result=await window.v3sprites.import(new File([await zip.generateAsync({type:'uint8array'})],name+'.charx'));assert(result.ui.status==='applied'&&uploads===1);assert(bridge().exportProfile(avatar).adapters[0].source.format.kind===(name==='tags'?'tagged':'community'));if(name==='tags')assert(bridge().exportProfile(avatar).adapters[0].source.format.entries[0].style.accent==='#4169e1','Archive styles lost during handoff');const inventory=window.v3sprites.api.listImages({avatar});assert(inventory.status==='available'&&inventory.images.some(i=>i.name==='guide'&&i.status==='resolved'));assert(window.v3sprites.api.listImages({avatar:'absent.png'}).status==='unavailable');}finally{delete window.fixtureImport;characters.splice(start);}
  }
 });
 await test('Narration has a distinct shade; scene dialogue is compact, translucent and still expands',async()=>{
  install([fixedRule(),narrationRule,statusRule],afternoonMessage);const narration=roots().find(r=>r.querySelector('.narration .speech'))?.querySelector('.speech'),dialogue=roots().find(r=>r.querySelector('.portrait'))?.querySelector('.speech');assert(narration&&dialogue);assert(getComputedStyle(narration).backgroundColor!==getComputedStyle(dialogue).backgroundColor,'Narration shares dialogue shade');assert(narration.getAttribute('aria-label')==='Narration');
  setup('',{stream:false});const config=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'scene',open:'<scene>',close:'</scene>'}}),source='<scene>'+JSON.stringify({speaker:'Alex',dialogue:'An ordinary long scene line. '.repeat(100),portraits:[{image:'guide'}]})+'</scene>';const widget=createPortraitDialogue(parsePortraitDialogue(source,config).blocks[0],{resolver:()=>({status:'resolved',url:'/user/files/picture.png'})});document.querySelector('.mes_text').append(widget.host);const r=widget.host.shadowRoot,words=r.querySelector('.words'),speech=r.querySelector('.speech');assert(words.clientHeight<=120&&words.scrollHeight>words.clientHeight,'Default scene text is not a compact scroll area');assert(getComputedStyle(speech).backgroundColor.includes('0.78'),'Scene background is not translucent');const click=label=>[...r.querySelectorAll('button')].find(b=>b.textContent===label).click();click('Expand dialogue');assert(words.clientHeight>120,'Expanded text did not grow');click('Expand dialogue');assert(words.clientHeight<=120);click('Collapse dialogue');assert(getComputedStyle(speech).display==='none','Collapsed dialogue box remains visible');assert(r.querySelector('.text-controls').getBoundingClientRect().height>0,'Show control vanished');click('Show dialogue');assert(getComputedStyle(speech).display!=='none');
 });
 await test('Scene dialogue controls remain pointer targets above the portrait layer',async()=>{
  setup('',{stream:false});
  const config=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'scene',open:'<scene>',close:'</scene>'}});
  const source='<scene>'+JSON.stringify({speaker:'Alex',dialogue:'Pointer routing test.',portraits:[{image:'guide'}]})+'</scene>';
  const widget=createPortraitDialogue(parsePortraitDialogue(source,config).blocks[0],{resolver:()=>({status:'resolved',url:'/user/files/picture.png'})});
  document.querySelector('.mes_text').append(widget.host);
  const r=widget.host.shadowRoot;
  for(const label of ['Collapse dialogue','Show dialogue','Expand dialogue','Collapse dialogue','Show dialogue']){
   const button=[...r.querySelectorAll('.text-controls button')].find(b=>b.textContent===label);
   button.scrollIntoView({block:'center'});await wait();
   const box=button.getBoundingClientRect(),hit=r.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
   assert(hit===button||button.contains(hit),label+' is covered by another scene layer');
   hit.click();
   assert((getComputedStyle(r.querySelector('.speech')).display==='none')===(label==='Collapse dialogue'),'Pointer target did not update dialogue visibility');
  }
 });
 await test('Scene hover targets fit the base portraits and leave empty scene space inactive',async()=>{
  setup('',{stream:false});
  const config=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'scene',open:'<scene>',close:'</scene>'}});
  const source='<scene>'+JSON.stringify({speaker:'Alex',dialogue:'Hover bounds test.',portraits:[{image:'left',hover:'left-hover'},{image:'right',hover:'right-hover'}]})+'</scene>';
  const widget=createPortraitDialogue(parsePortraitDialogue(source,config).blocks[0],{resolver:()=>({status:'resolved',url:'/user/files/picture.png'})});document.querySelector('.mes_text').append(widget.host);
  const r=widget.host.shadowRoot;[...r.querySelectorAll('button')].find(b=>b.textContent==='Dialogue').click();
  await Promise.all([...r.querySelectorAll('.cast-slot img')].map(i=>i.decode()));r.querySelector('.stage').scrollIntoView({block:'center'});await wait();
  const slots=[...r.querySelectorAll('.cast-slot')];
  for(const slot of slots){
   const base=slot.querySelector('img:not(.hover-image)'),hover=slot.querySelector('.hover-image'),box=base.getBoundingClientRect(),column=slot.getBoundingClientRect();
   assert(box.height<column.height-20,'Portrait target still fills the scene height');assert(Math.abs(box.width/box.height-base.naturalWidth/base.naturalHeight)<.01,'Target includes object-fit letterboxing');
   assert(getComputedStyle(slot).pointerEvents==='none','Layout column is still a pointer target');assert(getComputedStyle(base).pointerEvents==='auto');assert(getComputedStyle(hover).pointerEvents==='none','Hover layer can change the hit target');
   const above=r.elementFromPoint(box.left+box.width/2,column.top+5);assert(!above?.closest('.cast-slot'),'Empty space above portrait activates it');
   const onImage=r.elementFromPoint(box.left+box.width/2,box.top+box.height/2);assert(onImage?.closest('.cast-slot')===slot,'Portrait itself is not interactive');
   slot.focus();assert(getComputedStyle(hover).opacity==='1','Keyboard preview lost');assert(getComputedStyle(base).opacity==='0');assert(base.getBoundingClientRect().height===box.height,'Preview changed its target size');slot.blur();
  }
  r.querySelector('.stage').style.height='420px';document.querySelector('.mes_text').style.width='260px';await wait();
  try{for(const slot of slots){const box=slot.querySelector('.has-hover').getBoundingClientRect(),column=slot.getBoundingClientRect();assert(box.width<=column.width+1&&box.height<=column.height+1);assert(box.height<column.height-20,'Resize expanded the hover target');}}
  finally{document.querySelector('.mes_text').style.width='';}
 });
 await test('Scene pointer preview ignores transparent borders and gaps, retaining a stable base mask',async()=>{
  setup('',{stream:false});const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;const context=canvas.getContext('2d');context.fillStyle='blue';context.fillRect(35,10,30,80);context.clearRect(45,40,10,10);const baseURL=canvas.toDataURL();context.fillRect(0,0,100,100);const hoverURL=canvas.toDataURL();
  const config=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'scene',open:'<scene>',close:'</scene>'}}),source='<scene>'+JSON.stringify({speaker:'Alex',dialogue:'Alpha test',portraits:[{image:'base',hover:'hover'}]})+'</scene>';
  const widget=createPortraitDialogue(parsePortraitDialogue(source,config).blocks[0],{resolver:(_,ref)=>({status:'resolved',url:ref==='base'?baseURL:hoverURL})});document.querySelector('.mes_text').append(widget.host);const r=widget.host.shadowRoot,slot=r.querySelector('.cast-slot'),base=slot.querySelector('img:not(.hover-image)'),hover=slot.querySelector('.hover-image');await base.decode();await hover.decode();
  const move=(x,y)=>{const b=base.getBoundingClientRect();base.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:b.left+b.width*x,clientY:b.top+b.height*y,bubbles:true}));};
  move(.1,.5);assert(!slot.classList.contains('portrait-hover'),'Transparent side activated preview');move(.4,.6);assert(slot.classList.contains('portrait-hover')&&getComputedStyle(hover).opacity==='1','Opaque portrait did not activate');move(.5,.45);assert(!slot.classList.contains('portrait-hover'),'Transparent internal gap activated preview');move(.9,.5);assert(!slot.classList.contains('portrait-hover'),'Alternate image expanded the hit mask');move(.4,.6);base.dispatchEvent(new PointerEvent('pointerleave'));assert(!slot.classList.contains('portrait-hover'),'Leaving the image retained preview');slot.focus();assert(getComputedStyle(hover).opacity==='1','Alpha mask blocked keyboard access');slot.blur();
 });
}

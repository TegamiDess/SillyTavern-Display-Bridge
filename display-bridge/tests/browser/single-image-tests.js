import {singleSource,singleMessage} from '/extension/tests/fixtures/single-image.js';
import {discoverProfile} from '/extension/core/profiles.js';
import {parsePortraitDialogue} from '/extension/adapters/portrait-dialogue.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';
import {createPresetEditor} from '/extension/components/preset-editor.js';
export async function runSingleImageTests({test,assert,setup,native,ctx,bridge,wait}){
 const profile=discoverProfile(singleSource()).profile,source=profile.adapters[0].source;
 const still={...source,sceneBehavior:{...source.sceneBehavior,portraitEntrance:false,portraitBreathing:false}};
 const svg='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="150"><rect width="600" height="150" fill="#88b7a5"/><rect x="40" y="35" width="520" height="90" fill="#e8dcc0"/><text x="300" y="85" text-anchor="middle" font-size="32">Reading in the garden</text></svg>');
 let widget;
 const show=async(offset='60%')=>{widget?.dispose();setup('',{stream:false});widget=createPortraitDialogue(parsePortraitDialogue(singleMessage(offset),still).blocks[0],{resolver:()=>({status:'resolved',url:svg})});document.querySelector('#chat .mes_text').append(widget.host);await Promise.all([...widget.host.shadowRoot.querySelectorAll('img')].map(i=>i.decode()));await wait();return widget.host.shadowRoot;};
 await test('Single portrait fits a centered 74% box, with no hover image or click/audio handler',async()=>{
  const r=await show(),cast=r.querySelector('.cast'),slot=r.querySelector('.single-image'),img=slot.querySelector('img');const c=cast.getBoundingClientRect(),i=img.getBoundingClientRect();
  assert(Math.abs(i.width/c.width-.74)<.02&&Math.abs(i.height/c.height-.74)<.02,'Wrong single-image dimensions');assert(Math.abs((i.left+i.width/2)-(c.left+c.width/2))<2,'Portrait not centered');assert(getComputedStyle(cast).overflow==='hidden','Frame clipping lost');assert(!r.querySelector('.hover-image')&&slot.querySelectorAll('img').length===1,'Invented hover image');assert(!r.querySelector('audio,input[type=radio]'),'Interaction handler imported');
  // Compare the settled geometry against the reviewed source CSS, rendered
  // independently with the same neutral asset and a matching containing box.
  const ref=document.createElement('div');ref.style.cssText=`position:relative;width:${c.width}px;height:${c.height}px;overflow:hidden`;const expected=document.createElement('img');expected.src=svg;expected.style.cssText='position:absolute;left:50%;top:60%;width:74%;height:74%;object-fit:contain;transform:translate(-50%,-50%)';ref.append(expected);document.body.append(ref);await expected.decode();const e=expected.getBoundingClientRect(),b=ref.getBoundingClientRect();assert(Math.abs(e.width-i.width)<2&&Math.abs(e.height-i.height)<2,'Source dimensions differ');assert(Math.abs((e.top-b.top)-(i.top-c.top))<5,'Source vertical offset differs');ref.remove();
 });
 await test('Wide portrait letterbox is not a pointer target; bitmap hover and keyboard focus remain usable',async()=>{
  const r=await show(),slot=r.querySelector('.single-image'),img=slot.querySelector('img');const b=img.getBoundingClientRect();
  img.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:b.left+b.width/2,clientY:b.top+2}));assert(!slot.classList.contains('portrait-hover'),'Blank contain margin activated hover');
  img.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:b.left+b.width/2,clientY:b.top+b.height/2}));assert(slot.classList.contains('portrait-hover'),'Visible bitmap missed');img.dispatchEvent(new PointerEvent('pointerleave'));slot.focus();assert(r.activeElement===slot,'Keyboard target lost');
 });
 await test('Offset outside the frame clips cleanly; missing artwork retains dialogue',async()=>{
  const r=await show('95%'),cast=r.querySelector('.cast'),img=r.querySelector('.single-image img');assert(img.getBoundingClientRect().bottom>cast.getBoundingClientRect().bottom,'Offset was clamped to ordinary portrait placement');assert(getComputedStyle(cast).overflow==='hidden','Oversized placement leaks');widget.dispose();widget.host.remove();
  widget=createPortraitDialogue(parsePortraitDialogue(singleMessage(),source).blocks[0],{resolver:()=>({status:'missing'})});document.querySelector('#chat .mes_text').append(widget.host);assert(widget.missingImages()>0,'Missing asset not reported');assert(widget.host.shadowRoot.textContent.includes('Welcome to the observatory.'),'Missing image removed dialogue');
 });
 await test('Native bridge preserves special scenes across old-history cleanup, edit and swipe',()=>{
  widget?.dispose();setup(singleMessage(),{stream:false});bridge().importProfile('test-a.png',profile);bridge().applyPending('test-a.png');bridge().render();let root=()=>document.querySelector('#chat .display-bridge-widget')?.shadowRoot;assert(root()?.querySelector('.single-image'),'Bridge did not render single image');
  for(let id=1;id<=4;id++)native('Later message '+id,{id,is_user:true});bridge().render();assert(root().querySelector('.plain')&&!root().querySelector('img'),'Old scene allocated images');
  ctx.chat.pop();document.querySelector('.mes[mesid="4"]').remove();native(singleMessage('40%'),{id:0,swipe_id:1});bridge().render();assert(root().querySelector('.single-image').style.getPropertyValue('--single-top')==='40%','Swipe did not restore revised layout');
 });
 await test('Single-image editor round-trips dimensions and can turn the contract off',()=>{
  let draft;const e=createPresetEditor({source,sample:singleMessage(),review:v=>draft=v,close(){}});document.body.append(e);const review=[...e.querySelectorAll('button')].find(b=>b.textContent==='Review preset for this character');
  e.querySelector('[aria-label="Single-image width (%)"]').value='80';review.click();assert(draft?.format.singleImage.width===80,'Edited width lost');e.querySelector('[aria-label="Enable single-image offset layout"]').checked=false;review.click();assert(draft.format.singleImage===undefined,'Disabled contract retained');e.remove();
 });
 widget?.dispose();
}

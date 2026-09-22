import { createImageViewer } from '/extension/components/image-viewer.js';
export async function runImageViewerTests({test,assert,setup,wait}){
 const image=()=>{const span=document.createElement('span');span.className='v3as-result';const img=document.createElement('img');img.className='v3as-image';img.alt='Neutral test portrait';img.src='/user/files/picture.png';span.append(img);return {span,img};};
 const root=()=>document.querySelector('.mes_text');
 const overlay=()=>document.querySelector('.db-image-viewer');
 const hold=()=>new Promise(r=>setTimeout(r,240));
 await test('Saved-chat redraw rebinds copied thumbnails without requiring a swipe',async()=>{
  setup('Neutral text',{stream:false});const source=image();root().append(source.span);const viewer=createImageViewer({enabled:()=>true,scope:()=> 'a'});
  try{viewer.refresh();root().innerHTML=root().innerHTML;await wait();const button=root().querySelector('.db-image-thumbnail');button.click();assert(button.getAttribute('aria-expanded')==='true','Copied thumbnail lost its click handler');button.click();button.focus();assert(overlay()&&!overlay().hidden,'Copied thumbnail lost its preview handler');}
  finally{viewer.stop();}
 });
 await test('Bare local and provider-resolved images compact on arrival, including late class assignment',async()=>{
  setup('Neutral text',{stream:false});const viewer=createImageViewer({enabled:()=>true,scope:()=> 'a'});
  try{viewer.refresh();const bare=document.createElement('img');bare.src='/user/files/picture.png';bare.style.cssText='width:900px;height:700px;max-width:100%';root().append(bare);await wait();assert(bare.parentElement.matches('.db-image-thumbnail'),'Bare imported image stayed full size');await bare.decode();assert(bare.getBoundingClientRect().width<=160&&bare.getBoundingClientRect().height<=180,'Source dimensions defeat thumbnail limits');bare.parentElement.click();assert(bare.parentElement.getAttribute('aria-expanded')==='true');
   const late=document.createElement('img');late.src='/user/files/other.png';const link=document.createElement('a');link.append(late);root().append(link);await wait();assert(late.parentElement===link,'Linked image was taken over');
   const provider=document.createElement('img');provider.src='pending-asset';root().append(provider);await wait();provider.className='v3as-image';provider.src='/user/files/picture.png';await wait();assert(provider.parentElement.matches('.db-image-thumbnail'),'Provider image without result wrapper was skipped');
  }finally{viewer.stop();}
 });
 await test('Replacing an image inside a managed thumbnail keeps the new image and removes stale handlers',async()=>{
  setup('Neutral text',{stream:false});const source=image();root().append(source.span);const viewer=createImageViewer({enabled:()=>true,scope:()=> 'a'});
  try{viewer.refresh();const old=source.img.parentElement,next=document.createElement('img');next.src='/user/files/other.png';old.replaceChildren(next);await wait();assert(root().contains(next)&&!root().contains(source.img),'Cleanup resurrected a stale image');assert(next.parentElement.matches('.db-image-thumbnail'));next.parentElement.click();assert(next.parentElement.getAttribute('aria-expanded')==='true');old.click();assert(old.getAttribute('aria-expanded')==='false','Detached button retained its handler');}
  finally{viewer.stop();}
 });
 await test('Compact image trial is opt-in and preserves linked images and custom panel ownership',()=>{
  setup('Neutral text',{stream:false});let enabled=false;const viewer=createImageViewer({enabled:()=>enabled,scope:()=> 'a'});
  try{const ordinary=image(),linked=image(),custom=image();const link=document.createElement('a');link.href='#';link.append(linked.span);custom.span.dataset.dbImageBehavior='card';root().append(ordinary.span,link,custom.span);
   const panel=document.createElement('span'),shadow=panel.attachShadow({mode:'open'}),inside=image();shadow.append(inside.span);root().append(panel);
   viewer.refresh();assert(!root().querySelector('.db-image-thumbnail'));enabled=true;viewer.refresh();assert(root().querySelectorAll('.db-image-thumbnail').length===1);assert(linked.img.parentNode===linked.span&&custom.img.parentNode===custom.span&&inside.img.parentNode===inside.span);
  }finally{viewer.stop();}
 });
 await test('Borderless hover leaves layout unchanged; multiple clicked images expand independently in chat',async()=>{
  setup('Neutral text',{stream:false});const first=image(),second=image();root().append(first.span,second.span);const viewer=createImageViewer({enabled:()=>true,scope:()=> 'a'});
  try{viewer.refresh();await first.img.decode();await second.img.decode();await wait();const [one,two]=root().querySelectorAll('.db-image-thumbnail'),height=root().getBoundingClientRect().height;
   one.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));await hold();assert(overlay()&&!overlay().hidden,'Hover preview did not open after layout settled');assert(overlay().shadowRoot.children.length===2,'Preview contains only style and image');assert(root().getBoundingClientRect().height===height,'Hover must not change chat layout');
   one.click();assert(overlay().hidden&&one.getAttribute('aria-expanded')==='true');assert(first.img.parentNode===one&&one.parentNode===first.span,'Expanded image stays in its original chat position');
   two.click();assert(one.getAttribute('aria-expanded')==='true'&&two.getAttribute('aria-expanded')==='true','Both images stay expanded');one.click();assert(one.getAttribute('aria-expanded')==='false'&&two.getAttribute('aria-expanded')==='true');
   two.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(two.getAttribute('aria-expanded')==='false');
  }finally{viewer.stop();}
 });
 await test('Text on either side of a thumbnail stays above and below it through expansion and collapse',async()=>{
  setup('',{stream:false});const original=image(),before=document.createElement('span'),after=document.createElement('span');before.textContent='Paragraph before the image.';after.textContent='Dialogue after the image should use the full chat width, including a long sentence that wraps naturally below the thumbnail.';root().append(before,original.span,after);original.img.style.width='460px';original.img.style.height='540px';const viewer=createImageViewer({enabled:()=>true,scope:()=> 'a'});
  try{viewer.refresh();await original.img.decode();const button=root().querySelector('.db-image-thumbnail');
   for(const width of [320,700]){root().style.width=width+'px';for(const expanded of [false,true,false]){
    if((button.getAttribute('aria-expanded')==='true')!==expanded)button.click();
    const box=button.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(after);const first=range.getClientRects()[0];assert(first.top>=box.bottom-1,'Dialogue flowed beside the thumbnail');assert(Math.abs(first.left-root().getBoundingClientRect().left)<2,'Dialogue did not return to full chat width');assert(before.getBoundingClientRect().bottom<=box.top+1,'Preceding text shared the image line');
   }}
  }finally{root().style.width='';viewer.stop();}
 });
 await test('Image expansion resets on chat switch or source change and preview closes when removed',async()=>{
  setup('Neutral text',{stream:false});let scope='a';const source=image();root().append(source.span);const viewer=createImageViewer({enabled:()=>true,scope:()=>scope});
  try{viewer.refresh();const button=root().querySelector('button');button.click();scope='b';viewer.refresh();assert(button.getAttribute('aria-expanded')==='false');button.click();source.img.src='/user/files/other.png';await source.img.decode();await wait();assert(button.getAttribute('aria-expanded')==='false');button.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));await hold();source.span.remove();await wait();assert(overlay().hidden);
  }finally{viewer.stop();}
 });
 await test('Disabling the image trial restores the same native image nodes and removes its listeners',()=>{
  setup('Neutral text',{stream:false});let enabled=true;const original=image();root().append(original.span);const viewer=createImageViewer({enabled:()=>enabled,scope:()=> 'a'});
  viewer.refresh();root().querySelector('button').click();enabled=false;viewer.refresh();assert((!overlay()||overlay().hidden)&&original.img.parentNode===original.span);assert(!root().querySelector('.db-image-thumbnail'));viewer.stop();assert(!overlay());
 });
}

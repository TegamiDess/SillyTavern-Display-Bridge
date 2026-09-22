import {DEFAULT_PRESET,parsePortraitDialogue} from '/extension/adapters/portrait-dialogue.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';
export async function runBilingualTests({test,assert,setup}){
 await test('Tagged bilingual speech defaults to translation, reveals original on hover/focus and keeps box geometry stable',()=>{
  setup('',{stream:false});const c={...DEFAULT_PRESET,format:{kind:'tagged',entries:[{kind:'dialogue',tag:'guide',speaker:'Alex',portrait:'guide',quoted:true}]}};
  const text='<guide>"Ohayou!" (Good morning! This is a longer translation to check the box height.)</guide>',data=parsePortraitDialogue(text,c).blocks[0];assert(data);
  const widget=createPortraitDialogue(data,{avatar:'test-a.png',resolver:()=>({status:'missing'})});document.querySelector('.mes_text').append(widget.host);const r=widget.host.shadowRoot,speech=r.querySelector('.speech'),words=r.querySelector('.words'),[translation,original]=words.children;
  const visible=()=>[...words.children].filter(x=>x.getAttribute('aria-hidden')==='false');assert(visible()[0]===translation);const height=speech.getBoundingClientRect().height;
  speech.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));assert(visible()[0]===original&&original.textContent==='Ohayou!');assert(speech.getBoundingClientRect().height===height);
  speech.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));assert(visible()[0]===translation);
  words.focus();assert(visible()[0]===original);words.blur();assert(visible()[0]===translation);
  speech.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'touch'}));assert(visible()[0]===translation);
  assert(r.querySelector('.plain').textContent.includes('(Good morning!'));assert(data.dialogue.includes('Ohayou!'));
  const plain=createPortraitDialogue(parsePortraitDialogue('<guide>"Mmph—!"</guide>',c).blocks[0],{resolver:()=>({status:'missing'})});assert(!plain.host.shadowRoot.querySelector('.bilingual'));
 });
}

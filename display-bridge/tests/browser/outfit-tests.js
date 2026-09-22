import {DEFAULT_PRESET,validatePortraitPreset} from '/extension/adapters/portrait-dialogue.js';
import {portraitVersion} from '/extension/core/profiles.js';
import {createPresetEditor} from '/extension/components/preset-editor.js';
export async function runOutfitTests({test,assert,setup,wait,ctx,bridge}){
 const input=(p,label)=>p.querySelector(`[aria-label="${label}"]`),click=(p,name)=>[...p.querySelectorAll('button')].find(b=>b.textContent===name).click();
 const message='<guide>Welcome.</guide>\n<curator>Hello.</curator>';
 const c=()=>validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'tagged',entries:[{kind:'dialogue',tag:'guide',speaker:'Alex',portrait:'guide-school'},{kind:'dialogue',tag:'curator',speaker:'Robin',portrait:'curator-school'}]},variants:[{id:'school',label:'School',images:{}},{id:'casual',label:'Casual',images:{'guide-school':'guide-casual','curator-school':'curator-casual'}}]});
 const profile=s=>({kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:portraitVersion(s),source:s}]});
 const roots=()=>[...document.querySelectorAll('#chat .display-bridge-widget')].map(w=>w.shadowRoot).filter(Boolean),control=()=>roots().find(r=>!r.querySelector('.toolbar').hidden);
 const old=window.v3sprites;window.v3sprites={api:{apiVersion:1,listImages:()=>({status:'available',images:[]}),resolveImage:({reference})=>({status:'resolved',url:'/user/files/'+reference+'.png'})}};
 try{
 await test('Editor presents character identities and groups all portraits in each outfit without changing original references',()=>{
  setup('',{stream:false});let staged;const editor=createPresetEditor({source:c(),avatar:'test-a.png',sample:message,review:s=>staged=s,close(){}});document.querySelector('.mes_text').append(editor);
  const rows=editor.querySelectorAll('.db-appearance-option');assert(rows.length===2);assert(rows[1].textContent.includes('Alex')&&rows[1].textContent.includes('Robin'));
  const bases=rows[1].querySelectorAll('[aria-label="Source image name"]');assert(bases[0].readOnly&&bases[0].value==='guide-school');assert(bases[1].value==='curator-school');
  const rename=input(editor,'Character label for guide-school');rename.value='Alex renamed';rename.dispatchEvent(new Event('input'));assert(rows[1].querySelector('.db-portrait-identity').textContent==='Alex renamed');
  const required=input(editor,'Always use an outfit (hide As written)');required.checked=true;required.dispatchEvent(new Event('change'));input(editor,'Default appearance').value='casual';click(editor,'Review preset for this character');
  assert(staged.appearance.defaultVariant==='casual'&&!staged.appearance.allowOriginal);assert(staged.portraitLabels['guide-school']==='Alex renamed');assert(staged.variants[0].images['guide-school']===undefined);assert(staged.variants[1].images['guide-school']==='guide-casual');assert(staged.format.entries[0].portrait==='guide-school');
  click(editor,'Copy form draft to JSON');assert(JSON.parse(input(editor,'Draft preset JSON').value).appearance.defaultVariant==='casual');
 });
 await test('Required outfit applies to both portraits, migrates old As written and survives profile export and reapply',async()=>{
  setup(message,{stream:false});ctx.chatId='required-outfit-chat';bridge().importProfile('test-a.png',profile(c()));bridge().applyPending('test-a.png');bridge().render();
  click(control(),'Portrait');await wait();const next=c();next.appearance={allowOriginal:false,defaultVariant:'casual'};bridge().importProfile('test-a.png',profile(next));bridge().applyPending('test-a.png');await wait();
  let select=control().querySelector('select');assert(select.value==='casual'&&![...select.options].some(o=>o.value==='original'));assert(roots().filter(r=>r.querySelector('.portrait')?.getAttribute('src')).every(r=>r.querySelector('.portrait').hidden));
  click(control(),'Portrait');await wait();const images=roots().map(r=>r.querySelector('.portrait')?.getAttribute('src')).filter(Boolean);assert(images.some(x=>x.endsWith('/guide-casual.png'))&&images.some(x=>x.endsWith('/curator-casual.png')));
  select=control().querySelector('select');select.value='school';select.dispatchEvent(new Event('change'));await wait();const exported=bridge().exportProfile('test-a.png');bridge().importProfile('test-a.png',exported);bridge().applyPending('test-a.png');await wait();assert(control().querySelector('select').value==='school');
  click(control(),'Reset display');await wait();assert(control().querySelector('select').value==='casual');assert(ctx.chat[0].mes===message);
 });
 await test('Editor rejects missing defaults and keeps advanced JSON separate from the form',()=>{
  setup('',{stream:false});let staged=null;const source=c();source.variants=[];const editor=createPresetEditor({source,avatar:'test-a.png',sample:message,review:s=>staged=s,close(){}});document.querySelector('.mes_text').append(editor);
  const required=input(editor,'Always use an outfit (hide As written)');required.checked=true;required.dispatchEvent(new Event('change'));click(editor,'Review preset for this character');assert(staged===null&&editor.querySelector('.db-editor-status').textContent.includes('default outfit'));
  input(editor,'Draft preset JSON').value=JSON.stringify(profile(c()));click(editor,'Review advanced JSON');assert(staged===null);
  const advanced=c();advanced.appearance={allowOriginal:false,defaultVariant:'school'};input(editor,'Draft preset JSON').value=JSON.stringify(advanced);click(editor,'Review advanced JSON');assert(staged.appearance.defaultVariant==='school');assert(editor.querySelectorAll('.db-appearance-option').length===0);
 });
 }finally{window.v3sprites=old;}
}

import {DEFAULT_PRESET,validatePortraitPreset} from '/extension/adapters/portrait-dialogue.js';
import {portraitVersion} from '/extension/core/profiles.js';
import {createPresetEditor} from '/extension/components/preset-editor.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';
import {parsePortraitDialogue} from '/extension/adapters/portrait-dialogue.js';
export async function runMappingTests({test,assert,setup,wait,ctx,extension_settings,bridge}){
 await test('Risu placement directives are classified before image-only regex compilation',()=>{
  const result=window.testBuildRules({avatar:'test-a.png',data:{extensions:{regex_scripts:[]}}},{assets:[],scripts:[{type:'editdisplay',in:'status',out:'<div>Status</div>',ableFlag:true,flag:'<move_bottom>g'}]});
  assert(result.issues.some(x=>x.includes('Risu placement/control directive')));assert(!result.issues.some(x=>x.includes('Invalid flags')));assert(!result.wanted.some(x=>x.id==='v3s-card-0'));
 });
 const def=c=>({kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'portrait-dialogue',version:portraitVersion(c),source:c}]});
 const message='[Scene|speaker:Alex|text:Welcome|image:guide|place:Observatory]';
 const config=()=>validatePortraitPreset({...DEFAULT_PRESET,imageMappings:{guide:'base'},variants:[{id:'coat',label:'Coat',images:{guide:'coat-image'}}]});
 const root=()=>document.querySelector('#chat .display-bridge-widget')?.shadowRoot;
 const settingsButton=name=>[...document.querySelectorAll('#display-bridge-settings button')].find(b=>b.textContent===name);
 const click=(parent,name)=>[...parent.querySelectorAll('button')].find(b=>b.textContent===name).click();
 const input=(parent,label)=>parent.querySelector(`[aria-label="${label}"]`);
 const provider=async run=>{const old=window.v3sprites;window.v3sprites={api:{apiVersion:1,listImages:()=>({status:'available',images:['base','coat-image','replacement'].map(name=>({name,status:'resolved'}))}),resolveImage:({reference})=>reference==='missing'?{status:'missing'}:{status:'resolved',url:'/user/files/'+encodeURIComponent(reference)+'.png'}}};try{await run();}finally{window.v3sprites=old;}};
 const apply=c=>{setup(message,{stream:false});ctx.chatId='mapping-chat';bridge().importProfile('test-a.png',def(c));bridge().applyPending('test-a.png');bridge().render();};
 await test('Mapping editor stages exact replacements and stable option IDs while preserving saved choices',()=>provider(async()=>{
  apply(config());const before=ctx.chat[0].mes;let select=root().querySelector('select');select.value='coat';select.dispatchEvent(new Event('change'));click(root(),'Portrait');await wait();
  settingsButton('Set up portrait and dialogue').click();const editor=document.querySelector('.db-preset-editor');assert(editor.querySelectorAll('datalist option').length>0);
  input(editor,'Option label').value='Everyday coat';input(editor,'Use image').value='replacement';input(editor,'Location label').value='Venue';
  click(editor,'Preview mapped message');assert(editor.querySelector('.display-bridge-widget'));assert(root().querySelector('.portrait').hidden,'Preview changed live choices');
  click(editor,'Review preset for this character');assert(bridge().exportProfile('test-a.png').adapters[0].source.imageMappings.guide==='base','Staging applied early');
  settingsButton('Apply imported UI profile').click();await wait();const source=bridge().exportProfile('test-a.png').adapters[0].source;
  assert(source.variants[0].id==='coat'&&source.variants[0].label==='Everyday coat');assert(source.imageMappings.guide==='replacement');assert(root().querySelector('select').value==='coat');assert(root().querySelector('.portrait').hidden);assert(root().querySelector('.metadata').textContent.includes('Venue'));assert(ctx.chat[0].mes===before);
  click(editor,'Review preset for this character');assert(editor.querySelector('.db-editor-status').textContent.includes('changed while'),'Applied profile did not invalidate old editor');
 }));
 await test('Missing targets require an explicit choice, duplicate references reject, and labels stay inert',()=>provider(async()=>{
  setup('',{stream:false});let reviewed=null;const editor=createPresetEditor({source:config(),avatar:'test-a.png',sample:message,review:c=>reviewed=c,close(){}});document.querySelector('.mes_text').append(editor);
  input(editor,'Use image').value='missing';click(editor,'Review preset for this character');assert(reviewed===null);assert(editor.querySelector('.db-editor-status').textContent.includes('Resolve'));
  input(editor,'Allow unresolved replacement images when staging').checked=true;input(editor,'Option label').value='<img onerror=run()>';click(editor,'Review preset for this character');assert(reviewed.imageMappings.guide==='missing');assert(!editor.querySelector('img[onerror]'));
  const mappings=editor.querySelector('fieldset');click(mappings,'Add image mapping');const rows=mappings.querySelectorAll('.db-mapping-row');input(rows[1],'Source image name').value='guide';input(rows[1],'Use image').value='replacement';const before=reviewed;click(editor,'Review preset for this character');assert(reviewed===before&&editor.querySelector('.db-editor-status').textContent.includes('Duplicate'));
 }));
 await test('Source reimport preserves mappings by default and offers an explicit replacement choice',()=>provider(async()=>{
  apply(config());const incoming=validatePortraitPreset({...DEFAULT_PRESET,theme:{...DEFAULT_PRESET.theme,accent:'#123456'}});
  const receive=()=>bridge().api.receiveImport({handoffVersion:1,avatar:'test-a.png',importId:crypto.randomUUID(),source:{sourceVersion:1,profile:def(incoming)},images:{status:'mapped',mapped:1,issues:[]}});
  assert(receive().status==='review');await wait();const check=[...document.querySelectorAll('#display-bridge-settings label')].find(l=>l.textContent.includes('Keep existing portrait mappings')).querySelector('input');assert(check.checked&&!check.parentElement.hidden);
  settingsButton('Apply imported UI profile').click();await wait();let c=bridge().exportProfile('test-a.png').adapters[0].source;assert(c.imageMappings.guide==='base'&&c.variants[0].id==='coat'&&c.theme.accent==='#123456');assert(check.parentElement.hidden&&getComputedStyle(check.parentElement).display==='none','Keep-mappings choice remained visible after apply');
  receive();await wait();check.checked=false;settingsButton('Apply imported UI profile').click();await wait();c=bridge().exportProfile('test-a.png').adapters[0].source;assert(!c.imageMappings&&!c.variants.length,'Explicit replacement still retained old mappings');
 }));
 await test('Scene/background/hover and Community image replacements resolve through the same exact mapping',()=>provider(async()=>{
  setup('',{stream:false});const scene=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'scene',open:'<scene>',close:'</scene>'},imageMappings:{guide:'base',smile:'coat-image',room:'replacement'}});
  const data='<scene>'+JSON.stringify({speaker:'Alex',dialogue:'Hello',background:'room',portraits:[{image:'guide',hover:'smile'}]})+'</scene>';const widget=createPortraitDialogue(parsePortraitDialogue(data,scene).blocks[0],{avatar:'test-a.png'});document.querySelector('.mes_text').append(widget.host);assert(widget.host.shadowRoot.querySelector('.scene-backdrop').getAttribute('src').endsWith('/replacement.png'));assert(widget.host.shadowRoot.querySelector('.hover-image').getAttribute('src').endsWith('/coat-image.png'));
  const community=validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'community'},imageMappings:{reader:'replacement'}});const card=createPortraitDialogue({config:community,presentation:'profile',portrait:'reader',speaker:'Alex',profileFields:[['Location','Library']]},{avatar:'test-a.png'});document.querySelector('.mes_text').append(card.host);assert(card.host.shadowRoot.querySelector('img').getAttribute('src').endsWith('/replacement.png'));
 }));
 await test('Recovery and previous-profile restoration retain edited mappings; removed options fall back without resetting visibility',()=>provider(async()=>{
  apply(config());const select=root().querySelector('select');select.value='coat';select.dispatchEvent(new Event('change'));click(root(),'Portrait');await wait();const snapshot=bridge().api.captureRecovery('test-a.png');
  const next=config();next.imageMappings.guide='replacement';next.variants=[];bridge().importProfile('test-a.png',def(next));bridge().applyPending('test-a.png');await wait();assert(root().querySelector('select').value==='original'&&root().querySelector('.portrait').hidden);
  bridge().restorePanels('test-a.png');await wait();assert(bridge().exportProfile('test-a.png').adapters[0].source.imageMappings.guide==='base');assert(root().querySelector('.portrait').hidden);
  bridge().api.restoreRecovery('test-a.png',snapshot);assert(root().querySelector('select').value==='coat');assert(root().querySelector('.portrait').hidden);
 }));
}

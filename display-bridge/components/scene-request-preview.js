import {projectSceneRequest} from '../adapters/scene-request-cleanup.js';

export function createSceneRequestPreview(getData){
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const host=el('details');host.append(el('summary','Outgoing scene cleanup preview'));
 host.append(el('p','Preview cleanup for a normal request without sending anything. This shows scene cleanup only; other prompt processing and appended conversation context are separate. Counts are characters, not tokens.'));
 const button=el('button','Preview older-scene cleanup');button.type='button';button.className='menu_button';
 const status=el('p');status.setAttribute('role','status');
 const samples=el('div');samples.hidden=true;
 const area=label=>{const wrap=el('label',label),text=el('textarea');text.className='text_pole';text.rows=7;text.readOnly=true;text.setAttribute('aria-label',label);wrap.append(text);samples.append(wrap);return text;};
 const before=area('Saved scene — unchanged'),after=area('Outgoing scene — cleaned');
 button.addEventListener('click',()=>{
  samples.hidden=true;before.value='';after.value='';
  try{
   const {config,chat}=getData();
   if(!config?.sceneBehavior?.cleanupOutgoing){status.textContent='Outgoing cleanup is off. Enable “Clean older scenes in outgoing prompts” in the portrait preset’s Scene history and motion settings.';return;}
   const copy=chat.filter(m=>!m.is_system).map((m,index)=>({...m,index}));
   const result=projectSceneRequest(copy,config,chat),r=result.report;
   status.textContent=`${r.messages} older message(s), ${r.scenes} scene(s) cleaned; ${r.charactersRemoved} characters removed. ${r.unrecognized} incomplete/unsupported scene(s) and ${r.unmatched} unmatched message(s) left unchanged.`;
   const index=result.messages.findIndex((m,i)=>m.mes!==copy[i].mes);
   if(index>=0){before.value=copy[index].mes.slice(0,50000);after.value=result.messages[index].mes.slice(0,50000);samples.hidden=false;status.textContent+=' First changed message shown (up to 50,000 characters per view).';}
  }catch(error){status.textContent=error.message;}
 });
 host.append(button,status,samples);return host;
}

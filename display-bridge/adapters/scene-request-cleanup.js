import {parsePortraitDialogue} from './portrait-dialogue.js';

function prose(block,config){
 const fields=['date','day','time','location'].filter(k=>block[k]).map(k=>k[0].toUpperCase()+k.slice(1)+': '+block[k]);
 let text='',speaker=null;
 for(const run of block.dialogueRuns??[{text:block.dialogue}]){
  if(!run.text.trim()){text+=run.text;if(run.text.includes('\n'))speaker=null;continue;}
  if(run.speaker!==speaker){
   if(text&&!text.endsWith('\n'))text+='\n';
   if(run.speaker)text+=(config.speakerColors?.speakers?.[run.speaker]?.label??run.speaker)+': ';
   speaker=run.speaker;
  }
  text+=run.text;
 }
 return [...(fields.length?['[Scene — '+fields.join('; ')+']']:[]),text.trim()].filter(Boolean).join('\n');
}

// Use the same bounded scene parser as display. Unknown markup, escaped
// examples, fenced code and prose outside recognized spans remain verbatim.
export function cleanSceneRequestText(text,config){
 const palette=config.speakerColors;
 const narrationTags=[...new Set([...(palette?.narrationTags??[]),...['dialogue','narration','log','plain'].filter(k=>!palette?.speakers?.[k])])];
 // Do not consume an adjacent structured state snapshot. It contains facts,
 // rather than image/layout scaffolding, and remains in the request verbatim.
 const parsing={...config,format:{...config.format,details:config.format.details??{version:1,castMetadata:false,layers:false,periodAssets:{},offsetAliases:{}}},sceneControls:undefined,speakerColors:{version:1,speakers:palette?.speakers??{},narrationTags}};
 const parsed=parsePortraitDialogue(text,parsing);
 let result=text;
 for(const block of [...parsed.blocks].reverse())result=result.slice(0,block.start)+'\n'+prose(block,config)+'\n'+result.slice(block.end);
 return {text:result,scenes:parsed.blocks.length,unrecognized:parsed.incomplete+parsed.unsupported};
}

// ST filters hidden system entries and removes the swipe target before giving
// interceptors a copy. Its `index` is in that filtered list, not saved history.
// Resolve back to the full chat; do not age a scene by the filtered list length.
function historyIndex(message,chat){
 const identity=chat.indexOf(message);if(identity>=0)return identity;
 if(message.extra&&typeof message.extra==='object'){
  const matches=chat.flatMap((m,i)=>m.extra===message.extra?[i]:[]);
  if(matches.length===1)return matches[0];
 }
 const same=m=>m.name===message.name&&!!m.is_user===!!message.is_user&&!!m.is_system===!!message.is_system&&m.send_date===message.send_date;
 if(Number.isInteger(message.index)&&message.index>=0){
  const candidates=new Set();
  for(const tools of [false,true]){
   const eligible=chat.map((m,i)=>({m,i})).filter(({m})=>!m.is_system||(tools&&Array.isArray(m.extra?.tool_invocations)));
   const value=eligible[message.index];
   if(value&&same(value.m)&&(message.send_date!=null||message.mes===value.m.mes))candidates.add(value.i);
  }
  if(candidates.size===1)return [...candidates][0];
 }
 const exact=chat.flatMap((m,i)=>same(m)&&m.mes===message.mes?[i]:[]);
 return exact.length===1?exact[0]:-1;
}

export function projectSceneRequest(messages,config,chat,{type}={}){
 const report={messages:0,scenes:0,unrecognized:0,unmatched:0,charactersRemoved:0};
 if(config?.format?.kind!=='scene-fragments'||config.sceneBehavior?.cleanupOutgoing!==true)return {messages,report};
 const limit=config.sceneBehavior.maxMessageDepth;
 if(!Number.isInteger(limit))throw Error('Outgoing scene cleanup needs a history depth.');
 if(messages===chat)throw Error('The host supplied live history instead of a request copy');
 const last=chat.length-1-(type==='swipe'?1:0);
 const projected=messages.map(message=>{
  if(message.is_user||message.is_system||typeof message.mes!=='string')return message;
  const index=historyIndex(message,chat);
  if(index<0){report.unmatched++;return message;}
  if(last-index<=limit)return message;
  const cleaned=cleanSceneRequestText(message.mes,config);report.unrecognized+=cleaned.unrecognized;
  if(!cleaned.scenes)return message;
  report.messages++;report.scenes+=cleaned.scenes;report.charactersRemoved+=message.mes.length-cleaned.text.length;
  return {...message,mes:cleaned.text};
 });
 return {messages:projected,report};
}

import {initialStory,applyStory,parseStoryUpdates} from '../adapters/scene-state.js';
export const STORY_KEY='display_bridge_story';
export const MESSAGE_KEY='display_bridge_message_id';
const fail=m=>{throw Error('Scene state: '+m);};
const clone=x=>JSON.parse(JSON.stringify(x));
const assistant=m=>m&&!m.is_user&&!m.is_system;
const slot=m=>Number.isInteger(m.swipe_id)?m.swipe_id:0;
const source=m=>typeof m.mes==='string'?m.mes:'';
export function createStoryJournal({config,owner,saved,parse=text=>parseStoryUpdates(text,config),uuid=()=>crypto.randomUUID()}){
 const signature=JSON.stringify(config),identity=JSON.stringify(owner);
 let data=saved?clone(saved):{version:1,owner:identity,signature,choice:null,records:[]};
 if(data.version!==1||data.owner!==identity||data.signature!==signature||!Array.isArray(data.records)||data.records.length>2048||JSON.stringify(data).length>8000000)fail('saved state belongs to another chat/configuration or exceeds limits; review and rebuild');
 initialStory(config,data.choice);
 if(saved&&config.startup&&!config.startup.choices.some(c=>c.id===data.choice))fail('saved startup choice is missing; review and rebuild');
 const ids=new Set();for(const r of data.records){if(typeof r.id!=='string'||ids.has(r.id)||typeof r.message!=='string'||!Number.isInteger(r.swipe)||typeof r.source!=='string'||r.source.length>200000||!(r.parent===null||ids.has(r.parent)))fail('corrupt saved journal');ids.add(r.id);if(JSON.stringify(parse(r.source))!==JSON.stringify(r.updates))fail('saved updates do not match their source');}
 function path(messages,limit=messages.length){
  let values=initialStory(config,data.choice),parent=null;const views=new Map();
  const byMessage=new Map();for(const r of data.records){if(!byMessage.has(r.message))byMessage.set(r.message,[]);byMessage.get(r.message).push(r);}
  for(let i=0;i<limit;i++){
   const m=messages[i];if(!assistant(m))continue;
   const candidates=(byMessage.get(m[MESSAGE_KEY])??[]).filter(r=>r.swipe===slot(m)&&r.source===source(m)&&r.parent===parent);
   if(!candidates.length)return {values,parent,views,issue:'Message '+i+' has no accepted state on this branch',index:i};
   const r=candidates.at(-1),before=values;values=applyStory(values,r.updates,config);views.set(m,{before,after:values,updates:r.updates,id:r.id});parent=r.id;
  }
  return {values,parent,views,issue:null};
 }
 function accept(messages,index){
  const m=messages[index];if(!assistant(m))return false;
  if(Array.isArray(m.swipes)&&slot(m)>=m.swipes.length)fail('pending swipe cannot commit');
  const prior=path(messages,index);if(prior.issue)fail(prior.issue);
  const updates=parse(source(m));applyStory(prior.values,updates,config);
  if(data.records.some(r=>r.message===m[MESSAGE_KEY]&&r.swipe===slot(m)&&r.source===source(m)&&r.parent===prior.parent))return false;
  const message=m[MESSAGE_KEY]||uuid(),r={id:uuid(),message,swipe:slot(m),source:source(m),parent:prior.parent,updates};
  if(data.records.length>=2048||JSON.stringify(data).length+JSON.stringify(r).length>8000000)fail('journal full; state was not discarded');
  m[MESSAGE_KEY]=message;data.records.push(r);return true;
 }
 return {
  read:messages=>path(messages),accept,
  rebuild(messages,choice=null){const previous=data;data={version:1,owner:identity,signature,choice,records:[]};try{initialStory(config,choice);for(let i=0;i<messages.length;i++)accept(messages,i);}catch(e){data=previous;throw e;}return path(messages);},
  save:()=>clone(data),
 };
}

import {validateSceneFragments, parseSceneFragments} from './scene-fragments.js';
import {taggedDialogue} from './tagged-dialogue.js';
import { validatePresentationStyle } from './presentation-style.js';
// Bounded grammars owned by the bridge. Imported regex is never executed.
import { codeRanges } from '../core/parser.js';
const fail=m=>{throw Error('Presentation format: '+m);};
const object=(x,keys)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))fail('unknown fields');};
const text=(x,n=256)=>typeof x==='string'&&x.trim()&&x.length<=n&&!/[\u0000-\u001f]/.test(x);
export const COMMUNITY_PATTERN=String.raw`<img=[""]([^"""\r\n]+)[""]>\s*\[ID:\s*([^|\]\r\n]*)\s*\|\s*Name:\s*([^|\]\r\n]*)\s*\|\s*Age:\s*([^|\]\r\n]*)\s*\|\s*Class:\s*([^\]\r\n]*)\]\s*\[Loc:\s*([^|\]\r\n]*)\s*\|\s*Attire:\s*([^|\]\r\n]*)\s*\|\s*Equipment:\s*([^|\]\r\n]*)\s*\|\s*Interests:\s*([^\]\r\n]*)\]\s*\[Mood:\s*([^|\]\r\n]*)\s*\|\s*Allocation:\s*([^|\]\r\n]*)\]\s*\[Personality:\s*([^\]\r\n]*)\]`;
export const COMMUNITY_FIELDS=['ID','Name','Age','Class','Loc','Attire','Equipment','Interests','Mood','Allocation','Personality'];
export function validatePresentationFormat(f){
 if(f.kind==='scene-fragments'){validateSceneFragments(f);return;}
 if(f.kind==='community'){object(f,['kind']);return;}
 if(f.kind==='scene'){object(f,['kind','open','close']);if(!text(f.open,40)||!text(f.close,40)||f.open===f.close||/[`\\]/.test(f.open+f.close))fail('invalid scene delimiters');return;}
 object(f,['kind','entries']);if(f.kind!=='tagged'||!Array.isArray(f.entries)||!f.entries.length||f.entries.length>64)fail('invalid tagged format');
 const seen=new Set();for(const e of f.entries){object(e,['kind','tag','quoted','speaker','portrait','recent','style','placement']);if(!['dialogue','dynamic','narration','status'].includes(e.kind))fail('unknown block kind');
  if(e.kind!=='dynamic'&&(!text(e.tag,60)||/[<>|\[\]"'\\`]/.test(e.tag)))fail('invalid literal tag');
  if(e.kind==='dynamic'&&e.tag!==undefined)fail('dynamic tags cannot have a fixed tag');
  if(e.quoted!==undefined&&typeof e.quoted!=='boolean')fail('invalid quote option');
  if(['dialogue','dynamic'].includes(e.kind)&&!text(e.speaker,160))fail('speaker required');
  if(e.kind==='dialogue'&&!text(e.portrait))fail('portrait required');
  if(e.recent!==undefined&&(!Number.isInteger(e.recent)||e.recent<1||e.recent>100))fail('invalid recency');
  if(e.placement!==undefined&&(e.kind!=='status'||e.placement!=='bottom'))fail('invalid placement');
  if(e.style!==undefined){if(e.kind==='status')fail('status styles are unsupported');validatePresentationStyle(e.style);}
  const key=e.kind==='dynamic'?'*':e.tag;if(seen.has(key))fail('ambiguous tags');seen.add(key);
 }
 if(seen.has('*')&&f.entries.some(e=>e.kind!=='dynamic'&&/^[A-Za-z ]+\.[1-3]$/.test(e.tag)))fail('fixed and dynamic tags overlap');
}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function parsePresentation(source,config,excluded=[],depth=0){
 const result={blocks:[],incomplete:0,unsupported:0},ranges=[...codeRanges(source),...excluded];
 const add=(start,end,data)=>{if(source[start-1]==='\\'||ranges.some(([a,b])=>start<b&&end>a))return;result.blocks.push({type:'portrait-dialogue',start,end,config,...data});ranges.push([start,end]);};
 const f=config.format;
 if(f.kind==='scene-fragments')return parseSceneFragments(source,config,ranges);
 if(f.kind==='community'){
  // Fixed bridge-owned expression, not the imported pattern string.
  const re=/<img="([^"\r\n]+)">\s*\[ID:\s*([^|\]\r\n]*)\s*\|\s*Name:\s*([^|\]\r\n]*)\s*\|\s*Age:\s*([^|\]\r\n]*)\s*\|\s*Class:\s*([^\]\r\n]*)\]\s*\[Loc:\s*([^|\]\r\n]*)\s*\|\s*Attire:\s*([^|\]\r\n]*)\s*\|\s*Equipment:\s*([^|\]\r\n]*)\s*\|\s*Interests:\s*([^\]\r\n]*)\]\s*\[Mood:\s*([^|\]\r\n]*)\s*\|\s*Allocation:\s*([^|\]\r\n]*)\]\s*\[Personality:\s*([^\]\r\n]*)\]/g;
  for(const m of source.matchAll(re)){if(m[0].length>16000){result.unsupported++;continue;}add(m.index,m.index+m[0].length,{presentation:'profile',portrait:m[1],speaker:m[3].trim(),dialogue:'',profileFields:COMMUNITY_FIELDS.map((label,i)=>[label,m[i+2].trim()])});}return result;
 }
 if(f.kind==='scene'){
  let cursor=0;while(cursor<source.length){const start=source.indexOf(f.open,cursor);if(start<0)break;cursor=start+f.open.length;let quote=false,esc=false,end=-1;
   for(let i=cursor;i<source.length&&i-cursor<=20000;i++){const ch=source[i];if(quote){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')quote=false;}else if(source.startsWith(f.close,i)){end=i;break;}else if(ch==='"')quote=true;}
   if(end<0){result.incomplete++;break;}const finish=end+f.close.length;
   try{const d=JSON.parse(source.slice(cursor,end));object(d,['speaker','dialogue','background','portraits','time','day','date','location']);if(!text(d.speaker,160)||typeof d.dialogue!=='string'||!d.dialogue.trim()||d.dialogue.length>12000||!Array.isArray(d.portraits)||d.portraits.length<1||d.portraits.length>4)fail('invalid scene');
    for(const p of d.portraits){object(p,['image','hover','label']);if(!text(p.image)||p.hover!==undefined&&!text(p.hover)||p.label!==undefined&&!text(p.label,160))fail('invalid portrait');}
    for(const k of ['background','time','day','date','location'])if(d[k]!==undefined&&!text(d[k],512))fail('invalid metadata');
    add(start,finish,{...d,portrait:d.portraits[0].image,presentation:'scene'});
   }catch{result.unsupported++;}cursor=finish;
  }return result;
 }
 for(const e of f.entries){
  if(e.kind==='status'){const re=new RegExp('\\['+escape(e.tag)+'\\|([^|\\]\\r\\n]*)\\|([^|\\]\\r\\n]*)\\|([^|\\]\\r\\n]*)\\|([^|\\]\\r\\n]*)\\]','g');for(const m of source.matchAll(re))add(m.index,m.index+m[0].length,{presentation:'metadata',moveBottom:e.placement==='bottom',speaker:'',dialogue:'',portrait:'',time:m[1],day:m[2],date:m[3],location:m[4],suppressed:e.recent!==undefined&&depth>=e.recent});continue;}
  const opener=e.kind==='dynamic'?/<\s*([A-Za-z ]+\.[1-3])\s*>/g:new RegExp('<\\s*('+escape(e.tag)+')\\s*>','g');
  for(const m of source.matchAll(opener)){const start=m.index,body=start+m[0].length;const close=new RegExp('<\\/\\s*'+escape(m[1])+'\\s*>');const ending=close.exec(source.slice(body,body+12512));
   if(!ending){if(!ranges.some(([a,b])=>start>=a&&start<b))result.incomplete++;continue;}const endingIndex=body+ending.index,end=endingIndex+ending[0].length;let dialogue=source.slice(body,endingIndex);
   if(!dialogue.trim()||dialogue.length>12000||/<\/?\s*[A-Za-z][^>]*>/.test(dialogue)){result.unsupported++;continue;}
   const parsed=taggedDialogue(dialogue,!!e.quoted);
   const content=['dialogue','dynamic'].includes(e.kind)?parsed:parsed?{dialogue:parsed.dialogue}:null;
   if(!content){result.unsupported++;continue;}
   add(start,end,{style:e.style,speaker:e.speaker??'',...content,portrait:e.kind==='dynamic'?m[1]:e.portrait??'',presentation:e.kind==='narration'?'narration':'dialogue',suppressed:e.recent!==undefined&&depth>=e.recent});
  }
 }result.blocks.sort((a,b)=>a.start-b.start);
 const visible=result.blocks.filter(b=>!b.suppressed),controller=visible.findLast(b=>b.presentation==='metadata')??visible.findLast(b=>b.presentation==='dialogue');
 for(const b of result.blocks)b.controls=b===controller;
 return result;
}

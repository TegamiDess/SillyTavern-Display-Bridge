// Recognize one bounded context-wrapper program. This is a structural matcher,
// not an interpreter: no source instruction is executed and history is not edited.
import {codeRanges} from '../core/parser.js';
export function contextWrapperEffects(){
 const e=(type,indent,rest={})=>({type,indent,...rest}),set=(indent,variable,value)=>e('v2SetVar',indent,{operator:'=',var:variable,value,valueType:'value'}),
 end=(indent,loop=false)=>e('v2EndIndent',indent,{endOfLoop:loop}),check=(indent,source,target,targetType='var')=>e('v2If',indent,{condition:'=',source,target,targetType}),
 join=(indent,a,b,out)=>e('v2ConcatString',indent,{source1:a,source1Type:'var',source2:b,source2Type:'var',outputVar:out}),
 write=(indent,value,valueType='var')=>e('v2ModifyChat',indent,{index:'i',indexType:'var',value,valueType});
 return [
  e('v2GetMessageCount',0,{outputVar:'Tn'}),e('v2GetLastMessage',0,{outputVar:'Tu2'}),check(0,'Tu3','Tu2'),e('v2StopTrigger',1),end(1),
  e('v2GetLastUserMessage',0,{outputVar:'Tu'}),check(0,'index','Tn'),e('v2StopTrigger',1),end(1),set(0,'istr','{{contains::{{getvar::Tu}}::&&&}}'),
  check(0,'istr','1','value'),join(1,'Ta','Tb','T'),write(1,'T'),e('v2StopTrigger',1),end(1),set(0,'i','-1'),e('v2LoopNTimes',0,{value:'Tn',valueType:'var'}),
  set(1,'i','{{? {{getvar::i}}+1}}'),e('v2GetMessageAtIndex',1,{index:'i',indexType:'var',outputVar:'T'}),set(1,'istr','{{contains::{{getvar::T}}::&&&}}'),
  check(1,'istr','1','value'),write(2,'.','value'),end(2),check(1,'T','Tu'),join(2,'Ta','Tu','Tu'),join(2,'Tu','Tb','Tu'),write(2,'Tu'),e('v2BreakLoop',2),end(2),end(1,true),
 ];
}
export function contextCompletionEffects(){return [
 {type:'v2If',indent:0,condition:'=',targetType:'value',target:'-1',source:'index'},
 {type:'v2SetVar',operator:'=',var:'fm',value:'',valueType:'value',indent:1},
 {type:'v2EndIndent',indent:1,endOfLoop:false},
 {type:'v2GetLastUserMessage',outputVar:'Tu3',indent:0},{type:'v2GetMessageCount',outputVar:'index',indent:0},
 ];}
const same=(a,b)=>a&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>a[k]===b[k]);
function matches(t,type,effects){return t.type===type&&!t.conditions?.length&&t.effect?.length===effects.length&&t.effect.every((e,i)=>same(e,effects[i]));}
export function compileSourceContext(source,initial,state){
 if(source.contextSourceVersion!==1||initial.fm!=='&&&'||initial.Ta!=='&&&{{br}}'||typeof initial.Tb!=='string')return null;
 const triggers=source.risuai?.triggerscript??[],starts=triggers.map((t,i)=>matches(t,'start',contextWrapperEffects())?i:-1).filter(i=>i>=0),
 ends=triggers.map((t,i)=>matches(t,'output',contextCompletionEffects())?i:-1).filter(i=>i>=0);
 if(starts.length!==1||ends.length!==1)return null;
 let invalid=false;const template=initial.Tb.replaceAll('{{br}}','\n').replace(/\{\{getvar::([A-Za-z][\w-]*)\}\}/g,(_,key)=>{
  if(!Object.hasOwn(state.variables,key))invalid=true;return '{'+key+'}';
 });
 if(invalid||template.includes('{{')||!template.includes('{'))return null;
 return {request:{version:1,greetingVariable:'fm',marker:'&&&',template},triggers:[starts[0],ends[0]]};
}
export function coveredSourceMacros(source,request){
 return !!request&&source.contextSourceVersion===1&&Array.isArray(source.macroReferences)&&source.macroReferences.length>0&&source.macroReferences.length<1000
  &&source.requiredMacros?.every(m=>m==='getvar')&&source.macroReferences.every(r=>r.field==='greeting'&&r.kind==='getvar'&&r.name===request.greetingVariable);
}
export function validateSourceRequest(request,variables){
 const fail=()=>{throw Error('Scene state: invalid source request template');};
 if(!request||request.version!==1||Object.keys(request).some(k=>!['version','greetingVariable','marker','template'].includes(k))||request.greetingVariable!=='fm'||request.marker!=='&&&'
  ||typeof request.template!=='string'||request.template.length>12000||/[<>\x00-\x08\x0b-\x1f]/.test(request.template))fail();
 let count=0;const rest=request.template.replace(/\{([A-Za-z][\w-]*)\}/g,(_,key)=>{if(!Object.hasOwn(variables,key))fail();count++;return '';});
 if(!count||count>128||/[{}]/.test(rest))fail();
}
export function sourceRequestText(values,request){return request.template.replace(/\{([A-Za-z][\w-]*)\}/g,(_,key)=>values[key]===null?'Unavailable':String(values[key]));}
export function sourceMarkerRanges(source,request){
 const excluded=codeRanges(source),ranges=[];
 for(const token of [request.marker,'{{getvar::'+request.greetingVariable+'}}']){let at=-1;while((at=source.indexOf(token,at+1))>=0){const end=at+token.length;if(source[at-1]!=='\\'&&!excluded.some(([a,b])=>at<b&&end>a))ranges.push([at,end]);}}
 return ranges.sort((a,b)=>a[0]-b[0]);
}
// The host passes a disposable request copy. Return fresh objects as a further
// guard against shared references; this never writes to the saved conversation.
export function projectSourceRequest(messages,request){
 return messages.map(m=>{if(m.is_user||typeof m.mes!=='string')return m;let text=m.mes;for(const [a,b]of sourceMarkerRanges(text,request).reverse())text=text.slice(0,a)+text.slice(b);return {...m,mes:text};});
}

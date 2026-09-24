// Reviewed, declarative state. No imported regular expressions or scripts run.
import {codeRanges} from '../core/parser.js';
import {validateSourceRequest,sourceRequestText} from './scene-source-context.js';
const fail=m=>{throw Error('Scene state: '+m);};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const key=x=>typeof x==='string'&&/^[A-Za-z][\w-]{0,59}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
const text=(x,n=256)=>typeof x==='string'&&x.length>0&&x.length<=n&&!/[\u0000-\u001f]/.test(x)&&!/[{}]/.test(x);
const shape=(x,fields)=>{if(!object(x)||Object.keys(x).some(k=>!fields.includes(k)))fail('unknown fields');};
const clone=x=>JSON.parse(JSON.stringify(x));
const escaped=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function stateValue(value,definition){
 if(value===null)return null;
 if(definition.type==='number'&&Number.isFinite(value)&&value>=definition.min&&value<=definition.max)return value;
 if(definition.type==='boolean'&&typeof value==='boolean')return value;
 if(definition.type==='string'&&text(value))return value;
 if(definition.type==='enum'&&definition.values.includes(value))return value;
 fail('invalid value for declared variable');
}
export function validateSceneState(s,controls){
 shape(s,['version','variables','rules','derive','roster','track','backgroundTracks','context','startup',...(s.version>=2?['literals','strictPrefixes']:[]),...(s.version===3?['request']:[])]);
 if(![1,2,3].includes(s.version)||!object(s.variables)||!Object.keys(s.variables).length||Object.keys(s.variables).length>256)fail('invalid variable registry');
 const declared=k=>{if(!key(k)||!Object.hasOwn(s.variables,k))fail('unknown variable');return s.variables[k];};
 if(s.strictPrefixes!==undefined&&(!Array.isArray(s.strictPrefixes)||s.strictPrefixes.length>32||s.strictPrefixes.some(p=>!text(p,80)||p.length<2)))fail('invalid annotation prefixes');
 for(const [name,v]of Object.entries(s.variables)){
  if(!key(name))fail('invalid variable name');shape(v,['type','initial','min','max','values']);
  if(!['number','string','boolean','enum'].includes(v.type))fail('invalid type');
  if(v.type==='number'&&(!Number.isFinite(v.min)||!Number.isFinite(v.max)||v.min>v.max||Math.max(Math.abs(v.min),Math.abs(v.max))>1000000))fail('invalid numeric bounds');
  if(v.type==='enum'&&(!Array.isArray(v.values)||!v.values.length||v.values.length>64||v.values.some(x=>!text(x))||new Set(v.values).size!==v.values.length))fail('invalid enum');
  if(!Object.hasOwn(v,'initial'))fail('missing initial value');stateValue(v.initial,v);
 }
 if(!Array.isArray(s.rules)||s.rules.length>64)fail('invalid rules');
 const templates=new Set();
 for(const rule of s.rules){
  shape(rule,['template','op','targets',...(s.version>=2?['values','insensitive','valueFormat']:[])]);
  if(rule.valueFormat!==undefined&&rule.valueFormat!=='unsigned-integer')fail('invalid value format');
  if(rule.insensitive!==undefined&&typeof rule.insensitive!=='boolean')fail('invalid case policy');
  if(typeof rule.template!=='string'||!text(rule.template.replaceAll('{entity}','entity').replaceAll('{value}','value'),180)||!['set','add','subtract'].includes(rule.op)||templates.has(rule.template))fail('invalid or repeated rule');
  templates.add(rule.template);const parts=rule.template.split(/(\{entity\}|\{value\})/);
  if(parts.filter(x=>x==='{entity}').length!==1||parts.filter(x=>x==='{value}').length!==1||!parts[0]||!parts.at(-1)||parts[2]===''||parts.some(x=>x!=='{entity}'&&x!=='{value}'&&/[{}]/.test(x)))fail('templates need separated entity/value placeholders and literal boundaries');
  if(!object(rule.targets)||!Object.keys(rule.targets).length||Object.keys(rule.targets).length>64)fail('invalid rule targets');
  for(const [alias,k]of Object.entries(rule.targets)){if(!text(alias,60)||/[<>]/.test(alias)||['__proto__','constructor','prototype'].includes(alias))fail('invalid entity alias');if(rule.op!=='set'&&declared(k).type!=='number')fail('delta requires number');declared(k);}
  if(rule.insensitive&&new Set(Object.keys(rule.targets).map(k=>k.toLowerCase())).size!==Object.keys(rule.targets).length)fail('ambiguous case aliases');
  if(rule.values!==undefined){if(rule.op!=='set'||!object(rule.values)||!Object.keys(rule.values).length||Object.keys(rule.values).length>128)fail('invalid value lookup');for(const [raw,value]of Object.entries(rule.values)){if(!text(raw))fail('invalid lookup text');for(const k of Object.values(rule.targets))stateValue(value,declared(k));}}
 }
 if(s.literals!==undefined){if(!Array.isArray(s.literals)||s.literals.length>512)fail('invalid literal updates');const seen=new Set();for(const l of s.literals){shape(l,['text','key','value']);if(!text(l.text,256)||seen.has(l.text))fail('invalid literal annotation');seen.add(l.text);stateValue(l.value,declared(l.key));}}
 if(s.derive!==undefined){if(!Array.isArray(s.derive)||s.derive.length>64)fail('invalid derivations');const written=new Set();for(const d of s.derive){shape(d,['from','to','values']);declared(d.from);const v=declared(d.to);if(d.from===d.to||written.has(d.to)||!object(d.values)||Object.keys(d.values).length>64)fail('invalid lookup');written.add(d.to);for(const [k,value]of Object.entries(d.values)){if(!text(k)||['__proto__','constructor','prototype'].includes(k))fail('invalid lookup key');stateValue(value,v);}}}
 if(s.roster!==undefined){if(!Array.isArray(s.roster)||s.roster.length>32)fail('invalid roster bindings');const ids=new Set();for(const r of s.roster){shape(r,['id','score','location','relationship','badge']);const e=controls?.roster?.entities.find(x=>x.id===r.id);if(!e||ids.has(r.id))fail('unknown roster entity');ids.add(r.id);for(const [field,k]of Object.entries(r)){if(field==='id')continue;const v=declared(k);if(field==='score'&&v.type!=='number'||field!=='score'&&!['string','enum'].includes(v.type))fail('incompatible roster binding');if(field==='badge'&&(v.type!=='enum'||v.values.some(id=>!e.badges?.some(b=>b.id===id))))fail('badge binding must be a declared finite enum');}}}
 const track=id=>id===null||controls?.music?.tracks.some(t=>t.id===id);
 if(s.track!==undefined){const v=declared(s.track);if(v.type!=='enum'||v.values.some(x=>!track(x)))fail('invalid track variable');}
 if(s.backgroundTracks!==undefined){if(!s.track||!object(s.backgroundTracks)||Object.keys(s.backgroundTracks).length>128||Object.entries(s.backgroundTracks).some(([name,id])=>!text(name)||['__proto__','constructor','prototype'].includes(name)||!track(id)))fail('invalid background track map');}
 if(s.context!==undefined){shape(s.context,['title','fields']);if(!text(s.context.title,80)||!Array.isArray(s.context.fields)||s.context.fields.length>128)fail('invalid context');for(const f of s.context.fields){shape(f,['key','label']);declared(f.key);if(!text(f.label,80))fail('invalid context label');}}
 if(s.startup!==undefined){shape(s.startup,['marker','choices']);if(!text(s.startup.marker,80)||!Array.isArray(s.startup.choices)||!s.startup.choices.length||s.startup.choices.length>16)fail('invalid startup choices');const ids=new Set();for(const c of s.startup.choices){shape(c,['id','label','text','values']);if(!key(c.id)||ids.has(c.id)||!text(c.label,80)||typeof c.text!=='string'||!c.text.trim()||c.text.length>30000||/\{\{|<scene-start/.test(c.text)||!object(c.values))fail('invalid startup branch');ids.add(c.id);for(const [k,v]of Object.entries(c.values))stateValue(v,declared(k));}}
 if(s.request!==undefined)validateSourceRequest(s.request,s.variables);
 return clone(s);
}
export function initialStory(s,choice){const values=Object.fromEntries(Object.entries(s.variables).map(([k,v])=>[k,v.initial]));if(choice){const c=s.startup?.choices.find(c=>c.id===choice);if(!c)fail('unknown startup choice');Object.assign(values,c.values);}return deriveStory(values,s);}
export function deriveStory(values,s){const next={...values};for(const d of s.derive??[])next[d.to]=Object.hasOwn(d.values,String(next[d.from]))?d.values[String(next[d.from])]:null;return next;}
export function applyStory(values,updates,s){const next={...values};for(const u of updates){const v=s.variables[u.key];if(!v)fail('undeclared update');if(u.op==='set')next[u.key]=stateValue(u.value,v);else{if(v.type!=='number'||!Number.isFinite(next[u.key])||!Number.isFinite(u.value))fail('delta has unknown numeric base');next[u.key]=stateValue(next[u.key]+(u.op==='subtract'?-u.value:u.value),v);}}return deriveStory(next,s);}
export function parseStoryUpdates(source,s,displayRanges=[],onIgnored=()=>{}){
 if(typeof source!=='string'||source.length>200000)fail('message exceeds state scan limit');
 const ranges=[...codeRanges(source),...displayRanges],updates=[],ignored=[];
 // Older assembled profiles only contain the canonical BGM literal. Keep
 // accepting the observed model typo (`<@BGM=@BGM_...>`) without requiring
 // users to rebuild those profiles, while retaining the same state value.
 const literals=[...(s.literals??[])],literalTexts=new Set(literals.map(l=>l.text));
 for(const l of s.literals??[])if(l.text.startsWith('<BGM=@BGM_')){
  const alias='<@'+l.text.slice(1);if(!literalTexts.has(alias)){literals.push({...l,text:alias});literalTexts.add(alias);}
 }
 const prefixes=new Map((s.strictPrefixes??[]).map(p=>[p,false]));
 if(literals.some(l=>l.text.startsWith('<@BGM=@BGM_'))&&!prefixes.has('<@BGM=@BGM_'))prefixes.set('<@BGM=@BGM_',false);
 const locations=new Set((s.roster??[]).map(r=>r.location).filter(Boolean));
 for(const rule of s.rules){
  const parts=rule.template.split(/(\{entity\}|\{value\})/),order=parts.filter(p=>p==='{entity}'||p==='{value}');prefixes.set(parts[0],prefixes.get(parts[0])||rule.insensitive===true);
  const aliases=Object.keys(rule.targets).sort((a,b)=>b.length-a.length).map(escaped).join('|');
  const regex=new RegExp(parts.map(p=>p==='{entity}'?`(${aliases}|[^<>\\r\\n]{1,60}?)`:p==='{value}'?'([^<>\\r\\n]{1,256}?)':escaped(p)).join(''),rule.insensitive?'gi':'g');
  for(const m of source.matchAll(regex)){
   const start=m.index,end=start+m[0].length;if(source[start-1]==='\\'||ranges.some(([a,b])=>start<b&&end>a))continue;
   const captured=m[order.indexOf('{entity}')+1],alias=rule.insensitive?Object.keys(rule.targets).find(k=>k.toLowerCase()===captured.toLowerCase()):captured,raw=m[order.indexOf('{value}')+1],name=rule.targets[alias];
   if(!Object.hasOwn(rule.targets,alias)){
    // Only roster-bound, free-text location assignments tolerate extra entities.
    // Check the value first so malformed tags cannot bypass normal validation.
    const targets=Object.values(rule.targets);
    if(rule.op==='set'&&!rule.values&&!rule.valueFormat&&targets.every(k=>locations.has(k)&&s.variables[k]?.type==='string')){
     if(!text(captured,60))fail('invalid entity in location annotation');
     for(const k of targets)stateValue(raw,s.variables[k]);
     ignored.push({start,end});if(updates.length+ignored.length>256)fail('too many state updates');
     onIgnored({kind:'unknown-location-entity',entity:captured,start,end});continue;
    }
    fail('unknown entity '+JSON.stringify(captured)+' in state annotation');
   }
   const definition=s.variables[name];let value=raw;
   if(rule.valueFormat==='unsigned-integer'&&!/^\d+$/.test(raw))fail('invalid integer annotation');
   if(rule.values){if(!Object.hasOwn(rule.values,raw))fail('unknown value in state annotation');value=rule.values[raw];}
   else if(definition.type==='number'){if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw))fail('invalid numeric annotation');value=Number(raw);}
   else if(definition.type==='boolean'){if(!['true','false'].includes(raw))fail('invalid boolean annotation');value=raw==='true';}
   if(rule.op==='set')stateValue(value,definition);else if(!Number.isFinite(value)||Math.abs(value)>1000000)fail('invalid delta');
   updates.push({start,end,key:name,value,op:rule.op});if(updates.length+ignored.length>256)fail('too many state updates');
  }
 }
 for(const l of literals.sort((a,b)=>b.text.length-a.text.length)){let at=-1;while((at=source.indexOf(l.text,at+1))>=0){const end=at+l.text.length;if(source[at-1]==='\\'||ranges.some(([a,b])=>at<b&&end>a)||[...updates,...ignored].some(u=>at<u.end&&end>u.start))continue;updates.push({start:at,end,key:l.key,value:l.value,op:'set'});if(updates.length+ignored.length>256)fail('too many state updates');}}
 const annotations=[...updates,...ignored].sort((a,b)=>a.start-b.start);for(let i=1;i<annotations.length;i++)if(annotations[i].start<annotations[i-1].end)fail('overlapping state annotations');
 updates.sort((a,b)=>a.start-b.start);
 for(const [prefix,insensitive] of prefixes){let at=-1;const scanned=insensitive?source.toLowerCase():source,needle=insensitive?prefix.toLowerCase():prefix;while((at=scanned.indexOf(needle,at+1))>=0){if(source[at-1]==='\\'||ranges.some(([a,b])=>at>=a&&at<b)||updates.some(u=>at>=u.start&&at<u.end)||ignored.some(u=>at>=u.start&&at<u.end))continue;fail('incomplete or unsupported state annotation beginning '+JSON.stringify(prefix));}}
 return updates;
}
export function storySnapshot(values,s){
 const result={};if(s.roster)result.roster=s.roster.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,k==='id'?v:values[v]??null])));
 if(s.track!==undefined)result.track=values[s.track]??null;
 return result;
}
export function storyContext(values,s){return s.request?sourceRequestText(values,s.request):s.context?`${s.context.title}\n${s.context.fields.map(f=>`${f.label}: ${values[f.key]===null?'Unavailable':String(values[f.key])}`).join('\n')}`:'';}

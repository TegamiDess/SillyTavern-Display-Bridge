// Compile known source shapes into bounded data. Imported regex/HTML/scripts
// are inspected, never evaluated or installed as executable behavior.
import {validatePortraitPreset} from './portrait-dialogue.js';
import {compileSourceContext,coveredSourceMacros} from './scene-source-context.js';
import {compileSceneNormalization} from './scene-normalization.js';
const id=s=>/^[A-Za-z][\w-]{0,50}$/.test(s)&&!['constructor','prototype','__proto__'].includes(s);
const plain=(s,n=256)=>typeof s==='string'&&s.length>0&&s.length<=n&&!/[<>{}\x00-\x1f]/.test(s);
const flags=r=>{const o=r.matchOptions??{};return o.ableFlag===false?'g':o.flags??o.flag??'g';};
const defaults=text=>{const result=Object.create(null);for(const line of String(text??'').split(/\r?\n/)){const i=line.indexOf('=');if(i<1)continue;const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();if(Object.hasOwn(result,k))throw Error('Duplicate source defaults need review.');result[k]=v;}return result;};
const unknown=s=>s===undefined||s===''||s==='???'||/[{}\x00-\x1f]/.test(s)?null:s;
function badges(trigger,entity){
 if(trigger.type!=='output'||trigger.conditions?.length)return null;const e=trigger.effect??[],first=e[0];
 if(!first||first.type!=='v2SetVar'||first.operator!=='='||first.var!=='ss'||first.value!==entity||first.valueType!=='value'||first.indent!==0||(e.length-1)%4)return null;
 const rows=[];for(let i=1;i<e.length;i+=4){const [test,style,icon,end]=e.slice(i,i+4);
  if(test.type!=='v2If'||test.indent!==0||test.condition!=='='||test.targetType!=='value'||test.source!=='{{getvar::ss}}_r'||!plain(test.target,80)
   ||style.type!=='v2SetVar'||style.operator!=='='||style.var!=='{{getvar::ss}}_ap'||style.valueType!=='value'||style.indent!==1||!/^badge badge-[\w-]+$/.test(style.value)
   ||icon.type!=='v2SetVar'||icon.operator!=='='||icon.var!=='{{getvar::ss}}_as'||icon.valueType!=='value'||icon.indent!==1||!/^\d{1,3}$/.test(icon.value)
   ||end.type!=='v2EndIndent'||end.indent!==1||end.endOfLoop!==false)return null;
  rows.push({label:test.target,suffix:icon.value});
 }return rows.length&&rows.length<=16&&new Set(rows.map(r=>r.label)).size===rows.length?rows:null;
}
export function assembleSceneImport(source,preset){
 const originalPreset=preset;
 const coverage=[],adaptedRules=new Map(),adaptedTriggers=new Set(),add=(feature,status,reason)=>coverage.push({feature,status,reason});
 if(preset.format.kind!=='scene-fragments')return {preset,coverage,adaptedRules,adaptedTriggers};
 if(source.sceneSourceVersion!==1){add('State and media','needs-source','Reattach with the current provider to preserve defaults, assets and structured trigger fields.');return {preset,coverage,adaptedRules,adaptedTriggers};}
 add('Scene layout','ready','Recognized scene fragments supply the background, portraits and dialogue.');
 const risu=source.risuai??{},rules=risu.customScripts??[],triggers=risu.triggerscript??[],assets=source.assets??[];
 const hasAsset=(name,audio=false)=>assets.some(a=>a.name===name&&(audio?/^(mp3|wav|ogg)$/i.test(a.ext):/^(png|jpe?g|webp|gif|bmp|avif)$/i.test(a.ext)));
 try{
  const initial=defaults(risu.defaultVariables),controls={version:1},state={version:2,variables:{},rules:[],derive:[],roster:[]};
  const normalized=compileSceneNormalization(source);
  for(const [index,reason]of normalized.adapted)adaptedRules.set(index,reason);
  if(normalized.normalization){preset={...preset,format:{...preset.format,normalization:normalized.normalization}};add('Scene normalization','ready',`${normalized.adapted.size} field-scoped corrections; dialogue and stored source remain unchanged.`);}
  for(const warning of normalized.warnings)add('Scene normalization','partial',warning);
  const candidates=rules.map((r,index)=>({r,index})).filter(({r})=>r.type==='editdisplay'&&r.out?.includes('class="character-card')&&r.out.includes('class="heart-percent"'));
  if(candidates.length>1)throw Error('Multiple active roster templates need an explicit profile.');
  const entities=[],iconPatterns=new Map();
  if(candidates.length){const {r,index}=candidates[0];if(!['g',''].includes(flags(r)))throw Error('Roster matching options need review.');
   const chunks=r.out.split(/<div class="character-card(?: custom-bg)?"[^>]*>/).slice(1);
   if(!chunks.length||chunks.length>32)throw Error('Roster size is unsupported.');
   for(const chunk of chunks){
    const who=/class="heart-percent">\{\{getvar::([A-Za-z][\w-]*)_p\}\}%/.exec(chunk)?.[1],label=/class="character-name">([^<{}]+)<\/div>/.exec(chunk)?.[1];
    if(!id(who??'')||entities.some(e=>e.id===who)||!plain(label,80)||!chunk.includes('{{getvar::'+who+'_loc}}')||!chunk.includes('{{getvar::'+who+'_r}}'))throw Error('Roster field bindings are ambiguous.');
    const icon=/src="\{\{raw::([^{}]*)\{\{getvar::([A-Za-z][\w-]*)_as\}\}([^{}]*)\}\}"/.exec(chunk);
    if(!icon||icon[2]!==who||!plain(icon[1]+icon[3]))throw Error('Roster image binding needs review.');
    const name=suffix=>icon[1]+suffix+icon[3],portrait=initial[who+'_as']&&name(initial[who+'_as']);iconPatterns.set(who,name);
    entities.push({id:who,label,...(portrait?{portrait}:{})});
    const score=initial[who+'_p'];state.variables[who+'_p']={type:'number',initial:score!==undefined&&/^-?\d+(?:\.\d+)?$/.test(score)&&Math.abs(Number(score))<=1000000?Number(score):null,min:-1000000,max:1000000};
    state.variables[who+'_loc']={type:'string',initial:unknown(initial[who+'_loc'])};state.variables[who+'_r']={type:'string',initial:unknown(initial[who+'_r'])};
    state.roster.push({id:who,score:who+'_p',location:who+'_loc',relationship:who+'_r'});
   }
   controls.roster={title:'Character information',entities};adaptedRules.set(index,'Roster field and image bindings compiled into the scene drawer.');
   add('Roster','ready',`${entities.length} declared entities; missing defaults remain unavailable.`);
   for(const entity of entities){const found=triggers.map((t,i)=>({i,rows:badges(t,entity.id)})).filter(x=>x.rows);if(found.length!==1){add('Badge '+entity.id,'partial','No unique reviewed finite badge trigger; the declared initial portrait is retained.');continue;}
    const {i,rows}=found[0];entity.badges=rows.map((r,n)=>({id:'badge'+n,label:r.label,image:iconPatterns.get(entity.id)(r.suffix)}));
    const key=entity.id+'_badge';state.variables[key]={type:'enum',initial:null,values:entity.badges.map(b=>b.id)};
    state.derive.push({from:entity.id+'_r',to:key,values:Object.fromEntries(entity.badges.map(b=>[b.label,b.id]))});state.roster.find(r=>r.id===entity.id).badge=key;adaptedTriggers.add(i);
   }
  }
  const targets=suffix=>Object.fromEntries(entities.map(e=>[e.id,e.id+suffix]));
  rules.forEach((r,index)=>{
   if(r.type!=='editoutput'||!entities.length||!['','g','gi','ig'].includes(flags(r)))return;
   let template,op,suffix,values;
   if(r.out==='{{setvar::$1_loc::$2}}'&&['<MOVE_(.+?)_(.+?)>','<이동_(.+?)_(.+?)>'].includes(r.in)){template=r.in.startsWith('<MOVE')?'<MOVE_{entity}_{value}>':'<이동_{entity}_{value}>';op='set';suffix='_loc';}
   if(r.out==='{{setvar::$1_r::$2}}'&&/^<관계=\(\.\+\?\)=\([\p{L}|]+\)>$/u.test(r.in)){template='<관계={entity}={value}>';op='set';suffix='_r';values=Object.fromEntries(r.in.slice(r.in.lastIndexOf('(')+1,-2).split('|').map(v=>[v,v]));}
   for(const [sign,operation]of [['+','add'],['-','subtract']])for(const [open,close]of [['<','>'],['"','"']]){
    const pattern=open+'❤([a-zA-Z]+?)'+(sign==='+'?'\\+':'-')+'(\\d+)'+close,write='{{setvar::$1_p::{{calc::{{getvar::$1_p}}'+sign+'$2}}}}';
    if(r.in===pattern&&[write,'"❤$1'+sign+'$2"'+write].includes(r.out)){template=open+'❤{entity}'+sign+'{value}'+close;op=operation;suffix='_p';}
   }
   if(template){state.rules.push({template,op,targets:targets(suffix),...(values?{values}:{}),...(op!=='set'?{valueFormat:'unsigned-integer'}:{}),...(flags(r).includes('i')?{insensitive:true}:{})});adaptedRules.set(index,'Compiled to a typed state update applied once on accepted output.');}
  });
  if(entities.length){const complete=['_p','_loc','_r'].every(suffix=>state.rules.some(r=>Object.values(r.targets).some(k=>k.endsWith(suffix))));add('State updates',complete?'ready':'partial',`${state.rules.length} reviewed assignment/delta patterns. Other output rules are not executed.`);}
  const tracks=[],codes=new Map();
  const audio=/\{\{#if \{\{equal::\{\{getvar::bgm\}\}::(\d+)\}\}\}\}\s*\{\{audio::([^{}]+)\}\}\s*\{\{\/if\}\}/g;
  for(const m of String(risu.backgroundHTML??'').matchAll(audio)){if(!plain(m[2])||codes.has(m[1]))throw Error('Ambiguous music branches.');const track={id:'track'+m[1],label:m[2],asset:m[2]};tracks.push(track);codes.set(m[1],track.id);}
  if(tracks.length){
   controls.music={title:'Scene music',tracks,volume:.3,loop:true};state.variables.sceneTrack={type:'enum',initial:codes.get(initial.bgm)??null,values:tracks.map(t=>t.id)};state.track='sceneTrack';state.literals=[];
   rules.forEach((r,index)=>{if(r.type!=='editoutput'||!['','g'].includes(flags(r)))return;
    if(r.in==='@BGMoff|<@BGMoff>|<@BGM=BGMoff>'&&r.out==='{{setvar::bgm::0}}'){for(const text of r.in.split('|'))state.literals.push({text,key:'sceneTrack',value:null});adaptedRules.set(index,'Compiled explicit music-stop annotations.');return;}
    const match=/^<BGM=@BGM_(0?)\(\\d\+\)_\(([^()]+)\)>$/.exec(r.in);
    if(!match||r.out!=='{{setvar::bgm::$1}}')return;
    const labels=match[2].split('|');if(!labels.every(x=>plain(x,60)&&/^[\p{L}\p{N}_ '’-]+$/u.test(x)))return;
    for(const label of labels)for(const code of codes.keys())state.literals.push({text:'<BGM=@BGM_'+(match[1]?'0':'')+code+'_'+label+'>',key:'sceneTrack',value:codes.get(code)});
    adaptedRules.set(index,'Compiled finite music labels and code-to-track assignments.');
   });
   state.strictPrefixes=['<BGM=@BGM_'];
   add('Music',state.literals.some(l=>l.value!==null)?'ready':'partial',`${tracks.length} local track bindings. Initial Play is required; automatic selection follows recognized BGM annotations, not guessed background names.`);
   if(initial.bgm!==undefined&&initial.bgm!=='0'&&!codes.has(initial.bgm))add('Initial music','missing','The declared initial music code has no matching track.');
  }
  if(!Object.keys(state.variables).length){if(source.requiredMacros?.length||Object.keys(initial).length||triggers.some(t=>t.effect?.length)||rules.some(r=>['editinput','editoutput'].includes(r.type)&&(r.in||r.out)))add('State and media','unsupported','Source state or input/output dependencies are present but no reviewed roster or local music source was found.');return {preset,coverage,adaptedRules,adaptedTriggers};}
  if(entities.length){state.context={title:'Current scene facts',fields:entities.flatMap(e=>[{key:e.id+'_p',label:e.id+' score'},{key:e.id+'_loc',label:e.id+' location'},{key:e.id+'_r',label:e.id+' relationship'}])};add('Model context','ready','Declared roster facts are supplied after Conversation state is initialized. Source prompt macros and history edits are not evaluated.');}
  for(const name of [...entities.flatMap(e=>[e.portrait,...(e.badges??[]).map(b=>b.image)]),...tracks.map(t=>t.asset)].filter(Boolean))if(!hasAsset(name,tracks.some(t=>t.asset===name)))add('Asset','missing',`No matching declared local asset: ${name}`);
  const contextSource=compileSourceContext(source,initial,state);
  if(contextSource){state.version=3;state.request=contextSource.request;for(const i of contextSource.triggers)adaptedTriggers.add(i);rules.forEach((r,i)=>{if(['editdisplay','editprocess'].includes(r.type)&&r.in==='&&&'&&r.out===''&&['','g'].includes(flags(r)))adaptedRules.set(i,'Drawer marker is omitted from display/request copies; saved text remains intact.');});add('Source request context','ready','Reviewed roster context is filled from committed state for each request. Greeting drawer markers are omitted from the request copy; saved messages are not rewritten.');}
  if(source.requiredMacros?.length&&!coveredSourceMacros(source,state.request))add('Startup / prompt macros','unsupported',`Required source macros need conversion: ${source.requiredMacros.join(', ')}. Original greeting and prompt text were preserved.`);
  const omitted=triggers.filter((t,i)=>t.effect?.length&&!adaptedTriggers.has(i)).length;if(omitted)add('Other triggers','unsupported',`${omitted} trigger groups were not translated; startup, random effects and history edits require review.`);
  const unhandled=rules.filter((r,i)=>['editoutput','editinput'].includes(r.type)&&(r.in||r.out)&&!adaptedRules.has(i)).length;if(unhandled)add('Other input/output rules','unsupported',`${unhandled} input/output rules require review; their transformations are not executed.`);
  const next=validatePortraitPreset({...preset,sceneControls:controls,sceneState:state});
  return {preset:next,coverage,adaptedRules,adaptedTriggers};
 }catch(e){coverage.length=0;add('Assembly','needs-review',e.message);return {preset:originalPreset,coverage,adaptedRules:new Map(),adaptedTriggers:new Set()};}
}

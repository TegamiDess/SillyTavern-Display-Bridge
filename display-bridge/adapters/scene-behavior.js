import {inspectSceneRule} from './scene-recognition.js';

// Declarative switches for bridge-owned effects, never imported CSS execution.
export function validateSceneBehavior(value,format){
 const fail=message=>{throw Error('Scene behavior: '+message);};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['version','maxMessageDepth','cloudFade','portraitBreathing','portraitEntrance','cleanupOutgoing'].includes(k)))fail('unknown fields');
 if(value.version!==1||format?.kind!=='scene-fragments')fail('requires version 1 and scene fragments');
 if(value.maxMessageDepth!==undefined&&(!Number.isInteger(value.maxMessageDepth)||value.maxMessageDepth<0||value.maxMessageDepth>100))fail('history depth must be 0–100');
 if(value.cleanupOutgoing!==undefined&&typeof value.cleanupOutgoing!=='boolean')fail('outgoing cleanup must be boolean');
 if(value.cleanupOutgoing===true&&value.maxMessageDepth===undefined)fail('outgoing cleanup requires a history depth');
 for(const key of ['cloudFade','portraitBreathing','portraitEntrance'])if(value[key]!==undefined&&typeof value[key]!=='boolean')fail(key+' must be boolean');
}

export const RECENCY_GATE=variable=>'{{#if {{greater_equal::{{chat_index}}::{{? {{lastmessageid}}-{{getvar::'+variable+'}} }}}}}}';
export function compileSceneBehavior(source,initial){
 const risu=source.risuai??{},rules=risu.customScripts??[],behavior={version:1},coverage=[],defaultsUsed=[];
 const recognized=rules.map(rule=>({rule,result:inspectSceneRule(rule,{optionsPreserved:source.ruleOptionsVersion===1})})).filter(x=>x.result?.status==='supported'&&x.result.part.role!=='text');
 const gated=recognized.filter(x=>/chat_index|chatindex|lastmessageid/.test(x.rule.out));
 if(gated.length){
  const variable=/\{\{getvar::([A-Za-z][\w-]*)\}\}/.exec(gated[0].rule.out)?.[1];
  const value=initial[variable],gate=RECENCY_GATE(variable);
  const writes=JSON.stringify(risu.triggerscript??[]).includes('"var":"'+variable+'"')||rules.some(r=>String(r.out).includes('{{setvar::'+variable+'::'));
  const consistent=recognized.length===gated.length&&gated.every(x=>x.rule.out.trim().startsWith(gate)&&x.rule.out.trim().endsWith('{{/if}}'));
  if(consistent&&!writes&&/^\d{1,3}$/.test(value??'')&&Number(value)<=100){behavior.maxMessageDepth=Number(value);defaultsUsed.push(variable);coverage.push({feature:'Scene history',status:'ready',reason:`Artwork remains through depth ${value}, counting all messages; older dialogue stays readable.`});}
  else coverage.push({feature:'Scene history',status:'partial',reason:'Conflicting, dynamic or unknown source recency conditions need an explicit scene history setting.'});
 }
 // Match the reviewed keyframes exactly, then check their bound class and
 // timing. Similar names alone never enable motion on an unrelated card.
 const css=String(risu.backgroundHTML??'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,'');
 const fade='@keyframesfadeEffect{0%{opacity:0.8;}50%{opacity:0.5;}100%{opacity:0.8;}}';
 const breath='@keyframesbreathingEffect{0%{transform:translate(-50%,-50%)translateY(0)scaleY(1);}50%{transform:translate(-50%,-50%)translateY(-3px)scaleY(1.01);}100%{transform:translate(-50%,-50%)translateY(0)scaleY(1);}}';
 const entry='@keyframesfadeInAndMoveUp{from{opacity:0;transform:translate(-50%,-50%)translateY(40px);}to{opacity:1;transform:translate(-50%,-50%);}}';
 const normalized=css.replace(/([:(,])\.(\d)/g,(_,prefix,digit)=>prefix+'0.'+digit);
 const cloud=/\.fullBgImage3\{([^{}]*)\}/.exec(normalized)?.[1]??'';
 if(recognized.some(x=>x.result.part.role==='background'&&x.result.part.layers)&&normalized.includes(fade)&&['animation-name:fadeEffect;','animation-duration:120s;','animation-timing-function:ease-in-out;','animation-iteration-count:infinite;'].every(x=>cloud.includes(x)))behavior.cloudFade=true;
 const classes=new Set(recognized.filter(x=>x.result.part.role==='cast').flatMap(x=>[...x.rule.out.matchAll(/class="(characterImage\d(?:_\d)?)"/g)].map(m=>m[1])));
 const portraitBlocks=[...normalized.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>[...m[1].matchAll(/(?:^|,)(?:\.simpleFrame)?\.(characterImage\d(?:_\d)?)(?=,|$)/g)].some(c=>classes.has(c[1]))&&m[2].includes('animation-name:fadeInAndMoveUp,breathingEffect;')&&m[2].includes('animation-duration:0.7s,4s;')&&m[2].includes('animation-timing-function:ease-out,ease-in-out;'));
 if(portraitBlocks.length&&normalized.includes(breath))behavior.portraitBreathing=true;
 if(portraitBlocks.length&&normalized.includes(entry))behavior.portraitEntrance=true;
 const effects=[behavior.cloudFade&&'cloud fade',behavior.portraitBreathing&&'portrait breathing',behavior.portraitEntrance&&'portrait entrance'].filter(Boolean);
 if(effects.length)coverage.push({feature:'Scene motion',status:'ready',reason:'Reviewed '+effects.join(', ')+' use local effects, with reduced-motion and off-screen pausing. Portraits use the reviewed one-to-four-slot stagger.'});
 return {behavior:Object.keys(behavior).length>1?behavior:null,coverage,defaultsUsed};
}

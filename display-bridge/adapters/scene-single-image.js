// A finite single-image/offset layout, independent of click/audio programs.
export function validateSingleImage(value){
 const fail=()=>{throw Error('Single-image layout: expected a literal marker/suffix and 1–100% dimensions');};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['version','marker','suffix','width','height'].includes(k))||value.version!==1)fail();
 if(typeof value.marker!=='string'||!/^_[A-Za-z0-9_-]{1,60}_$/.test(value.marker)||!['.png','.webp','.jpg','.jpeg'].includes(value.suffix))fail();
 for(const key of ['width','height'])if(!Number.isFinite(value[key])||value[key]<1||value[key]>100)fail();
}
export function matchesSingleImage(name,layout){
 if(!layout||!name.endsWith(layout.suffix))return false;
 const at=name.indexOf(layout.marker);return at>0&&at+layout.marker.length<name.length-layout.suffix.length&&name.indexOf(layout.marker,at+1)<0;
}
export const singleImagePattern=(marker='_ev_lying_',suffix='.png')=>'<1><img="(.+?)'+marker+'(.+?)'+suffix+'"_"(.+?)"><ct="(.+?)"_"(.+?)"_"(.+?)"_"(.+?)">';
export const singleImageTemplate=(marker='_ev_lying_',suffix='.png')=>'<div class="character-clipperEV"><img class="characterImageEV" src="{{raw::$1'+marker+'$2'+suffix+'}}" style="top: $3" loading="lazy"></div></div>';

export function compileSingleImage(source,behavior){
 const rules=source.risuai?.customScripts??[],coverage=[],adaptedRules=new Map();let layout=null;
 const candidates=rules.map((rule,index)=>({rule,index})).filter(({rule})=>rule.type==='editdisplay'&&String(rule.out).includes('characterImageEV'));
 if(!candidates.length)return {layout,coverage,adaptedRules};
 try{
  if(source.ruleOptionsVersion!==1||candidates.length!==1)throw Error('Single-image rules or matching options are ambiguous.');
  const {rule,index}=candidates[0],o=rule.matchOptions??Object.fromEntries(['ableFlag','flag','flags'].filter(k=>Object.hasOwn(rule,k)).map(k=>[k,rule[k]])),input=String(rule.in),marker=/^<1><img="\(\.\+\?\)(_[A-Za-z0-9_-]+_)\(\.\+\?\)(\.(?:png|webp|jpg|jpeg))"/.exec(input);
  if(!marker||input!==singleImagePattern(marker[1],marker[2])||Object.keys(o).some(k=>!['ableFlag','flag','flags'].includes(k))||o.ableFlag!==undefined&&typeof o.ableFlag!=='boolean'||o.ableFlag!==false&&['flag','flags'].some(k=>!['','g',undefined].includes(o[k])))throw Error('Single-image input or flags need review.');
  let output=String(rule.out).trim();
  if(output.startsWith('{{#if ')){
   const gate=/^\{\{#if \{\{greater_equal::\{\{chat_index\}\}::\{\{\? \{\{lastmessageid\}\}-\{\{getvar::([A-Za-z][\w-]*)\}\} \}\}\}\}\}\}/.exec(output);
   const values=String(source.risuai?.defaultVariables??'').split(/\r?\n/).filter(l=>l.startsWith(gate?.[1]+'='));
   if(!gate||!output.endsWith('{{/if}}')||behavior?.maxMessageDepth===undefined||values.length!==1||Number(values[0].split('=')[1])!==behavior.maxMessageDepth)throw Error('Single-image history condition needs review.');
   if(JSON.stringify(source.risuai?.triggerscript??[]).includes('"var":"'+gate[1]+'"')||rules.some(r=>String(r.out).includes('{{setvar::'+gate[1]+'::')))throw Error('Dynamic single-image history condition needs review.');
   output=output.slice(gate[0].length,-'{{/if}}'.length).trim();
  }
  const compact=s=>s.replace(/>\s+</g,'><').trim();
  if(compact(output)!==singleImageTemplate(marker[1],marker[2]))throw Error('Single-image output contains unreviewed bindings or handlers.');
  const css=String(source.risuai?.backgroundHTML??'').replace(/\/\*[\s\S]*?\*\//g,'');
  if(/\.character-clipperEV\b/.test(css))throw Error('Custom single-image clipper styling needs review.');
  const blocks=[...css.matchAll(/\.simpleFrame\s+\.characterImageEV\s*\{([^{}]*)\}/g)];
  if(blocks.length!==1||(css.match(/\.characterImageEV\b/g)??[]).length!==1)throw Error('Single-image geometry is missing or ambiguous.');
  const declarations=Object.create(null);
  for(const raw of blocks[0][1].split(';')){if(!raw.trim())continue;const at=raw.indexOf(':');if(at<0)throw Error('Malformed single-image CSS');const key=raw.slice(0,at).trim(),value=raw.slice(at+1).trim();if(Object.hasOwn(declarations,key))throw Error('Repeated single-image CSS');declarations[key]=value;}
  const allowed=['position','left','top','width','height','object-fit','opacity','transform','animation-name','animation-duration','animation-timing-function','animation-fill-mode','animation-iteration-count','animation-delay','backface-visibility','-webkit-backface-visibility'];
  if(Object.keys(declarations).some(k=>!allowed.includes(k)))throw Error('Additional single-image styling needs review.');
  for(const [key,value]of Object.entries({position:'absolute',left:'50%',top:'60%','object-fit':'contain',transform:'translate(-50%, -50%) translateY(40px)'}))if(declarations[key]?.replace(/\s/g,'')!==value.replace(/\s/g,''))throw Error('Single-image geometry needs review.');
  const size=key=>{const m=/^(\d+(?:\.\d+)?)%$/.exec(declarations[key]??'');return m?Number(m[1]):NaN;};
  layout={version:1,marker:marker[1],suffix:marker[2],width:size('width'),height:size('height')};validateSingleImage(layout);
  adaptedRules.set(index,'Compiled the single-image/vertical-offset layout; no hover asset or click handler is inferred.');
  coverage.push({feature:'Single-image portrait layout',status:'ready',reason:`One centered image fitted to ${layout.width}% × ${layout.height}% of the scene, clipped at its frame. The second image field is a vertical offset.`});
 }catch(e){layout=null;adaptedRules.clear();coverage.push({feature:'Single-image portrait layout',status:'needs-review',reason:e.message});}
 return {layout,coverage,adaptedRules};
}

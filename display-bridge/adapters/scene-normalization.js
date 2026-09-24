// Fixed field-scoped operations. They do not rewrite dialogue or saved output,
// and source expressions are never constructed as executable regular expressions.
import {codeRanges} from '../core/parser.js';
const literal=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const cleanupRules=new Map([['!!(.+?)!!','setup-notes'],['!히로인:(.+?)!','roster-notes']]);
export function compileSceneNormalization(source){
 const normalization={version:1,counts:{},assets:[],backgrounds:[]},adapted=new Map(),warnings=[];
 const assets=(source.assets??[]).filter(a=>/^(png|jpe?g|webp|gif|bmp|avif)$/i.test(a.ext)).map(a=>a.name);
 for(const [i,r]of (source.risuai?.customScripts??[]).entries()){
  const o=r.matchOptions??{};if(o.ableFlag!==false&&![undefined,'','g'].includes(o.flags??o.flag))continue;
  if(r.type==='editdisplay'&&r.out===''&&cleanupRules.has(r.in)){
   normalization.displayCleanup??=[];const kind=cleanupRules.get(r.in);if(!normalization.displayCleanup.includes(kind))normalization.displayCleanup.push(kind);
   adapted.set(i,'Reviewed annotation delimiters are hidden only in the display; saved messages and model context are preserved.');continue;
  }
  if(r.type==='editdisplay'&&r.in==='<0>'&&r.out.trim()==='</div>'){normalization.emptyZero=true;adapted.set(i,'A zero-cast header can finish the scene before ordinary narration.');continue;}
  if(r.type!=='editoutput')continue;
  const from=/^<([5-9])>$/.exec(r.in),to=/^<([0-4])>$/.exec(r.out);
  if(from&&to){if(Object.hasOwn(normalization.counts,from[1])&&normalization.counts[from[1]]!==Number(to[1]))throw Error('Conflicting cast-count corrections.');normalization.counts[from[1]]=Number(to[1]);adapted.set(i,'Cast-count correction applies only to a complete scene with that many portrait tuples.');continue;}
  const names=String(r.in??'').split('|');
  if(names.length<=32&&names.every(literal)&&literal(r.out)&&assets.some(name=>name.includes(r.out))){normalization.assets.push({from:names,to:r.out});adapted.set(i,'Literal spelling substitutions apply only to scene asset names, never prose.');continue;}
  const bg=/^<img src="([A-Za-z0-9_-]+)\(([A-Za-z0-9_|-]+)\)_\((daytime\|dusk\|night\|midnight)\)\.png"$/.exec(r.in);
  if(bg&&r.out==='<img src="'+bg[1]+'$1.png"'&&bg[2].split('|').every(literal)){
   const rows=bg[2].split('|').filter(n=>assets.includes(bg[1]+n+'.png')).map(n=>({from:['daytime','dusk','night','midnight'].map(p=>bg[1]+n+'_'+p+'.png'),to:bg[1]+n+'.png'}));
   if(rows.length){normalization.backgrounds.push(...rows);adapted.set(i,'Declared background aliases resolve only to existing base images.');}
   const missing=bg[2].split('|').length-rows.length;if(missing)warnings.push(`${missing} background alias destination(s) are absent from the asset declarations; those names remain unresolved.`);
  }
 }
 return {normalization:adapted.size?normalization:null,adapted,warnings};
}
export function validateSceneNormalization(n){
 const fail=()=>{throw Error('Scene fragments: invalid normalization');};
 if(!n||n.version!==1||Object.keys(n).some(k=>!['version','counts','assets','backgrounds','emptyZero','displayCleanup'].includes(k))||n.emptyZero!==undefined&&typeof n.emptyZero!=='boolean'||!n.counts||typeof n.counts!=='object'||Array.isArray(n.counts)||Object.entries(n.counts).some(([k,v])=>!/[5-9]/.test(k)||k.length!==1||!Number.isInteger(v)||v<0||v>4))fail();
 if(n.displayCleanup!==undefined&&(!Array.isArray(n.displayCleanup)||n.displayCleanup.length>2||new Set(n.displayCleanup).size!==n.displayCleanup.length||n.displayCleanup.some(k=>!['setup-notes','roster-notes'].includes(k))))fail();
 for(const name of ['assets','backgrounds']){
  if(!Array.isArray(n[name])||n[name].length>64)fail();
  const valid=name==='assets'?literal:x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,256}$/.test(x);
  for(const r of n[name])if(!r||Object.keys(r).some(k=>!['from','to'].includes(k))||!Array.isArray(r.from)||!r.from.length||r.from.length>32||!r.from.every(valid)||!valid(r.to))fail();
 }
}
export function sceneAnnotationRanges(source,normalization){
 const excluded=codeRanges(source),ranges=[];
 for(const kind of normalization?.displayCleanup??[]){
  const pattern=kind==='setup-notes'?/!![^!\r\n]{1,12000}!!/g:/!히로인:[^!\r\n]{1,12000}!/g;
  for(const m of source.matchAll(pattern)){const a=m.index,b=a+m[0].length;if(source[a-1]!=='\\'&&!excluded.some(([x,y])=>a<y&&b>x))ranges.push([a,b]);}
 }
 return ranges.sort((a,b)=>a[0]-b[0]);
}
export function normalizeSceneAsset(name,n,background=false){
 let value=name;
 if(background)for(const r of n?.backgrounds??[])if(r.from.includes(value)){value=r.to;break;}
 for(const r of n?.assets??[]){let next='',at=0;while(at<value.length){const from=r.from.find(s=>value.startsWith(s,at));next+=from?r.to:value[at];at+=from?from.length:1;if(next.length>512)throw Error('Scene asset correction exceeds name limit');}value=next;}
 return value;
}

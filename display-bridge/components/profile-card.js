import { mappedPortraitReference } from '../adapters/portrait-mappings.js';
import { resolveImage } from '../integrations/assets.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function createProfileCard(data,{avatar,resolver=resolveImage}={}){
 const host=el('span');host.className='display-bridge-widget';const root=host.attachShadow({mode:'open'});
 root.append(el('style',`:host{display:block;margin:18px 0;color:inherit}*{box-sizing:border-box}article{font:16px/1.5 system-ui;border:1px solid #8888;border-radius:12px;padding:20px;max-width:900px;background:#80808012}h3{margin:0 0 16px}img{display:block;max-width:180px;max-height:240px;object-fit:contain;margin:0 0 16px}dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:0}dt{font-size:12px;opacity:.7}dd{margin:2px 0;white-space:pre-wrap;overflow-wrap:anywhere}[hidden]{display:none!important}`));
 const card=el('article');card.setAttribute('aria-label','Profile notice');card.append(el('h3',data.speaker));const image=el('img');image.alt=data.speaker;const missing=el('p');card.append(image,missing);const fields=el('dl');for(const [label,value]of data.profileFields){const row=el('div');row.append(el('dt',label),el('dd',value));fields.append(row);}card.append(fields);root.append(card);
 let status='missing',url=null;image.addEventListener('error',()=>{status='load-failed';image.hidden=true;missing.hidden=false;window.dispatchEvent(new Event('display-bridge:image-status'));});
 const reference=mappedPortraitReference(data.config,data.portrait);
 const refresh=()=>{const r=resolver(avatar,reference);if(url!==r.url){url=r.url;status=r.status;if(url)image.src=url;else image.removeAttribute('src');}else if(status!=='load-failed')status=r.status;image.hidden=status!=='resolved';missing.hidden=status==='resolved';missing.textContent='Image unavailable: '+reference;};refresh();
 return {host,refresh,missingImages:()=>status==='resolved'?0:1,imageIssues:()=>status==='resolved'?[]:[{reference,status}]};
}

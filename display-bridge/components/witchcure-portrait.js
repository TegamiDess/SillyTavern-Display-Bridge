import { imageBindings } from './controls.js';
import { resolveWitchcureImage } from '../integrations/witchcure-assets.js';
export function createPortrait(data,{witchcure,avatar,resolver}) {
    const host=document.createElement('span');host.className='display-bridge-widget';host.dataset.adapter=data.type;
    const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');
    style.textContent=witchcure.portraitCSS+`\n:host{display:block;max-width:100%;margin:12px 0;contain:layout paint;}*{box-sizing:border-box}div[class$="-image-wrapper"]{max-width:calc(100% - 20px)}img{max-width:100%} [hidden]{display:none!important}.db-image-placeholder{display:block;min-width:150px;padding:20px;color:#eee;background:#333}@media(prefers-reduced-motion:reduce){*{transition:none!important}}`;
    const t=document.createElement('template');t.innerHTML=witchcure.portraits.find(x=>x.name===data.name).html;shadow.append(style,t.content.cloneNode(true));
    const images=imageBindings(shadow,avatar,(who,name)=>resolveWitchcureImage(who,name,resolver));images.refresh();
    return {host,refresh:images.refresh,missingImages:images.missingImages,imageIssues:images.imageIssues};
}

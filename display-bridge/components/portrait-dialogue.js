import { mappedPortraitReference, appearanceChoices } from '../adapters/portrait-mappings.js';
import { bindPortraitHover } from './portrait-hover.js';
import { createProfileCard } from './profile-card.js';
import { resolveImage } from '../integrations/assets.js';
import { portraitActions } from '../adapters/portrait-dialogue.js';
import { createActionStore } from '../core/actions.js';

const CSS=`
.scene-backdrop{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.8}.cast{position:absolute;inset:0;display:flex;align-items:stretch;justify-content:center;gap:1%;overflow:hidden}.cast-slot{position:relative;flex:1;min-width:0;border:0;padding:0;background:transparent;border-radius:0;cursor:default;pointer-events:none}.cast-slot img{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;pointer-events:auto}.cast-slot .hover-image{opacity:0;pointer-events:none}.cast-slot.portrait-hover .hover-image,.cast-slot:focus-visible .hover-image{opacity:1}.cast-slot.portrait-hover .has-hover,.cast-slot:focus-visible .has-hover{opacity:0}.stage.collapsed .words{display:none}.text-controls{position:relative;z-index:2;display:flex;gap:6px;justify-content:flex-end}.stage.narration{min-height:0;padding-top:12px}.narration .name{display:none}

:host{all:initial;color:inherit;display:block;margin:20px 0;color-scheme:light}*{box-sizing:border-box}[hidden]{display:none!important}
article{font:16px/1.55 system-ui,sans-serif;color:inherit;max-width:920px;margin:auto}button,select{font:600 13px/1.4 system-ui;color:var(--ink);background:var(--paper);border:1px solid var(--accent);border-radius:7px;padding:9px 12px;cursor:pointer;max-width:100%;white-space:normal}button:hover{filter:brightness(.94)}button:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:3px}button:disabled{opacity:.5;cursor:default}
.stage,.toolbar,.console{color:var(--ink)}.stage{position:relative;display:grid;min-height:360px;align-items:end;padding-top:210px}.portrait{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:var(--position) bottom;pointer-events:none}.speech{position:relative;z-index:1;margin:0 3% 12px;border:3px solid var(--accent);border-radius:22px;background:var(--paper);padding:20px 25px;box-shadow:0 5px 16px #0003}.gingham .speech{background-image:repeating-linear-gradient(45deg,transparent 0 12px,#ffffff88 12px 24px),repeating-linear-gradient(-45deg,transparent 0 12px,#ffffff88 12px 24px)}.name{display:block;width:fit-content;max-width:100%;margin:-36px 0 12px;background:var(--paper);border:2px solid var(--accent);padding:4px 12px;font-weight:750;overflow-wrap:anywhere}.words{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto}.toolbar,.options{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.console{background:var(--paper);padding:14px;border:1px solid var(--accent);border-radius:12px}.options label{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.metadata{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 0}.metadata div{flex:1 1 115px;border-top:1px solid var(--accent);padding:8px;overflow-wrap:anywhere}dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em}dd{margin:4px 0;font-weight:650}.missing{position:absolute;inset:20px 10% auto;background:var(--paper);padding:12px;overflow-wrap:anywhere}.plain{white-space:pre-wrap;overflow-wrap:anywhere;color:inherit}.feedback{font:12px/1.4 system-ui;margin:8px 0;color:var(--ink)}.stage.no-image{min-height:0;padding-top:24px}.stage.no-dialogue{min-height:360px;padding-top:0}
/* Layout columns ignore the pointer. Only the fitted base bitmap is a
   stable hit target, even while its alternate expression is visible. */
.cast-slot:hover{filter:none}
.cast-slot:focus-visible{outline:none}
.cast-slot:focus-visible img{outline:3px solid var(--accent);outline-offset:-3px}
/* Narration stays in the same palette, with a quieter, distinct surface. */
.narration .speech{background:color-mix(in srgb,var(--paper) 84%,var(--ink) 16%);border-color:color-mix(in srgb,var(--accent) 60%,var(--ink) 40%);box-shadow:0 3px 10px #0002}
/* The scene is sized independently of its scrollable dialogue overlay. */
.stage.scene{min-height:420px;height:clamp(420px,65vh,600px);padding-top:0}
.scene .speech{padding:12px 18px;background:color-mix(in srgb,var(--paper) 78%,transparent);background-image:none;backdrop-filter:blur(3px)}
.scene .words{max-height:120px}
.scene .text-controls{margin-top:8px}
.scene.expanded .words{max-height:min(60vh,560px)}
.scene.expanded{height:auto;min-height:420px;padding-top:24px}
.scene.no-image{height:auto;min-height:0;padding-top:24px}
.scene.no-dialogue{height:clamp(420px,65vh,600px);padding-top:0}
/* Imported values are validated tokens, never selectors or raw declarations. */
.stage.source-styled{width:var(--panel-width,100%);margin-inline:auto;color:var(--ink);min-height:var(--stage-height,360px)}
.source-styled .portrait{inset:auto auto 0 50%;transform:translateX(-50%);width:auto;height:100%;max-height:var(--portrait-height,100%);max-width:min(100%,var(--portrait-width,100%))}
.source-styled .speech{border-width:var(--border-width,3px);border-radius:var(--radius,22px);padding:var(--pad-y,20px) var(--pad-x,25px)}
.source-styled .words{font-size:var(--font-size,16px);line-height:var(--line-height,1.55);font-weight:var(--font-weight,400)}
.gingham .source-styled:not(.narration) .speech{background-image:repeating-linear-gradient(45deg,transparent 0 10px,color-mix(in srgb,var(--accent) 10%,transparent) 10px 20px),repeating-linear-gradient(-45deg,transparent 0 10px,color-mix(in srgb,var(--accent) 8%,transparent) 10px 20px)}
.source-styled .name{background:var(--name-paper,var(--paper));color:var(--name-ink,var(--ink));font-size:var(--name-font-size,16px);transform:rotate(var(--name-tilt,0deg))}
.narration.source-styled{min-height:0}
.narration.source-styled.source-paper .speech{background:var(--paper)}
.narration.source-styled.source-accent .speech{border-color:var(--accent)}
.stage.source-styled.gradient-paper .speech{background-image:linear-gradient(135deg,var(--paper),var(--paper-end))}
.source-styled.no-image{min-height:0}
.words.bilingual{display:grid}.bilingual>span{grid-area:1/1;min-width:0}.bilingual>[aria-hidden="true"]{visibility:hidden}.language-hint{display:block;font-size:11px;font-weight:400;opacity:.8;margin-top:6px}

`;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function createPortraitDialogue(data,{avatar,resolver=resolveImage,presetState,stateFor}={}){
    if(data.suppressed){const host=el('span');host.className='display-bridge-widget';host.hidden=true;return {host,refresh(){},missingImages:()=>0,imageIssues:()=>[]};}
    if(data.presentation==='profile')return createProfileCard(data,{avatar,resolver});
    const host=el('span');host.className='display-bridge-widget';const shadow=host.attachShadow({mode:'open'});shadow.append(el('style',CSS));
    const article=el('article');article.setAttribute('aria-label','Portrait and dialogue');shadow.append(article);
    const c=data.config,t=c.theme;for(const [k,v] of Object.entries({accent:t.accent,paper:t.background,ink:t.text,position:t.position}))article.style.setProperty('--'+k,v);
    article.classList.toggle('gingham',(data.style?.pattern??t.pattern)==='gingham');
    const stage=el('div');stage.className='stage';
    if(data.style){
        stage.classList.add('source-styled');
        const tokens={accent:'accent',background:'paper',backgroundEnd:'paper-end',text:'ink',nameBackground:'name-paper',nameText:'name-ink',borderWidth:'border-width',radius:'radius',padX:'pad-x',padY:'pad-y',fontSize:'font-size',lineHeight:'line-height',fontWeight:'font-weight',nameFontSize:'name-font-size',nameTilt:'name-tilt',width:'panel-width',stageHeight:'stage-height',portraitHeight:'portrait-height',portraitWidth:'portrait-width'};
        const px=new Set(['borderWidth','radius','padX','padY','fontSize','nameFontSize']);
        for(const [key,value]of Object.entries(data.style))if(tokens[key])stage.style.setProperty('--'+tokens[key],String(value)+(px.has(key)?'px':key==='width'?'%':key==='nameTilt'?'deg':''));
        if(data.style.backgroundEnd)stage.classList.add('gradient-paper');
        if(data.style.background)stage.classList.add('source-paper');
        if(data.style.accent)stage.classList.add('source-accent');
    }
    const image=el('img');image.className='portrait';image.alt=data.speaker;
    const missing=el('p');missing.className='missing';const speech=el('section');speech.className='speech';speech.setAttribute('aria-label','Dialogue');
    const name=el('span',data.speaker);name.className='name';name.hidden=!data.speaker;const words=el('p',data.dialogue);words.className='words';words.tabIndex=0;speech.append(name,words);stage.append(image,missing,speech);
    if(data.translatedDialogue){
        const translated=el('span',data.translatedDialogue),original=el('span',data.originalDialogue),hint=el('small','Translation · hover or focus for original');hint.className='language-hint';words.classList.add('bilingual');words.replaceChildren(translated,original);speech.append(hint);
        let hovering=false,focused=false;
        const show=()=>{const active=hovering||focused;translated.setAttribute('aria-hidden',String(active));original.setAttribute('aria-hidden',String(!active));};
        speech.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;hovering=true;show();});speech.addEventListener('pointerleave',()=>{hovering=false;show();});
        words.addEventListener('focus',()=>{focused=true;show();});words.addEventListener('blur',()=>{focused=false;show();});show();
    }
    const assets=[{image,reference:data.portrait,status:'missing',url:null}];
    if(data.presentation==='scene'){
        stage.classList.add('scene');image.remove();assets.length=0;
        if(data.background){const background=el('img');background.className='scene-backdrop';background.alt='';stage.prepend(background);assets.push({image:background,reference:data.background,status:'missing',url:null});}
        const cast=el('div');cast.className='cast';stage.insertBefore(cast,missing);
        for(const p of data.portraits){const slot=el('button');slot.type='button';slot.className='cast-slot';slot.setAttribute('aria-label',p.label??p.image);slot.title=p.label??p.image;const base=el('img');base.alt=p.label??p.image;slot.append(base);const hoverTarget=bindPortraitHover(slot,base);assets.push({hoverTarget,image:base,reference:p.image,status:'missing',url:null});if(p.hover){const hover=el('img');hover.alt='';hover.className='hover-image';slot.append(hover);assets.push({image:hover,reference:p.hover,status:'missing',url:null,base});}cast.append(slot);}
    }
    const isTextOnly=['narration','metadata'].includes(data.presentation);
    if(isTextOnly){assets.length=0;image.remove();missing.hidden=true;stage.classList.add('narration');speech.setAttribute('aria-label','Narration');}
    const textControls=el('div');textControls.className='text-controls';
    if(data.presentation==='scene')for(const [label,cls]of [['Expand dialogue','expanded'],['Collapse dialogue','collapsed']]){const control=el('button',label);control.type='button';control.setAttribute('aria-pressed','false');control.addEventListener('click',()=>{const on=stage.classList.toggle(cls);control.setAttribute('aria-pressed',String(on));});textControls.append(control);}
    speech.append(textControls);
    const plain=el('p',`${data.speaker?data.speaker+': ':''}${data.dialogue}`);plain.className='plain';
    const toolbar=el('nav');toolbar.className='toolbar';toolbar.setAttribute('aria-label','Display controls');
    const console=el('section');console.className='console';console.setAttribute('aria-label','Scene settings');
    const options=el('div');options.className='options';const label=el('label',c.variantLabel);const select=el('select');select.setAttribute('aria-label',c.variantLabel);
    for(const v of appearanceChoices(c)){const option=el('option',v.label);option.value=v.id;select.append(option);}label.append(select);options.append(label);label.hidden=!c.variants.length;
    const metadata=el('dl');metadata.className='metadata';for(const field of ['time','day','date','location'])if(data[field]){const row=el('div');row.append(el('dt',c.metadataLabels?.[field]??field),el('dd',data[field]));metadata.append(row);}
    const feedback=el('p','Display choices affect this chat only; story text is unchanged.');feedback.className='feedback';feedback.setAttribute('aria-live','polite');
    console.append(options,metadata,feedback);article.append(stage,plain,toolbar,console);
    const definition=portraitActions(c);
    const state=presetState??stateFor?.(definition,()=>host.isConnected)??createActionStore().bind(definition,'preview');
    const controls=new Map();
    function dispatch(action){try{if(state.dispatch(action)){refresh();}}catch(e){feedback.textContent=e.message;}}
    function button(text,action,parent=toolbar){const b=el('button',text);b.type='button';b.addEventListener('click',()=>dispatch(action));parent.append(b);controls.set(action,b);return b;}
    button('Visual layout','visual');button('Portrait','image');button('Dialogue','dialogue');button('Scene settings','console');button('Reset display','reset',options);
    const undo=el('button','Undo display change');undo.type='button';undo.addEventListener('click',()=>{if(state.undo?.()){refresh();}});options.append(undo);
    select.addEventListener('change',()=>dispatch('choose-'+select.value));
    for(const asset of assets)if(asset.base)asset.image.addEventListener('load',()=>{refresh();});
    for(const asset of assets)asset.image.addEventListener('error',()=>{asset.status='load-failed';refresh();window.dispatchEvent(new Event('display-bridge:image-status'));});
    function refresh(){
        const s=state.read();plain.hidden=s.visual||!s.dialogue;stage.hidden=!s.visual||(!s.image&&!s.dialogue);speech.hidden=!s.dialogue;console.hidden=!s.console;
        stage.classList.toggle('no-image',!s.image);stage.classList.toggle('no-dialogue',!s.dialogue);select.value=s.variant;
        for(const [key,b] of controls)if(key!=='reset')b.setAttribute('aria-pressed',String(s[key]));
        undo.disabled=!state.canUndo?.();
        for(const asset of assets){const reference=mappedPortraitReference(c,asset.reference,s.variant);asset.activeReference=reference;const resolved=resolver(avatar,reference);if(resolved.url!==asset.url){asset.hoverTarget?.clear();asset.url=resolved.url??null;asset.status=resolved.status;if(asset.url)asset.image.src=asset.url;else asset.image.removeAttribute('src');}else if(asset.status!=='load-failed')asset.status=resolved.status;asset.image.hidden=!s.image||asset.status!=='resolved';if(asset.image.hidden)asset.hoverTarget?.clear();if(asset.base)asset.base.classList.toggle('has-hover',asset.status==='resolved'&&asset.image.complete&&asset.image.naturalWidth>0);}
        const failed=assets.filter(a=>a.status!=='resolved');missing.hidden=!s.image||!failed.length;missing.textContent=failed.length?'Image unavailable: '+failed.map(a=>a.activeReference).join(', '):'';
        if(isTextOnly){stage.hidden=!s.visual||!s.dialogue||data.presentation==='metadata';missing.hidden=true;toolbar.hidden=data.presentation==='narration';console.hidden=data.presentation==='narration'||!s.console;plain.hidden=s.visual||!s.dialogue||data.presentation==='metadata';}
        if(data.controls===false){toolbar.hidden=true;options.hidden=true;feedback.hidden=true;console.hidden=!s.console||!metadata.childElementCount;}

    }
    refresh();return {host,refresh,missingImages:()=>state.read().visual&&state.read().image?assets.filter(a=>a.status!=='resolved').length:0,imageIssues:()=>assets.filter(a=>a.status!=='resolved').map(a=>({reference:a.activeReference,status:a.status}))};
}

import { createSceneControls, SCENE_CONTROLS_CSS } from './scene-controls.js';
import { mappedPortraitReference, appearanceChoices } from '../adapters/portrait-mappings.js';
import { bindPortraitHover } from './portrait-hover.js';
import { createProfileCard } from './profile-card.js';
import { resolveImage } from '../integrations/assets.js';
import { portraitActions } from '../adapters/portrait-dialogue.js';
import { createActionStore } from '../core/actions.js';

const CSS=`
.scene-backdrop{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.8}.cast{position:absolute;inset:0;display:flex;align-items:stretch;justify-content:center;gap:1%;overflow:hidden}.cast-slot{position:relative;flex:1;min-width:0;border:0;padding:0;background:transparent;border-radius:0;cursor:default;pointer-events:none}.cast-slot img{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;pointer-events:auto}.cast-slot .hover-image{opacity:0;pointer-events:none}.cast-slot.portrait-hover .hover-image,.cast-slot:focus-visible .hover-image{opacity:1}.cast-slot.portrait-hover .has-hover,.cast-slot:focus-visible .has-hover{opacity:0}.stage.collapsed .speech{display:none}.stage.collapsed .words{display:none}.text-controls{position:relative;z-index:2;display:flex;gap:6px;justify-content:flex-end}.stage.narration{min-height:0;padding-top:12px}.narration .name{display:none}

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
.scene .text-controls{position:absolute;z-index:5;right:3%;bottom:4px;margin:0}.scene .speech{margin-bottom:52px}
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
.scene{isolation:isolate;overflow:hidden}.scene-backdrop{z-index:1;pointer-events:none}.scene-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}.scene-layer.sky{z-index:0}.scene-layer.effect{z-index:2}.scene .cast{z-index:3}.scene .speech{z-index:4}.scene .missing{z-index:6}.scene-label{position:absolute;top:10px;left:12px;z-index:5;background:#172333ba;color:#fff;padding:3px 8px;border-radius:5px;max-width:80%;overflow-wrap:anywhere;pointer-events:none}.scene.period-dusk .scene-backdrop{filter:sepia(.15) brightness(.92)}.scene.period-night .scene-backdrop{filter:brightness(.72)}.scene.period-midnight .scene-backdrop{filter:brightness(.58)}
/* Reviewed source clip-space: a 60% portrait band and a 40px settling offset.
   The actual bitmap remains fitted, so alpha hit testing has no letterbox. */
.cast-slot.positioned img{bottom:auto;top:calc(var(--cast-origin) + var(--cast-top) + 40px);transform:translate(-50%,-50%);max-height:54%;max-width:90%}
.portrait-tooltip{position:absolute;left:5%;right:5%;bottom:35%;z-index:7;background:#172333eb;color:#fff;border:1px solid #8394aa;border-radius:6px;padding:8px;white-space:pre-wrap;font:13px/1.4 system-ui;overflow-wrap:anywhere;pointer-events:none;visibility:hidden}.cast-slot.portrait-hover .portrait-tooltip,.cast-slot:focus-visible .portrait-tooltip{visibility:visible}
.words .scene-narration{color:color-mix(in srgb,currentColor 78%,var(--accent));font-style:italic}
/* fullBgImage2/3 are the environment behind an opaque inset scene. Keep
   them outside the stage's clipping/portrait coordinate space. */
article.environment-scene{max-width:none;width:100%}
.environment{position:relative;isolation:isolate;padding:12% 4% 3%;overflow:hidden;background:#31333f}
.environment>.scene-layer{z-index:0;object-position:center top}
.environment>.scene-layer.effect{z-index:1}
.environment::after{content:'';position:absolute;inset:0;z-index:2;background:linear-gradient(transparent 35%,#31333fcc);pointer-events:none}
.environment>.stage.scene{z-index:3;width:100%;height:auto;min-height:280px;aspect-ratio:16/9;padding:0;border:clamp(8px,1.4vw,24px) solid #afe3fa;border-bottom-color:#fff;border-radius:12px}
.environment .scene-backdrop{opacity:1}
.environment .scene-label{top:auto;bottom:6px;background:transparent;font-size:24px;font-weight:750;text-shadow:0 2px 4px #000}
.scene-clock{position:absolute;top:8px;left:10px;z-index:5;background:#171b20b3;color:#e5f6ff;border-radius:7px;padding:6px 10px;max-width:85%;overflow-wrap:anywhere}
.environment .speech{width:76%;margin:0 auto 40px;border:1px solid #ffffff26;border-radius:10px;background:#20252dcc;color:#d8e9f5;backdrop-filter:none;box-shadow:none}
.environment .words{max-height:clamp(100px,12vw,170px)}
.environment .scene.expanded .speech{width:90%;max-height:calc(100% - 60px)}
.environment .scene.expanded .words{max-height:clamp(160px,36vw,65vh)}
.environment .text-controls{right:12%;bottom:4px}
.environment .text-controls button{padding:5px 9px;font-weight:400}
.environment .cast{padding-inline:4%;gap:0}
.environment .cast.cast-2{padding-inline:14%}
.environment .cast.cast-1{padding-inline:25%}
.environment .cast-slot.positioned.relative-position img{top:var(--cast-top);height:90%;max-height:90%;max-width:90%}

`;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function appendRuns(target,runs){for(const run of runs){let content=document.createTextNode(run.text);for(const mark of run.marks){if(!['strong','em','u','s'].includes(mark))continue;const node=el(mark);node.append(content);content=node;}const span=el('span');if(run.kind==='narration')span.className='scene-narration';span.append(content);target.append(span);}}
export function createPortraitDialogue(data,{avatar,resolver=resolveImage,presetState,stateFor,mediaFor}={}){
    if(data.suppressed){const host=el('span');host.className='display-bridge-widget';host.hidden=true;return {host,refresh(){},missingImages:()=>0,imageIssues:()=>[]};}
    if(data.presentation==='profile')return createProfileCard(data,{avatar,resolver});
    const host=el('span');host.className='display-bridge-widget';const shadow=host.attachShadow({mode:'open'});shadow.append(el('style',CSS+SCENE_CONTROLS_CSS));
    const article=el('article');article.setAttribute('aria-label','Portrait and dialogue');shadow.append(article);
    const c=data.config,t=c.theme;for(const [k,v] of Object.entries({accent:t.accent,paper:t.background,ink:t.text,position:t.position}))article.style.setProperty('--'+k,v);
    article.classList.toggle('gingham',(data.style?.pattern??t.pattern)==='gingham');
    const stage=el('div');stage.className='stage';
    const framed=data.presentation==='scene'&&c.format?.details?.layers===true;
    const environment=framed?el('div'):null;
    if(environment){environment.className='environment';article.classList.add('environment-scene');}
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
    const name=el('span',data.speaker);name.className='name';name.hidden=!data.speaker;const words=el(data.dialogueRuns?'div':'p',data.dialogueRuns?undefined:data.dialogue);if(data.dialogueRuns)appendRuns(words,data.dialogueRuns);words.className='words';words.tabIndex=0;speech.append(name,words);stage.append(image,missing,speech);
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
        if(['daytime','dusk','night','midnight'].includes(data.period))stage.classList.add('period-'+data.period);
        if(data.sceneLabel){const label=el('span',data.sceneLabel);label.className='scene-label';stage.append(label);}
        for(const layer of data.layers??[]){const node=el('img');node.className='scene-layer '+layer.role;node.alt='';node.style.opacity=String(layer.opacity);(environment??stage).append(node);assets.push({image:node,reference:layer.asset,status:'missing',url:null});}
        if(framed&&data.time){const clock=el('span',data.time);clock.className='scene-clock';clock.setAttribute('aria-label','Scene time');stage.append(clock);}
        if(data.background){const background=el('img');background.className='scene-backdrop';background.alt='';stage.prepend(background);assets.push({image:background,reference:data.background,status:'missing',url:null});}
        const cast=el('div');cast.className='cast cast-'+data.portraits.length;stage.insertBefore(cast,missing);
        for(const p of data.portraits){const slot=el('button');slot.type='button';slot.className='cast-slot';slot.setAttribute('aria-label',p.label??p.image);if(!p.tooltips?.length)slot.title=p.label??p.image;
            if(p.offset){slot.classList.add('positioned');slot.classList.toggle('relative-position',p.offset.unit==='%');slot.style.setProperty('--cast-origin',p.geometry==='five'?'55.7%':'32%');slot.style.setProperty('--cast-top',String(p.offset.value*(p.offset.unit==='%'&&!framed?.6:1))+p.offset.unit);}
            const base=el('img');base.alt=p.label??p.image;slot.append(base);const hoverTarget=bindPortraitHover(slot,base);assets.push({hoverTarget,image:base,reference:p.image,status:'missing',url:null});if(p.hover){const hover=el('img');hover.alt='';hover.className='hover-image';slot.append(hover);assets.push({image:hover,reference:p.hover,status:'missing',url:null,base});}
            if(p.tooltips?.length){const tip=el('span',p.tooltips.join('\n'));tip.id='scene-tip-'+crypto.randomUUID();tip.className='portrait-tooltip';tip.setAttribute('role','tooltip');slot.setAttribute('aria-describedby',tip.id);slot.append(tip);}cast.append(slot);}
    }
    const isTextOnly=['narration','metadata'].includes(data.presentation);
    if(isTextOnly){assets.length=0;image.remove();missing.hidden=true;stage.classList.add('narration');speech.setAttribute('aria-label','Narration');}
    const textControls=el('div');textControls.className='text-controls';
    if(data.presentation==='scene')for(const [label,cls]of [['Expand dialogue','expanded'],['Collapse dialogue','collapsed']]){const control=el('button',label);control.type='button';control.setAttribute('aria-pressed','false');control.addEventListener('click',()=>{const on=stage.classList.toggle(cls);control.setAttribute('aria-pressed',String(on));if(cls==='collapsed'){control.textContent=on?'Show dialogue':label;stage.classList.remove('expanded');textControls.firstChild.setAttribute('aria-pressed','false');}else if(on){stage.classList.remove('collapsed');textControls.lastChild.textContent='Collapse dialogue';textControls.lastChild.setAttribute('aria-pressed','false');}});textControls.append(control);}
    if(data.presentation==='scene')stage.append(textControls);
    const plain=el('p',data.dialogueRuns?undefined:`${data.speaker?data.speaker+': ':''}${data.dialogue}`);if(data.dialogueRuns)appendRuns(plain,data.dialogueRuns);plain.className='plain';
    const toolbar=el('nav');toolbar.className='toolbar';toolbar.setAttribute('aria-label','Display controls');
    const console=el('section');console.className='console';console.setAttribute('aria-label','Scene settings');
    const options=el('div');options.className='options';const label=el('label',c.variantLabel);const select=el('select');select.setAttribute('aria-label',c.variantLabel);
    for(const v of appearanceChoices(c)){const option=el('option',v.label);option.value=v.id;select.append(option);}label.append(select);options.append(label);label.hidden=!c.variants.length;
    const metadata=el('dl');metadata.className='metadata';for(const field of ['time','day','date','location'])if(data[field]&&!(framed&&field==='time')){const row=el('div');row.append(el('dt',c.metadataLabels?.[field]??field),el('dd',data[field]));metadata.append(row);}
    const feedback=el('p','Display choices affect this chat only; story text is unchanged.');feedback.className='feedback';feedback.setAttribute('aria-live','polite');
    console.append(options,metadata,feedback);if(environment)environment.append(stage);article.append(environment??stage,plain,toolbar,console);
    const definition=portraitActions(c);
    const state=presetState??stateFor?.(definition,()=>host.isConnected)??createActionStore().bind(definition,'preview');
    const extras=createSceneControls(data,{avatar,resolver,state,media:mediaFor?.(data,host)});if(extras)article.append(extras.host);
    const controls=new Map();
    function dispatch(action){try{if(state.dispatch(action)){refresh();}}catch(e){feedback.textContent=e.message;}}
    function button(text,action,parent=toolbar){const b=el('button',text);b.type='button';b.addEventListener('click',()=>dispatch(action));parent.append(b);controls.set(action,b);return b;}
    button('Visual layout','visual');button('Portrait','image');button('Dialogue','dialogue');button('Scene settings','console');button('Reset display','reset',options);
    const undo=el('button','Undo display change');undo.type='button';undo.addEventListener('click',()=>{if(state.undo?.()){refresh();}});options.append(undo);
    select.addEventListener('change',()=>dispatch('choose-'+select.value));
    for(const asset of assets)if(asset.base)asset.image.addEventListener('load',()=>{refresh();});
    for(const asset of assets)asset.image.addEventListener('error',()=>{asset.status='load-failed';refresh();window.dispatchEvent(new Event('display-bridge:image-status'));});
    function refresh(){
        extras?.refresh();
        const s=state.read();plain.hidden=s.visual||!s.dialogue;stage.hidden=!s.visual||(!s.image&&!s.dialogue);speech.hidden=!s.dialogue;console.hidden=!s.console;
        if(data.backgroundOnly){speech.hidden=true;textControls.hidden=true;plain.hidden=true;}
        stage.classList.toggle('no-image',!s.image);stage.classList.toggle('no-dialogue',!s.dialogue);select.value=s.variant;
        for(const [key,b] of controls)if(key!=='reset')b.setAttribute('aria-pressed',String(s[key]));
        undo.disabled=!state.canUndo?.();
        for(const asset of assets){const reference=mappedPortraitReference(c,asset.reference,s.variant);asset.activeReference=reference;const resolved=resolver(avatar,reference);if(resolved.url!==asset.url){asset.hoverTarget?.clear();asset.url=resolved.url??null;asset.status=resolved.status;if(asset.url)asset.image.src=asset.url;else asset.image.removeAttribute('src');}else if(asset.status!=='load-failed')asset.status=resolved.status;asset.image.hidden=!s.image||asset.status!=='resolved';if(asset.image.hidden)asset.hoverTarget?.clear();if(asset.base)asset.base.classList.toggle('has-hover',asset.status==='resolved'&&asset.image.complete&&asset.image.naturalWidth>0);}
        const failed=assets.filter(a=>a.status!=='resolved');missing.hidden=!s.image||!failed.length;missing.textContent=failed.length?'Image unavailable: '+failed.map(a=>a.activeReference).join(', '):'';
        if(isTextOnly){stage.hidden=!s.visual||!s.dialogue||data.presentation==='metadata';missing.hidden=true;toolbar.hidden=data.presentation==='narration';console.hidden=data.presentation==='narration'||!s.console;plain.hidden=s.visual||!s.dialogue||data.presentation==='metadata';}
        if(data.controls===false){toolbar.hidden=true;options.hidden=true;feedback.hidden=true;console.hidden=!s.console||!metadata.childElementCount;}
        if(environment)environment.hidden=stage.hidden;

    }
    refresh();return {host,refresh,dispose:()=>extras?.dispose(),missingImages:()=>state.read().visual&&state.read().image?[...assets,...(extras?.images??[])].filter(a=>a.status!=='resolved').length:0,imageIssues:()=>[...assets,...(extras?.images??[])].filter(a=>a.status!=='resolved').map(a=>({reference:a.activeReference,status:a.status}))};
}

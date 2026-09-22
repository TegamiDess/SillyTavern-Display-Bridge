import { createActionStore } from '../core/actions.js';
import { resolveImage } from '../integrations/assets.js';
import { DEFAULT_PRESET, validatePortraitPreset, parsePortraitDialogue, portraitActions } from '../adapters/portrait-dialogue.js';
import { createPortraitDialogue } from './portrait-dialogue.js';
import { createImageMappingEditor } from './image-mapping-editor.js';

export function createPresetEditor({source=DEFAULT_PRESET,avatar,sample='',review,close}){
    source=validatePortraitPreset(source);
    const host=document.createElement('section');host.className='db-preset-editor';host.setAttribute('aria-label','Portrait preset setup');
    const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
    const status=node('p');status.setAttribute('aria-live','polite');status.className='db-editor-status';
    const button=(label,fn,parent=host)=>{const b=node('button',label);b.type='button';b.className='menu_button';b.addEventListener('click',()=>{try{fn();}catch(e){status.textContent=e.message;}});parent.append(b);return b;};
    const input=(parent,label,value,type='text')=>{const wrap=node('label',label),control=node(type==='textarea'?'textarea':type==='select'?'select':'input');if(!['textarea','select'].includes(type))control.type=type;control.classList.add('text_pole');control.setAttribute('aria-label',label);if(type==='checkbox'){wrap.classList.add('db-editor-check');control.checked=value;}else control.value=value;wrap.append(control);parent.append(wrap);return control;};
    const group=label=>{const f=node('fieldset');f.append(node('legend',label));host.append(f);return f;};
    host.append(node('h4','Set up portrait and dialogue'),node('p','Choose exact image mappings and appearance options. Preview the draft, then stage it for review. Story text and source scripts are unchanged.'));
    let inventory={status:'unavailable',images:[]};
    try{const api=globalThis.v3sprites?.api;if(api?.apiVersion===1&&typeof api.listImages==='function')inventory=api.listImages({avatar});}catch{/* Manual names remain available. */}
    const suggestions=(Array.isArray(inventory?.images)?inventory.images:[]).map(x=>x.name).filter(x=>typeof x==='string'&&x.length<=256).slice(0,2000);
    const message=sample||'[Scene|speaker:Alex|text:The observatory opens at dusk.|image:alex]';
    const references=new Set(source.format.entries?.map(e=>e.portrait).filter(Boolean)??[]);
    const identityLabels=Object.create(null);
    for(const e of source.format.entries??[])if(e.portrait)identityLabels[e.portrait]=e.speaker||e.portrait;
    for(const b of parsePortraitDialogue(message,source).blocks){if(b.portrait){references.add(b.portrait);identityLabels[b.portrait]??=b.speaker||b.portrait;}if(b.background){references.add(b.background);identityLabels[b.background]??='Scene background';}for(const p of b.portraits??[]){references.add(p.image);identityLabels[p.image]??=p.label||p.image;if(p.hover){references.add(p.hover);identityLabels[p.hover]??=(p.label||p.image)+' (hover)';}}}
    for(const name of Object.keys(source.portraitLabels??{}))references.add(name);
    for(const v of source.variants)for(const name of Object.keys(v.images))references.add(name);
    Object.assign(identityLabels,source.portraitLabels??{});
    for(const name of references)if(!suggestions.includes(name))suggestions.push(name);
    host.append(node('p',inventory?.status==='available'?`${inventory.images.length} asset names available${inventory.truncated?' (list limited to 2,000)':''}. Names are suggestions; no similar-name matching is performed.`:'Asset suggestions are unavailable. Enter exact names, or update/enrol the card with V3 Asset Sprites.'));
    if(references.size)host.append(node('p','References in this profile/sample: '+[...references].slice(0,30).join(', ')));
    const general=createImageMappingEditor({avatar,initial:source.imageMappings,suggestions,title:'Default image replacements'});host.append(general.host);
    const community=source.format.kind==='community';
    const appearances=group('Appearance choices'),variantLabel=input(appearances,'Appearance selector label',source.variantLabel),optionList=node('div');
    appearances.append(node('p','Each option changes all of its listed portraits together. Choose the image for each character; the original references stay unchanged. Empty rows use the usual image mapping.'));
    const requiredOutfit=input(appearances,'Always use an outfit (hide As written)',source.appearance?.allowOriginal===false,'checkbox');
    const defaultVariant=input(appearances,'Default appearance','','select');
    appearances.append(node('p','The default is used for new chats, Reset display and selections removed from the profile. Existing valid choices are kept.'));
    const identities=node('details');identities.append(node('summary','Character labels and original references'));appearances.append(identities);
    const identityInputs=new Map();
    for(const reference of [...references].slice(0,200)){
        const row=node('div');row.append(node('p','Original reference: '+reference));identityLabels[reference]=(identityLabels[reference]??reference).slice(0,80);const name=input(row,'Character label for '+reference,identityLabels[reference]);name.maxLength=80;identityInputs.set(reference,name);
        name.addEventListener('input',()=>{identityLabels[reference]=name.value;for(const r of optionList.children)r.option.mappings.refreshLabels();});identities.append(row);
    }
    appearances.append(optionList);
    function updateDefaults(preferred=defaultVariant.value){
        defaultVariant.replaceChildren();
        const choices=[...(!requiredOutfit.checked?[{id:'original',label:'As written'}]:[]),...[...optionList.children].map(row=>({id:row.option.id,label:row.option.label.value||'Unnamed outfit'}))];
        for(const v of choices){const o=node('option',v.label);o.value=v.id;defaultVariant.append(o);}if(choices.some(v=>v.id===preferred))defaultVariant.value=preferred;
    }
    requiredOutfit.addEventListener('change',()=>updateDefaults());
    function option(v={id:'option-'+crypto.randomUUID(),label:'',images:{}},expanded=false){
        const row=node('details');row.className='db-appearance-option';row.open=expanded;const heading=node('summary',v.label.trim()||'New appearance option');row.append(heading);
        const label=input(row,'Option label',v.label);label.maxLength=80;
        const mappings=createImageMappingEditor({avatar,initial:v.images,suggestions,title:'Images for this option',knownReferences:[...identityInputs.keys()],referenceLabels:identityLabels});row.append(mappings.host);
        row.option={id:v.id,label,mappings};label.addEventListener('input',()=>{heading.textContent=label.value.trim()||'New appearance option';updateDefaults();});button('Remove appearance option',()=>{row.remove();updateDefaults();},row);optionList.append(row);updateDefaults();
    }
    for(const v of source.variants)option(v);
    updateDefaults(source.appearance?.defaultVariant??'original');
    button('Add appearance option',()=>{if(optionList.childElementCount>=32)throw Error('At most 32 appearance options are supported.');option(undefined,true);},appearances);
    appearances.hidden=community;
    const bindings=group('Message bindings');const fields={};let kind,open,end;
    if(['fields','json'].includes(source.format.kind)){
        kind=input(bindings,'Message format','','select');for(const value of ['fields','json']){const o=node('option',value==='fields'?'Named fields separated by |':'JSON object');o.value=value;kind.append(o);}kind.value=source.format.kind;
        open=input(bindings,'Opening marker',source.format.open);end=input(bindings,'Closing marker',source.format.close);
        for(const field of ['speaker','dialogue','portrait','time','day','date','location'])fields[field]=input(bindings,field[0].toUpperCase()+field.slice(1)+' field',source.format.fields[field]??'');
    }else if(source.format.kind==='tagged'){
        source.format.entries.forEach((e,i)=>{bindings.append(node('p',`${e.kind}: ${e.tag??'portrait-name tags'}`));if(e.speaker)fields[i]=input(bindings,'Speaker label for '+(e.tag??'portrait-name tags'),e.speaker);});
        bindings.append(node('p','Tag grammar, source styles and status field order are preserved. Image replacements above use the original source image names.'));
    }else bindings.append(node('p',source.format.kind==='scene-fragments'?'Recognized background, cast, dialogue and status fragments are assembled within each message. Source offsets, effect layers and scripts remain excluded. Exact image replacements work for background and hover images.':community?'The reviewed profile format supplies its eleven text fields.':'The scene supplies background, portraits, speaker, dialogue and time/day/date/location fields. Background and hover images can also be replaced by exact name.'));
    const metadata=group('Metadata labels'),metadataInputs={};
    for(const k of ['time','day','date','location'])metadataInputs[k]=input(metadata,k[0].toUpperCase()+k.slice(1)+' label',source.metadataLabels?.[k]??k);
    metadata.hidden=community;
    const visibility=group('Initial display choices'),defaults={};visibility.append(node('p','Used for new chat preferences and Reset display. Existing saved choices are retained.'));
    for(const [key,label]of [['visual','Start with visual layout'],['image','Show portraits initially'],['dialogue','Show dialogue initially'],['console','Show scene settings initially']])defaults[key]=input(visibility,label,source.defaults?.[key]??true,'checkbox');visibility.hidden=community;
    const themeGroup=group('Global palette'),themeInputs={};themeGroup.append(node('p','Speakers with imported style tokens retain their own palettes.'));for(const k of ['accent','background','text'])themeInputs[k]=input(themeGroup,k[0].toUpperCase()+k.slice(1)+' colour',source.theme[k],'color');themeGroup.hidden=community;
    const sampleInput=input(host,'Sample message',message,'textarea');
    const allowMissing=input(host,'Allow unresolved replacement images when staging',false,'checkbox');
    const preview=node('div');preview.className='db-editor-preview';
    function config(){
        const next=JSON.parse(JSON.stringify(source)),mappings=general.read();
        if(Object.keys(mappings).length||source.imageMappings!==undefined)next.imageMappings=mappings;
        if(!community){
            next.theme={...source.theme,...Object.fromEntries(Object.entries(themeInputs).map(([k,n])=>[k,n.value]))};
            next.variantLabel=variantLabel.value.trim();const labels=new Set();next.variants=[...optionList.children].map(row=>{const v=row.option,label=v.label.value.trim();if(!label||labels.has(label))throw Error('Each appearance option needs a distinct, nonempty label.');labels.add(label);return {id:v.id,label,images:v.mappings.read()};});
            if(source.appearance!==undefined||requiredOutfit.checked||defaultVariant.value!=='original')next.appearance={allowOriginal:!requiredOutfit.checked,defaultVariant:defaultVariant.value};
            const portraitLabels=Object.assign(Object.create(null),source.portraitLabels);for(const [reference,n] of identityInputs){const value=n.value.trim();if(!value)throw Error('Character labels cannot be empty.');if(value!==reference||Object.hasOwn(portraitLabels,reference))portraitLabels[reference]=value;}
            if(Object.keys(portraitLabels).length)next.portraitLabels=portraitLabels;
            const metadataValues=Object.fromEntries(Object.entries(metadataInputs).map(([k,n])=>[k,n.value.trim()]));if(source.metadataLabels!==undefined||Object.entries(metadataValues).some(([k,v])=>v!==k))next.metadataLabels=metadataValues;
            const values=Object.fromEntries(Object.entries(defaults).map(([k,n])=>[k,n.checked]));if(source.defaults!==undefined||Object.values(values).includes(false))next.defaults=values;
        }
        if(kind)next.format={kind:kind.value,open:open.value,close:end.value,fields:Object.fromEntries(Object.entries(fields).filter(([,n])=>n.value).map(([k,n])=>[k,n.value]))};
        else if(next.format.kind==='tagged')for(const [i,n]of Object.entries(fields))next.format.entries[i].speaker=n.value;
        return validatePortraitPreset(next);
    }
    const unresolved=()=>[...new Set([...general.unresolved(),...(!community?[...optionList.children].flatMap(row=>row.option.mappings.unresolved()):[])])];
    const controls=node('div');controls.className='db-editor-controls';host.append(controls);
    button('Preview mapped message',()=>{
        const c=config(),parsed=parsePortraitDialogue(sampleInput.value,c),state=createActionStore().bind(portraitActions(c),'mapping-preview');let widgets=[];const shared={read:()=>state.read(),dispatch(action){const changed=state.dispatch(action);for(const w of widgets)w.refresh();return changed;}};widgets=parsed.blocks.map(b=>createPortraitDialogue(b,{avatar,presetState:shared}));preview.replaceChildren(...widgets.map(w=>w.host));
        const missing=unresolved();status.textContent=`${parsed.blocks.length} matching panel(s); ${parsed.incomplete} incomplete and ${parsed.unsupported} unsupported blocks. ${missing.length} unresolved replacement image(s). Unmatched text stays in ordinary chat.`;
    },controls);
    button('Review preset for this character',()=>{const c=config(),missing=unresolved();if(missing.length&&!allowMissing.checked)throw Error('Resolve these replacement images or explicitly allow unresolved mappings: '+missing.slice(0,8).join(', '));review(c);status.textContent='Preset staged. Use Apply imported UI profile to apply it. '+(missing.length?`${missing.length} unresolved replacement image(s) retained.`:'');},controls);
    button('Close setup',close,controls);
    const advanced=node('details');advanced.append(node('summary','Advanced preset JSON'),node('p','Paste only the source object (format, variants, theme and other preset settings), not a whole profile or a variants array. The form and JSON are separate drafts.'));const json=input(advanced,'Draft preset JSON',JSON.stringify(source,null,2),'textarea');button('Copy form draft to JSON',()=>{json.value=JSON.stringify(config(),null,2);},advanced);button('Review advanced JSON',()=>{const c=validatePortraitPreset(JSON.parse(json.value));const targets=[...Object.values(c.imageMappings??{}),...c.variants.flatMap(v=>Object.values(v.images))];const missing=targets.filter(t=>resolveImage(avatar,t).status!=='resolved');if(missing.length&&!allowMissing.checked)throw Error('Advanced draft has unresolved replacements. Resolve them or explicitly allow unresolved mappings.');review(c);status.textContent='Advanced preset staged for review. The form has not been changed.';},advanced);host.append(status,preview,advanced);
    return host;
}

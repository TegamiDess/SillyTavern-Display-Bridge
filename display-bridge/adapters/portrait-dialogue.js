import { validateImageMappings, appearanceChoices, appearanceDefault } from './portrait-mappings.js';
import { validatePresentationFormat, parsePresentation } from './presentation-formats.js';
import { codeRanges } from '../core/parser.js';
import { compileActions } from '../core/actions.js';

const fields=['speaker','dialogue','portrait','time','day','date','location'];
const safeKey=x=>typeof x==='string'&&/^[A-Za-z][\w-]{0,59}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const fail=message=>{throw Error(`Portrait/dialogue preset: ${message}`);};
function shape(x,allowed){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!allowed.includes(k)))fail('unknown or invalid fields');}
const text=(x,max=160)=>typeof x==='string'&&x.length>0&&x.length<=max&&!/[\u0000-\u001f]/.test(x);
export const DEFAULT_PRESET={format:{kind:'fields',open:'[Scene|',close:']',fields:{speaker:'speaker',dialogue:'text',portrait:'image',time:'time',day:'day',date:'date',location:'place'}},variantLabel:'Appearance',variants:[],theme:{accent:'#ddae46',background:'#fff8e6',text:'#493a22',pattern:'gingham',position:'center'}};
export function validatePortraitPreset(input){
    if(JSON.stringify(input)?.length>100000)fail('configuration too large');
    shape(input,['format','variantLabel','variants','theme','imageMappings','metadataLabels','defaults','appearance','portraitLabels']);
    const extended=['tagged','community','scene','scene-fragments'].includes(input.format?.kind);
    if(extended)validatePresentationFormat(input.format);
    else {
    shape(input.format,['kind','open','close','fields']);
    const f=input.format;
    if(!['fields','json'].includes(f.kind)||!text(f.open,40)||!text(f.close,40)||f.open===f.close||f.open.includes(f.close)||f.close.includes(f.open)||/[`\\]/.test(f.open+f.close))fail('invalid literal delimiters');
    shape(f.fields,fields);
    if(!['speaker','dialogue','portrait'].every(k=>safeKey(f.fields[k]))||Object.values(f.fields).some(x=>!safeKey(x))||new Set(Object.values(f.fields)).size!==Object.keys(f.fields).length)fail('unique speaker, dialogue and portrait field mappings required');
    if(f.kind==='fields'&&f.close.includes('|'))fail('field delimiter cannot be part of closing marker');
    }
    if(input.variantLabel!==undefined&&!text(input.variantLabel,60))fail('invalid selector label');
    if(!Array.isArray(input.variants)||input.variants.length>32)fail('expected up to 32 appearance options');
    const ids=new Set(['original']);
    for(const v of input.variants){
        shape(v,['id','label','images']);
        if(!safeKey(v.id)||ids.has(v.id)||!text(v.label,80))fail('invalid or duplicate appearance option');ids.add(v.id);
        if(!v.images||typeof v.images!=='object'||Array.isArray(v.images)||Object.keys(v.images).length>200||Object.entries(v.images).some(([a,b])=>!text(a,256)||!text(b,256)||['__proto__','constructor','prototype'].includes(a)))fail('invalid image-name mapping');
    }
    if(input.imageMappings!==undefined)validateImageMappings(input.imageMappings);
    if(input.portraitLabels!==undefined){validateImageMappings(input.portraitLabels);if(Object.values(input.portraitLabels).some(v=>v.length>80))fail('portrait labels must be at most 80 characters');}
    if(input.appearance!==undefined){
        const a=input.appearance;shape(a,['allowOriginal','defaultVariant']);
        if(typeof a.allowOriginal!=='boolean'||!safeKey(a.defaultVariant)||!ids.has(a.defaultVariant)||(!a.allowOriginal&&a.defaultVariant==='original'))fail('choose an available default outfit');
        if(input.format.kind==='community')fail('Community panels do not have appearance controls');
    }
    if(input.metadataLabels!==undefined){shape(input.metadataLabels,['time','day','date','location']);if(Object.values(input.metadataLabels).some(v=>!text(v,40)||!v.trim()))fail('invalid metadata label');}
    if(input.defaults!==undefined){shape(input.defaults,['visual','image','dialogue','console']);if(Object.values(input.defaults).some(v=>typeof v!=='boolean'))fail('invalid visibility default');}
    const theme={...DEFAULT_PRESET.theme,...input.theme};shape(theme,['accent','background','text','pattern','position']);
    if(['accent','background','text'].some(k=>!/^#[a-f\d]{6}$/i.test(theme[k]))||!['plain','gingham'].includes(theme.pattern)||!['left','center','right'].includes(theme.position))fail('unsupported theme value');
    return JSON.parse(JSON.stringify({...input,variantLabel:input.variantLabel??'Appearance',theme}));
}

// A deliberately narrow, independently authored reference pattern. Similar
// HTML, author names and unknown Lua never imply support for this contract.
export const REFERENCE_RULE={type:'editdisplay',in:String.raw`\[Scene\|speaker:([^|\]]*)\|text:([^|\]]*)\|image:([^|\]]*)\]`,out:'<figure class="portrait-dialogue"><img src="$3"><figcaption><b>$1</b><p>$2</p></figcaption></figure>'};

export function parsePortraitDialogue(source,config,excluded=[],depth=0){
    if(['tagged','community','scene','scene-fragments'].includes(config.format.kind))return parsePresentation(source,config,excluded,depth);
    const result={blocks:[],incomplete:0,unsupported:0},f=config.format;
    const ranges=[...codeRanges(source),...excluded];let cursor=0;
    while(cursor<source.length){
        const start=source.indexOf(f.open,cursor);if(start<0)break;
        cursor=start+f.open.length;
        if(source[start-1]==='\\'||ranges.some(([a,b])=>start>=a&&start<b))continue;
        let finish=-1;
        if(f.kind==='json'){
            let quote=false,escape=false,depth=0;
            for(let i=cursor;i<source.length&&i-cursor<20000;i++){
                const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}
                if(depth===0&&source.startsWith(f.close,i)){finish=i;break;}
                if(c==='"')quote=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;
                if(depth<0)break;
            }
        }else finish=source.indexOf(f.close,cursor);
        if(finish<0){result.incomplete++;break;}
        const end=finish+f.close.length,raw=source.slice(cursor,finish);cursor=end;
        if(ranges.some(([a,b])=>start<b&&end>a)){result.unsupported++;continue;}
        try{
            if(raw.length>20000)fail('block too long');
            let values;
            if(f.kind==='json')values=JSON.parse(raw);
            else {
                values=Object.create(null);
                for(const part of raw.split('|')){const colon=part.indexOf(':');if(colon<1)fail('malformed field');const key=part.slice(0,colon);if(!safeKey(key)||Object.hasOwn(values,key))fail('duplicate field');values[key]=part.slice(colon+1);}
            }
            if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(k=>!Object.values(f.fields).includes(k)))fail('unmapped field');
            const data={};for(const [key,mapped] of Object.entries(f.fields)){if(Object.hasOwn(values,mapped)){if(typeof values[mapped]!=='string'||values[mapped].length>(key==='dialogue'?12000:512))fail('invalid field value');data[key]=values[mapped];}}
            if(!['speaker','dialogue','portrait'].every(k=>data[k]?.trim()))fail('missing required field');
            result.blocks.push({type:'portrait-dialogue',start,end,...data,config});
        }catch{result.unsupported++;}
    }
    return result;
}
export function portraitActions(config){return compileActions({schemaVersion:1,namespace:'portrait-dialogue',variables:{
    ...Object.fromEntries(['visual','image','dialogue','console'].map(k=>[k,{type:'boolean',default:config.defaults?.[k]??true}])),
    variant:{type:'enum',default:appearanceDefault(config),values:appearanceChoices(config).map(v=>v.id)},
},actions:{...Object.fromEntries(['visual','image','dialogue','console'].map(variable=>[variable,[{op:'toggle',variable}]])),
    ...Object.fromEntries(appearanceChoices(config).map(v=>[ 'choose-'+v.id,[{op:'set',variable:'variant',value:v.id}]])),
    reset:['visual','image','dialogue','console','variant'].map(variable=>({op:'reset',variable})),
}});}

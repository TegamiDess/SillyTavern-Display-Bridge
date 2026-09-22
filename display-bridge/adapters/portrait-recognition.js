// Compile a bounded source grammar into a preset. Imported regex and HTML are
// inspected as data; neither is compiled/executed or inserted into the DOM.
import { DEFAULT_PRESET, REFERENCE_RULE, validatePortraitPreset } from './portrait-dialogue.js';

const unsupported = reason => ({status:'unsupported',reason});
const key = value => /^[A-Za-z][\w-]{0,59}$/.test(value) && !['constructor','prototype','__proto__'].includes(value);
const literalEscapes = new Set('\\.^$|?*+()[]{}-/');

function tokenizePattern(pattern) {
    if(typeof pattern!=='string'||pattern.length>4096)throw Error('The input pattern is missing or too large.');
    const parts=[];let literal='';
    for(let i=0;i<pattern.length;){
        const c=pattern[i];
        if(c==='\\'){
            const next=pattern[i+1];if(!literalEscapes.has(next))throw Error('Regex escapes with matching behaviour need an explicit profile.');
            literal+=next;i+=2;continue;
        }
        if(c==='('){
            parts.push({literal});literal='';
            if(pattern.slice(i,i+3)!=='([^')throw Error('Only captures excluding the field separator and closing bracket are supported.');
            i+=3;const excluded=[];
            while(i<pattern.length&&pattern[i]!==']'){
                let ch=pattern[i++];
                if(ch==='\\'){ch=pattern[i++];if(!literalEscapes.has(ch))throw Error('This capture character class is not supported.');}
                else if('[-^'.includes(ch))throw Error('Character-class ranges and nested classes need an explicit profile.');
                excluded.push(ch);
            }
            if(pattern[i++]!==']'||!['*','+'].includes(pattern[i]))throw Error('This capture quantifier is not supported.');
            i++;if(pattern[i]==='?')i++;
            if(pattern[i++]!==')')throw Error('Nested or modified captures need an explicit profile.');
            parts.push({excluded});continue;
        }
        if('.^$|?*+[]{}'.includes(c)||c===')')throw Error('Regex operators outside the supported literal field grammar need an explicit profile.');
        literal+=c;i++;
    }
    parts.push({literal});return parts;
}

function readPattern(pattern) {
    const parts=tokenizePattern(pattern);
    if(parts.length!==7)throw Error('This pattern must contain exactly three captures: speaker, dialogue and portrait.');
    const first=/^([\[{][^\[\]{}|:\r\n]+\|)([A-Za-z][\w-]{0,59}):$/.exec(parts[0].literal);
    if(!first)throw Error('Expected a named bracketed block with pipe-separated key:value fields.');
    const open=first[1],close=open[0]==='['?']':'}';
    if(parts[6].literal!==close)throw Error('The source closing delimiter does not match the supported block shape.');
    const names=[first[2]];
    for(const index of [2,4]){const m=/^\|([A-Za-z][\w-]{0,59}):$/.exec(parts[index].literal);if(!m)throw Error('Expected one named field between each capture.');names.push(m[1]);}
    if(names.some(n=>!key(n))||new Set(names).size!==3)throw Error('Source field names must be safe and distinct.');
    for(const index of [1,3,5]){const chars=new Set(parts[index].excluded);if(chars.size!==2||!chars.has('|')||!chars.has(close))throw Error('Captures must exclude exactly the pipe separator and closing bracket.');}
    return {open,close,names};
}

function readTemplate(html) {
    if(typeof html!=='string'||html.length>10000)throw Error('The replacement template is missing or too large.');
    const tokens=[];let offset=0;
    // Quoted attribute values cannot contain markup. This intentionally rejects
    // event handlers, style blocks, extra UI, entities and conditional macros.
    for(const match of html.matchAll(/<[^<>]*>|[^<]+/g)){
        if(match.index!==offset)throw Error('The replacement has unsupported markup.');offset+=match[0].length;
        const raw=match[0];
        if(!raw.startsWith('<')){if(raw.trim())tokens.push({text:raw.trim()});continue;}
        const closing=/^<\/([a-z]+)\s*>$/i.exec(raw);if(closing){tokens.push({end:closing[1].toLowerCase()});continue;}
        const opening=/^<([a-z]+)((?:\s+[\s\S]*?)?)\s*\/?\s*>$/i.exec(raw);if(!opening)throw Error('Unsupported template tag.');
        const tag=opening[1].toLowerCase(),attrs={},tail=opening[2];let position=0;
        const attr=/\s+([a-z][a-z0-9-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/g;
        for(const m of tail.matchAll(attr)){
            if(m.index!==position)throw Error('Unsupported template attributes.');position+=m[0].length;const name=m[1].toLowerCase();
            if(Object.hasOwn(attrs,name)||!(name==='class'||tag==='img'&&['src','alt'].includes(name)))throw Error('Additional attributes or behaviours require an explicit profile.');
            attrs[name]=m[2]??m[3];
        }
        if(tail.slice(position).trim())throw Error('Unsupported template attributes.');
        if(attrs.class!==undefined&&!/^[A-Za-z0-9_\-\s]{0,200}$/.test(attrs.class))throw Error('Template class names contain unsupported syntax.');
        tokens.push({tag,attrs});
    }
    if(offset!==html.length)throw Error('The replacement has unsupported markup.');
    let i=0;const take=()=>tokens[i++],end=tag=>{if(take()?.end!==tag)throw Error('Template nesting differs from the supported portrait/dialogue layout.');};
    const has=(token,name)=>(token?.attrs?.class??'').split(/\s+/).includes(name);
    const root=take();if(root?.tag!=='figure'&&!(root?.tag==='div'&&has(root,'portrait-dialogue')))throw Error('Expected a figure or portrait-dialogue container.');
    const img=take();if(img?.tag!=='img')throw Error('Expected one portrait before the dialogue.');
    const image=/^(?:\$([1-3])|\{\{asset::\$([1-3])\}\})$/.exec(img.attrs.src??'');if(!image)throw Error('Portrait source must be one capture or an asset macro containing one capture.');
    const caption=take();if(caption?.tag!=='figcaption'&&!(caption?.tag==='div'&&has(caption,'dialogue-box')))throw Error('Expected a dialogue caption or dialogue-box container.');
    const speaker=take();if(!['b','strong'].includes(speaker?.tag)&&!(speaker?.tag==='span'&&has(speaker,'speaker')))throw Error('Expected a distinct speaker label.');
    const capture=()=>{const token=take(),m=/^\$([1-3])$/.exec(token?.text??'');if(!m)throw Error('Speaker and dialogue must each contain exactly one capture.');return Number(m[1]);};
    const speakerNumber=capture();end(speaker.tag);
    const dialogue=take();if(dialogue?.tag!=='p'&&!(dialogue?.tag==='div'&&has(dialogue,'dialogue')))throw Error('Expected a distinct dialogue text element.');
    const dialogueNumber=capture();end(dialogue.tag);end(caption.tag);end(root.tag);
    if(i!==tokens.length)throw Error('Additional controls, text or markup need an explicit profile.');
    const portraitNumber=Number(image[1]??image[2]);
    if(new Set([speakerNumber,dialogueNumber,portraitNumber]).size!==3)throw Error('Speaker, dialogue and portrait must use distinct captures.');
    if(img.attrs.alt!==undefined&&!['',`$${speakerNumber}`].includes(img.attrs.alt))throw Error('Custom image alternative text needs an explicit profile.');
    return {speaker:speakerNumber,dialogue:dialogueNumber,portrait:portraitNumber};
}

function validateOptions(options) {
    if(options===undefined)return;
    if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['ableFlag','flag','flags'].includes(k)))throw Error('Unknown source matching options need review.');
    if(options.ableFlag!==undefined&&typeof options.ableFlag!=='boolean')throw Error('The source flag switch is invalid.');
    // Accept only global/default matching; never silently ignore case, anchors,
    // conditions or Risu directives carried in flag strings.
    for(const name of ['flag','flags'])if(Object.hasOwn(options,name)&&(typeof options[name]!=='string'||!['','g'].includes(options[name])))throw Error('Custom source regex flags need an explicit profile.');
}

export function inspectPortraitRule(rule,{optionsPreserved=false}={}) {
    if(rule?.type!=='editdisplay')return null;
    const exact=rule.in===REFERENCE_RULE.in&&rule.out===REFERENCE_RULE.out;
    const candidate=exact||/portrait-dialogue|figcaption|dialogue-box/i.test(String(rule.out??''));
    if(!candidate)return null;
    try{
        if(!exact&&!optionsPreserved)throw Error('Reattach the original card with the updated importer to inspect its regex options before automatic translation.');
        validateOptions(rule.matchOptions);
        const pattern=readPattern(rule.in),bindings=readTemplate(rule.out);
        const source=exact?validatePortraitPreset(DEFAULT_PRESET):validatePortraitPreset({...DEFAULT_PRESET,format:{kind:'fields',open:pattern.open,close:pattern.close,fields:Object.fromEntries(Object.entries(bindings).map(([field,n])=>[field,pattern.names[n-1]]))},variants:[]});
        return {status:'supported',family:'portrait-fields-v1',source,reason:'Recognized portrait/dialogue field bindings. Uses the preset layout; source CSS and additional scripting are not imported.'};
    }catch(error){return unsupported(error.message);}
}

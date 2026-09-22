// Portable, non-executable style tokens for tagged portrait layouts. Imported
// styles are read at discovery time; selectors and CSS never enter the widget.
const colours = ['accent','background','backgroundEnd','text','nameBackground','nameText'];
const numbers = {borderWidth:[0,8],radius:[0,40],padX:[8,48],padY:[8,36],fontSize:[12,24],lineHeight:[1.2,2],fontWeight:[400,800],nameFontSize:[11,22],nameTilt:[-5,5],width:[50,100]};
const lengths = {stageHeight:{px:[200,720],vh:[25,80]},portraitHeight:{px:[120,720],vh:[20,70]},portraitWidth:{px:[100,900],vw:[20,90],'%':[20,100]}};
const hex = value => /^#[a-f\d]{6}$/i.test(value??'');
const validLength = (key,value) => {const m=/^(\d+(?:\.\d+)?)(px|vh|vw|%)$/.exec(value??'');const range=m&&lengths[key][m[2]];return !!range&&+m[1]>=range[0]&&+m[1]<=range[1];};
export function validatePresentationStyle(style) {
    if (!style || typeof style!=='object' || Array.isArray(style)) throw Error('Presentation style: expected an object');
    for (const [key,value] of Object.entries(style)) {
        const valid = colours.includes(key) ? typeof value==='string'&&hex(value)
            : Object.hasOwn(numbers,key) ? typeof value==='number'&&Number.isFinite(value)&&value>=numbers[key][0]&&value<=numbers[key][1]
            : Object.hasOwn(lengths,key) ? typeof value==='string'&&validLength(key,value)
            : key==='pattern'&&['plain','gingham'].includes(value);
        if (!valid) throw Error('Presentation style: invalid '+key);
    }
}

// Deliberately limited cascade: ordinary class/tag selectors (including
// descendants), inherited custom properties, importance, specificity and source
// order. Conditional rules, external resources and pseudo elements cannot run.
export function readPresentationStyles(markup, css) {
    const rules=[]; let reason='';
    if (!markup?.trim()) return {rules,reason};
    try {
        if (typeof markup!=='string'||markup.length>100000||!css?.parse) throw Error('Styles unavailable or over the 100,000-character limit');
        const blocks=[...markup.matchAll(/<style\s*>([\s\S]*?)<\/style\s*>/gi)];
        if (!blocks.length || markup.replace(/<style\s*>[\s\S]*?<\/style\s*>/gi,'').trim()) throw Error('Shared styles require plain style elements');
        for(const block of blocks) for(const rule of css.parse(block[1]).stylesheet.rules) {
            if(rule.type!=='rule') continue;
            for(const selector of rule.selectors) {
                const pseudo=selector.endsWith('::before');
                const plain=pseudo?selector.slice(0,-8):selector;
                const parts=plain.trim().split(/\s+/);
                if(plain.length>512 || parts.length>6 || !parts.every(p=>/^(?:[a-z][\w-]*)?(?:\.[a-zA-Z_][\w-]*)+$/.test(p))) continue;
                rules.push({parts,pseudo,specificity:(plain.match(/\./g)??[]).length*100+parts.filter(p=>!p.startsWith('.')).length,declarations:rule.declarations.filter(d=>d.type==='declaration')});
                if(rules.length>2000) throw Error('Too many style selectors');
            }
        }
    } catch(e) {rules.length=0;reason=e.message;}
    return {rules,reason};
}
function matches(node,part) {
    const [tag,...classes]=part.split('.');
    return (!tag||node.tag===tag)&&classes.every(c=>(node.class??'').split(/\s+/).includes(c));
}
function selectorMatches(node,parts) {
    if(!matches(node,parts.at(-1))) return false;
    let parent=node.parent;
    for(let i=parts.length-2;i>=0;i--){while(parent&&!matches(parent,parts[i]))parent=parent.parent;if(!parent)return false;parent=parent.parent;}
    return true;
}
export function extractPresentationStyle(sheet,{container,box,words,name,image}) {
    const cache=new Map();
    function properties(node,pseudo=false) {
        if(!node)return {};
        if(!pseudo&&cache.has(node))return cache.get(node);
        const inherited=properties(node.parent),values=Object.fromEntries(Object.entries(inherited).filter(([k])=>k.startsWith('--')||['color','font-size','font-weight','line-height'].includes(k)));
        const priorities=new Map();
        for(const rule of sheet.rules)if(rule.pseudo===pseudo&&selectorMatches(node,rule.parts))for(const d of rule.declarations){
            const important=/\s*!important\s*$/i.test(d.value),priority=rule.specificity+(important?100000:0);
            const v=d.value.replace(/\s*!important\s*$/i,'').trim();
            const set=(key,value)=>{if(priority<(priorities.get(key)??-1))return;priorities.set(key,priority);values[key]=value;};
            if(d.property==='background'||d.property==='background-color')set('background',v);
            else if(d.property==='border'){
                const m=/^(\d+(?:\.\d+)?px)\s+solid\s+(.+)$/.exec(v);
                set('border-width',m?.[1]??'');set('border-color',m?.[2]??'');
            }else set(d.property,v);
        }
        if(!pseudo)cache.set(node,values);return values;
    }
    function value(node,key) {
        const props=properties(node);let v=props[key];
        for(let i=0;i<8&&/^var\(--[\w-]+\)$/.test(v??'');i++)v=props[v.slice(4,-1)];
        return v??'';
    }
    const style={};
    const color=(key,v)=>{if(/^#[a-f\d]{3}$/i.test(v))v='#'+[...v.slice(1)].map(c=>c+c).join('');if(hex(v))style[key]=v.toLowerCase();};
    const number=(key,v)=>{const n=Number(v);if(v!==''&&Number.isFinite(n)&&n>=numbers[key][0]&&n<=numbers[key][1])style[key]=n;};
    const px=(key,v)=>{if(/^\d+(?:\.\d+)?px$/.test(v))number(key,v.slice(0,-2));};
    color('accent',value(box,'border-color'));px('borderWidth',value(box,'border-width'));
    const background=value(box,'background-color')||value(box,'background');
    const gradient=/^linear-gradient\(\s*\d+deg,\s*(#[a-f\d]{6})\s+0%,\s*(#[a-f\d]{6})\s+100%\s*\)$/i.exec(background);
    if(gradient){color('background',gradient[1]);color('backgroundEnd',gradient[2]);}else color('background',background);
    color('text',value(words,'color'));color('nameBackground',value(name,'background-color')||value(name,'background'));color('nameText',value(name,'color'));
    px('radius',value(box,'border-radius'));
    const padding=/^(\d+(?:\.\d+)?px)(?:\s+(\d+(?:\.\d+)?px))?$/.exec(value(box,'padding'));
    if(padding){px('padY',padding[1]);px('padX',padding[2]??padding[1]);}
    px('fontSize',value(words,'font-size'));number('lineHeight',value(words,'line-height'));number('fontWeight',value(words,'font-weight'));px('nameFontSize',value(name,'font-size'));
    const tilt=/^rotate\((-?\d+(?:\.\d+)?)deg\)$/.exec(value(name,'transform'));if(tilt)number('nameTilt',tilt[1]);
    const width=/^(\d+(?:\.\d+)?)%$/.exec(value(container,'width'));if(width)number('width',width[1]);
    for(const [key,node,prop]of [['stageHeight',container,'height'],['portraitHeight',image,'max-height'],['portraitWidth',image,'max-width']]){const v=value(node,prop);if(validLength(key,v))style[key]=v;}
    // Recognize the two-direction check pattern, then use our own pattern.
    const pattern=properties(box,true)['background-image']??'';
    if(/repeating-linear-gradient\(45deg,/.test(pattern)&&/repeating-linear-gradient\(-45deg,/.test(pattern))style.pattern='gingham';
    else if(background)style.pattern='plain';
    validatePresentationStyle(style);
    return style;
}

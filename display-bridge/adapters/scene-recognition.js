// Recognized scene roles, not author/card IDs. Captures must match the reviewed
// input grammar and expected image/text roles before fragments can be assembled.
import {sceneOffset} from './scene-fragments.js';
const CAP = '(.+?)';
export const sceneBackgroundPattern = layout => (layout === 'plain-four' ? '' : '<' + CAP + '>') + '<img src=' + Array(layout === 'numbered-five' ? 5 : 4).fill('"' + CAP + '"').join('_') + '>';
export const sceneCastPattern = (count, fields = 4, generic = true) => '<' + (generic ? '\\d' : count) + '>' + ('<img="' + CAP + '"_"' + CAP + '"><ct=' + Array(fields).fill('"' + CAP + '"').join('_') + '>').repeat(count);
const omitted = 'Uses the local scene renderer with reviewed layers, position/tooltip bindings and text formatting. Source recency/state macros, specialized poses, animations and handlers are not executed.';
const imgRoles = output => [...output.matchAll(/<img\b[^>]*>/g)].map(m => ({class:/\bclass="([^"]*)"/.exec(m[0])?.[1], ref:/\bsrc="\{\{raw::\$(\d+)\}\}"/.exec(m[0])?.[1]}));
export function sceneOffsetAliases(rule){
    const options=rule.matchOptions??{},names=String(rule.in??'').split('|');
    return rule.type==='editdisplay'&&sceneOffset(rule.out)&&names.every(n=>/^@[\p{L}\p{N}_-]{1,80}$/u.test(n))
        && (options.ableFlag===false||['flag','flags'].every(k=>['','g',undefined].includes(options[k])))?names:[];
}
export function inspectSceneRule(rule, {optionsPreserved = false} = {}) {
    if (rule.type !== 'editdisplay') return null;
    const input = String(rule.in ?? ''), output = String(rule.out ?? '');
    let part;
    const background = ['numbered-four', 'plain-four', 'numbered-five'].find(x => input === sceneBackgroundPattern(x));
    if (background) part = {role:'background', layout:background};
    for (const fields of [2,4]) for (let count=1;count<=4;count++) for (const generic of [true,false]) if (input === sceneCastPattern(count,fields,generic)) part={role:'cast',fields,count};
    if (['<div><div tn="(.+?)">','<div tn="(.+?)">','<div><div tn=\\"(.+?)\\">'].includes(input)) part={role:'dialogue',opener:input.startsWith('<div>')?'double':'single'};
    if (['<text="(.+?)">(.+?)</text>','<text="(.+?)">([\\s\\S]+?)</text>'].includes(input)) part={role:'text'};
    if (!part) return null;
    try {
        if (!optionsPreserved) throw Error('Reattach the source to preserve scene matching options.');
        const options = rule.matchOptions ?? {};
        if (Object.keys(options).some(k=>!['ableFlag','flag','flags'].includes(k)) || options.ableFlag !== undefined && typeof options.ableFlag !== 'boolean'
            || options.ableFlag !== false && ['flag','flags'].some(k=>options[k] !== undefined && !['','g','m','gm','mg'].includes(options[k]))) throw Error('Scene matching flags need review.');
        if (/<\s*(script|iframe|object|embed)\b|\bon\w+\s*=|javascript\s*:/i.test(output)) throw Error('Executable scene template needs review.');
        const images = imgRoles(output);
        if (part.role === 'background') {
            const offset = background === 'plain-four' ? 0 : 1;
            if (!images.some(x=>/^backgroundImage\d*$/.test(x.class??'') && Number(x.ref)===1+offset)) throw Error('Main background binding is ambiguous.');
            const times = background === 'numbered-five' ? [4,5,6] : [4+offset];
            if (!times.every(n=>new RegExp('>\\$'+n+'<').test(output))) throw Error('Scene status bindings are missing.');
            const layerImages=images.filter(x=>/^fullBgImage[23]$/.test(x.class??''));
            part.layers=false;part.periodAssets={};
            if(layerImages.length){
                if(background==='numbered-five'||layerImages.length!==2||!layerImages.some(x=>x.class==='fullBgImage2'&&Number(x.ref)===2+offset)||!layerImages.some(x=>x.class==='fullBgImage3'&&Number(x.ref)===3+offset))throw Error('Scene layer bindings need review.');
                part.layers=true;
            }
            // Only literal sky-to-period branches, never arbitrary source conditions.
            const branches=/\{\{#if \{\{equal::([^{}]+)::\$(\d+)\}\}\}\}\s*<img class="backgroundImage([234]?)" src="\{\{raw::\$(\d+)\}\}"/g;
            for(const m of output.matchAll(branches))if(Number(m[2])===2+offset && Number(m[4])===1+offset && background!=='numbered-five') {
                const period=({'':'daytime',2:'dusk',3:'night',4:'midnight'})[m[3]];
                if(Object.hasOwn(part.periodAssets,m[1])&&part.periodAssets[m[1]]!==period)throw Error('Conflicting period binding.');
                Object.defineProperty(part.periodAssets,m[1],{value:period,enumerable:true});
            }
        }
        if (part.role === 'cast') {
            const stride = part.fields + 2;
            part.castMetadata=/style="top:|data-tooltip=/.test(output);
            for (let i=0;i<part.count;i++) {
                if (!images.some(x=>/^(?:characterImage\d(?:_\d)?|char-img)$/.test(x.class??'') && Number(x.ref)===1+i*stride)
                    || !images.some(x=>/^(?:characterImageHover\d(?:_\d)?|char-img-hover)$/.test(x.class??'') && Number(x.ref)===2+i*stride)) throw Error('Portrait and hover bindings do not match the cast captures.');
                if(part.castMetadata){
                    for(const ref of [1+i*stride,2+i*stride]){
                        const tag=[...output.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).find(t=>t.includes('src="{{raw::$'+ref+'}}"'));
                        if(!tag?.includes('style="top: $'+(3+i*stride)+'"'))throw Error('Portrait position binding needs review.');
                    }
                    for(let tip=4;tip<=stride;tip++)if(!output.includes('data-tooltip="$'+(tip+i*stride)+'"'))throw Error('Portrait tooltip binding needs review.');
                }
            }
            if (images.some(x=>!x.ref || !Array.from({length:part.count},(_,i)=>[1+i*stride,2+i*stride]).flat().includes(Number(x.ref)))) throw Error('Additional cast image bindings need review.');
        }
        if (part.role === 'dialogue' && (!/class="text-area-container"/.test(output) || !/class="text-area"/.test(output))) throw Error('Scene dialogue container is missing.');
        if (part.role === 'text' && !/^<p><span class="\$1">\$2(?:<\/span>\s*<\/p>)?$/.test(output.trim())) throw Error('Unsupported dialogue text wrapper.');
        return {status:'supported', family:'scene-fragments', part, reason:omitted};
    } catch (error) { return {status:'unsupported',family:'scene-fragments',reason:error.message}; }
}

export function assembleSceneRules(results, rules) {
    const supported = [...results.values()].filter(r=>r.status==='supported');
    if (supported.length !== results.size) throw Error('One or more scene fragment bindings need review; no scene was guessed.');
    const roles = role => supported.filter(r=>r.part.role===role).map(r=>r.part);
    const backgrounds = roles('background'), casts = roles('cast'), dialogue = roles('dialogue');
    if (!backgrounds.length || !casts.length || !dialogue.length) throw Error('Scene assembly needs compatible background, cast and dialogue rules together.');
    if (new Set(casts.map(c=>c.fields)).size !== 1 || new Set(backgrounds.map(b=>b.layout==='numbered-five')).size !== 1) throw Error('Conflicting scene input families need an explicit profile.');
    if(new Set(casts.map(c=>c.castMetadata)).size!==1 || new Set(backgrounds.map(b=>b.layers)).size!==1)throw Error('Conflicting scene detail bindings need review.');
    const periodAssets={},offsetAliases={};
    for(const b of backgrounds)for(const [name,period]of Object.entries(b.periodAssets)){
        if(Object.hasOwn(periodAssets,name)&&periodAssets[name]!==period)throw Error('Conflicting period bindings.');
        Object.defineProperty(periodAssets,name,{value:period,enumerable:true,configurable:true});
    }
    // The audited sources normalize literal @offset aliases before display.
    // Compile a finite lookup instead of running imported expressions on chat text.
    for(const rule of rules)for(const name of sceneOffsetAliases(rule)){
        if(Object.hasOwn(offsetAliases,name)&&offsetAliases[name]!==rule.out)throw Error('Conflicting offset alias.');Object.defineProperty(offsetAliases,name,{value:rule.out,enumerable:true,configurable:true});
    }
    const zero = rules.some(r=>r.type==='editdisplay'&&r.in==='<0>'&&['','</div>'].includes(String(r.out).trim()));
    return {kind:'scene-fragments', backgrounds:[...new Set(backgrounds.map(x=>x.layout))],castFields:casts[0].fields,counts:[...new Set([...(zero?[0]:[]),...casts.map(c=>c.count)])].sort(),dialogueOpeners:[...new Set(dialogue.map(d=>d.opener))],textTags:roles('text').length>0,
        details:{version:1,castMetadata:casts[0].castMetadata,layers:backgrounds[0].layers,periodAssets,offsetAliases}};
}
